import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, zip, unzip, makeBundle, verifyBundle, sha256, toBytes } from "../src/bundle.js";

test("crc32 · sha256 알려진 값", async () => {
  assert.equal(crc32(toBytes("123456789")), 0xcbf43926);
  assert.equal(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("zip 쓰고 읽기 (한글 파일 이름)", () => {
  const z = zip([{ name: "a/레시피.ini", data: "x=1" }, { name: "b.txt", data: new Uint8Array([0, 255]) }]);
  const e = unzip(z);
  assert.deepEqual(e.map((x) => x.name), ["a/레시피.ini", "b.txt"]);
  assert.equal(new TextDecoder().decode(e[0].data), "x=1");
  assert.ok(e.every((x) => x.crcOk));
  assert.throws(() => unzip(toBytes("nope")), /not a zip/);
});

const spec = {
  kind: "fleet", id: "b1", recipe: "DEMO", created: Date.UTC(2026, 10, 1), stage: "all",
  target: { label: "v9", fileName: "DEMO_v9.json", text: '{"a":9}' },
  tools: [{ name: "EQ-02", from: { label: "v8", fileName: "DEMO.xml", text: "<R/>" } }, { name: "EQ-03", from: { label: null, fileName: "DEMO.csv", text: "a,1" } }],
};

test("배포 묶음: 대상 + 장비별 롤백 파일 + manifest + SHA256SUMS, 검증 통과", async () => {
  const b = await makeBundle(spec);
  const names = unzip(b.bytes).map((x) => x.name);
  assert.deepEqual(names, ["recipe/DEMO_v9.json", "rollback/EQ-02/DEMO.xml", "rollback/EQ-03/DEMO.csv", "manifest.json", "SHA256SUMS", "README.txt"]);
  assert.equal(b.manifest.target.sha256, await sha256('{"a":9}'));
  assert.equal(b.manifest.tools[1].from.file, "rollback/EQ-03/DEMO.csv");
  const v = await verifyBundle(b.bytes);
  assert.equal(v.ok, true);
  assert.equal(v.files.length, 3);
});

test("묶음 안 파일이 바뀌면 검증 실패 (어느 파일인지)", async () => {
  const b = await makeBundle(spec);
  const e = unzip(b.bytes);
  e[0].data = toBytes('{"a":8}'); // 같은 길이로 내용만 바꿈
  const tampered = zip(e.map((x) => ({ name: x.name, data: x.data })));
  const v = await verifyBundle(tampered);
  assert.equal(v.ok, false);
  assert.deepEqual(v.files.filter((f) => !f.ok).map((f) => f.path), ["recipe/DEMO_v9.json"]);
  const noManifest = zip(e.filter((x) => x.name !== "manifest.json").map((x) => ({ name: x.name, data: x.data })));
  assert.deepEqual((await verifyBundle(noManifest)).errors, ["noManifest"]);
});

test("롤백 묶음: 대상 없이 장비별 직전 파일", async () => {
  const b = await makeBundle({ ...spec, kind: "rollback", target: null });
  assert.equal(b.manifest.target, null);
  assert.equal(b.manifest.tools[0].apply, "rollback/EQ-02/DEMO.xml");
  assert.equal((await verifyBundle(b.bytes)).ok, true);
});
