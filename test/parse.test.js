import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecipe, detectFormat, decode, recipeName, versionHint } from "../src/parse.js";
import { versionRows, write } from "../src/sample.js";

const strip = (p) => Object.fromEntries(Object.entries(p).map(([k, x]) => [k, [x.v, x.u]]));

test("5가지 형식이 같은 경로 · 값으로 읽힌다 (항목 40)", () => {
  const rows = versionRows(8);
  const base = parseRecipe(write(rows, "ini"), { fileName: "a.ini" });
  assert.equal(base.errors.length, 0);
  assert.equal(Object.keys(base.params).length, 40);
  for (const fmt of ["json", "xml", "csv", "kv"]) {
    const r = parseRecipe(write(rows, fmt), { format: fmt });
    assert.deepEqual(r.errors, [], fmt);
    assert.deepEqual(Object.keys(r.params).sort(), Object.keys(base.params).sort(), fmt);
    // 숫자 표기(6.0 / 6)는 diff 에서 같게 보므로 여기서는 단위만 확인
    for (const [k, x] of Object.entries(base.params)) assert.equal(r.params[k].u, x.u, `${fmt} ${k}`);
  }
});

test("형식 감지", () => {
  assert.equal(detectFormat("r.json", ""), "json");
  assert.equal(detectFormat("r.txt", "{\"a\":1}"), "json");
  assert.equal(detectFormat("r.txt", "<a/>"), "xml");
  assert.equal(detectFormat("r.txt", "[Sec]\na=1"), "ini");
  assert.equal(detectFormat("r.txt", "a.b = 1\nc = 2"), "kv");
  assert.equal(detectFormat("r.txt", "name,value\na,1\nb,2"), "csv");
});

test("깨진 줄은 줄 번호와 이유", () => {
  const ini = parseRecipe("[A]\nx=1\nthis line is broken\ny=2\n", { format: "ini" });
  assert.deepEqual(ini.errors.map((e) => [e.line, e.code]), [[3, "noeq"]]);
  assert.equal(Object.keys(ini.params).length, 2);

  const json = parseRecipe('{\n  "a": 1,\n  "b": ,\n}', { format: "json" });
  assert.equal(json.errors[0].code, "json");
  assert.equal(json.errors[0].line, 3);

  const xml = parseRecipe("<R>\n  <A name=\"x\" value=\"1\"/>\n  <B>2</C>\n</R>", { format: "xml" });
  assert.deepEqual(xml.errors.map((e) => [e.line, e.code]), [[3, "xmlmismatch"]]);
  const unclosed = parseRecipe("<R>\n<S name=\"a\">\n<P name=\"b\" value=\"1\"/>\n</R>", { format: "xml" });
  assert.ok(unclosed.errors.some((e) => e.code === "xmlmismatch" && e.line === 4));

  const csv = parseRecipe("name,value,unit\nA.x,1,mm\nlonely\nA.y,2,", { format: "csv" });
  assert.deepEqual(csv.errors.map((e) => [e.line, e.code]), [[3, "csvcols"]]);
  assert.deepEqual(strip(csv.params), { "A.x": ["1", "mm"], "A.y": ["2", ""] });

  assert.equal(parseRecipe("", { format: "ini" }).errors[0].code, "empty");
});

test("중복 키는 표시하고 마지막 값을 쓴다 (대소문자 무시)", () => {
  const r = parseRecipe("[A]\nGain=1\ngain=2\n", { format: "ini" });
  assert.equal(r.errors[0].code, "dup");
  assert.equal(r.errors[0].line, 3);
  assert.deepEqual(strip(r.params), { "A.gain": ["2", ""] });
});

test("XML: name/value/unit 속성, 요소 글자, 반복 요소, 엔티티, CDATA, 기타 속성", () => {
  const r = parseRecipe(`<?xml version="1.0"?>
<Recipe xmlns="urn:x" name="R1">
  <Optics><Param Name="Gain" Value="6.5" Unit="dB" min="0"/></Optics>
  <Note><![CDATA[a < b]]></Note>
  <Step>1</Step><Step>2</Step>
  <Text>A &amp; B</Text>
</Recipe>`, { format: "xml" });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(strip(r.params), { "Optics.Gain": ["6.5", "dB"], "Optics.Gain@min": ["0", ""], Note: ["a < b", ""], "Step[0]": ["1", ""], "Step[1]": ["2", ""], Text: ["A & B", ""] });
  assert.equal(r.params["Optics.Gain"].line, 3);
});

test("JSON: 중첩 · {value, unit} · name 이 있는 배열 · 일반 배열", () => {
  const r = parseRecipe(JSON.stringify({ A: { Gain: { value: 6.5, unit: "dB" }, On: true }, P: [{ name: "x", value: 1 }, { name: "y", value: 2, unit: "mm" }], L: [3, 4] }), { format: "json" });
  assert.deepEqual(strip(r.params), { "A.Gain": ["6.5", "dB"], "A.On": ["true", ""], "P.x": ["1", ""], "P.y": ["2", "mm"], "L[0]": ["3", ""], "L[1]": ["4", ""] });
});

test("CSV: 따옴표 · 머리글 없는 2열 · 세미콜론", () => {
  const r = parseRecipe('A.x;"1,5"\nA.y;"say ""hi"""\n', { format: "csv" });
  assert.deepEqual(strip(r.params), { "A.x": ["1,5", ""], "A.y": ['say "hi"', ""] });
});

test("인코딩: BOM · EUC-KR · UTF-16", () => {
  assert.equal(decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x61])).text, "a");
  const euckr = new Uint8Array([0x5b, 0x41, 0x5d, 0x0a, 0x78, 0x3d, 0xb0, 0xa1]); // [A]\nx=가
  const d = decode(euckr);
  assert.equal(d.encoding, "euc-kr");
  assert.equal(parseRecipe(d.text, { format: "ini" }).params["A.x"].v, "가");
  assert.equal(decode(new Uint8Array([0xff, 0xfe, 0x61, 0x00])).text, "a");
});

test("레시피 이름 · 버전 힌트", () => {
  assert.equal(recipeName("x.ini", { "Header.Name": { v: "R9" } }), "R9");
  assert.equal(recipeName("C:\\a\\SCAN_A_v3.json", {}), "SCAN_A");
  assert.equal(versionHint("SCAN_A_v3.json"), "v3");
  assert.equal(versionHint("SCAN_A-ver12.ini"), "v12");
  assert.equal(versionHint("SCAN_A.ini"), "");
});
