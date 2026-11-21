// 레시피 파일 → 평평한 파라미터 표 { 경로: { v: 값 문자열, u: 단위 | "", line: 줄 번호 } }.
// 형식: JSON · INI · XML · CSV · key=value. 형식이 달라도 같은 레시피면 같은 경로가 나오도록 맞춘다
// (XML 루트 요소 이름은 경로에 넣지 않고, INI [섹션] · XML 요소 · JSON 객체가 모두 "섹션.키" 가 된다).
// 읽지 못한 줄은 errors 에 { line, code, detail } 로 남기고 나머지는 계속 읽는다.

export const FORMATS = ["json", "ini", "xml", "csv", "kv"];

// 바이트 → 문자열. BOM → UTF-8(엄격) → EUC-KR 순서
export function decode(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return { text: new TextDecoder("utf-8").decode(b.subarray(3)), encoding: "utf-8" };
  if (b[0] === 0xff && b[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(b.subarray(2)), encoding: "utf-16le" };
  if (b[0] === 0xfe && b[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(b.subarray(2)), encoding: "utf-16be" };
  try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(b), encoding: "utf-8" }; } catch { /* 아래로 */ }
  try { return { text: new TextDecoder("euc-kr").decode(b), encoding: "euc-kr" }; } catch { return { text: new TextDecoder("utf-8").decode(b), encoding: "utf-8" }; }
}

export function detectFormat(fileName = "", text = "") {
  const ext = (fileName.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  if (ext === "json") return "json";
  if (ext === "xml") return "xml";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (ext === "ini") return "ini";
  const s = text.replace(/^﻿/, "").trimStart();
  if (s[0] === "{" || (s[0] === "[" && !/^\[[^\]\r\n"{[]*\]\s*$/.test(s.split(/\r?\n/, 1)[0]))) return "json";
  if (s[0] === "<") return "xml";
  const lines = s.split(/\r?\n/).filter((l) => l.trim() && !/^\s*[;#]/.test(l)).slice(0, 20);
  if (lines.some((l) => /^\s*\[[^\]]+\]\s*$/.test(l))) return "ini";
  const eq = lines.filter((l) => /^[^=,;\t]+=/.test(l)).length;
  const sep = lines.filter((l) => /[,;\t|]/.test(l) && !/=/.test(l)).length;
  if (sep > eq) return "csv";
  return "kv";
}

// 레시피 이름: 파일 안의 Name 항목 → 파일 이름(확장자 · _v3 · -v3 꼬리 뺌)
export function recipeName(fileName, params) {
  for (const k of Object.keys(params || {})) if (/^(header|recipe|meta)\.(name|recipe(name)?)$/i.test(k) || /^(recipe)?name$/i.test(k)) return String(params[k].v).trim();
  return String(fileName || "recipe").replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").replace(/[_\-. ]v(er)?\d+(\.\d+)*$/i, "") || "recipe";
}
export function versionHint(fileName) {
  const m = String(fileName || "").match(/[_\-. ](v(?:er)?\d+(?:\.\d+)*)\.[^.]+$/i);
  return m ? m[1].replace(/^ver/i, "v").toLowerCase() : "";
}

export function parseRecipe(text, { format, fileName } = {}) {
  text = String(text ?? "").replace(/^﻿/, "");
  const fmt = format && format !== "auto" ? format : detectFormat(fileName, text);
  const out = { format: fmt, params: {}, errors: [] };
  const seen = new Map();
  if (!text.trim()) { out.errors.push({ line: 1, code: "empty" }); return out; }
  const put = (path, v, u, line) => {
    path = path.replace(/\s*\.\s*/g, ".").replace(/^\.+|\.+$/g, "");
    if (!path) return;
    const low = path.toLowerCase(), hit = seen.get(low);
    if (hit !== undefined) { out.errors.push({ line, code: "dup", detail: path }); delete out.params[hit]; }
    seen.set(low, path);
    v = String(v ?? "").trim(); u = String(u ?? "").trim();
    // "300 mm" 처럼 값에 붙은 단위는 떼어 낸다 (형식이 달라도 같은 모양이 되게)
    const m = !u && v.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([^\d\s+\-.,;:=][^\s]*)$/i);
    if (m) { v = m[1]; u = m[2]; }
    out.params[path] = { v, u, line: line || 0 };
  };
  ({ json: parseJSON, ini: parseINI, kv: parseINI, xml: parseXML, csv: parseCSV }[fmt] || parseINI)(text, put, out.errors);
  return out;
}

// ---- JSON ----
const VALUE_KEYS = ["value", "val", "v"], UNIT_KEYS = ["unit", "units", "u"], NAME_KEYS = ["name", "key", "id", "param", "parameter"];
const pick = (o, keys) => { for (const k of Object.keys(o)) if (keys.includes(k.toLowerCase())) return k; return null; };

// 줄 번호를 알기 위한 작은 JSON 읽기. 값마다 줄 번호를 LINE 에 붙인다 (JSON.parse 오류 메시지는 엔진마다 위치를 주지 않음)
const LINE = Symbol("line");
export function readJSON(text) {
  let i = 0, line = 1;
  const fail = (what) => { throw Object.assign(new Error(what), { line }); };
  const ws = () => { for (; i < text.length; i++) { const c = text[i]; if (c === "\n") line++; else if (c !== " " && c !== "\t" && c !== "\r") break; } };
  const str = () => {
    let s = ""; i++;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { i++; return s; }
      if (c === "\n") fail("newline in string");
      if (c === "\\") {
        const e = text[++i];
        if (e === "u") { s += String.fromCharCode(parseInt(text.slice(i + 1, i + 5), 16)); i += 4; } else s += { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" }[e] ?? e;
      } else s += c;
    }
    fail("unterminated string");
  };
  const val = () => {
    ws();
    const c = text[i], at = line;
    if (c === "{") {
      const o = {}; i++; ws();
      if (text[i] === "}") { i++; return o; }
      for (;;) {
        ws(); if (text[i] !== '"') fail("expected key");
        const k = str(); ws(); if (text[i] !== ":") fail("expected ':'"); i++;
        const v = val(); o[k] = v; if (v === null || typeof v !== "object") (o[LINE] ||= {})[k] = lastLine;
        ws(); if (text[i] === ",") { i++; continue; } if (text[i] === "}") { i++; return o; } fail("expected ',' or '}'");
      }
    }
    if (c === "[") {
      const a = []; i++; ws();
      if (text[i] === "]") { i++; return a; }
      for (;;) { const v = val(); a.push(v); if (v === null || typeof v !== "object") (a[LINE] ||= {})[a.length - 1] = lastLine; ws(); if (text[i] === ",") { i++; continue; } if (text[i] === "]") { i++; return a; } fail("expected ',' or ']'"); }
    }
    lastLine = at;
    if (c === '"') return str();
    const m = text.slice(i).match(/^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/);
    if (!m) fail(c === undefined ? "unexpected end" : `unexpected '${c}'`);
    i += m[1].length;
    return m[1] === "true" ? true : m[1] === "false" ? false : m[1] === "null" ? null : Number(m[1]);
  };
  let lastLine = 1;
  const v = val(); ws();
  if (i < text.length) fail(`unexpected '${text[i]}'`);
  return v;
}

function parseJSON(text, put, errors) {
  let data;
  try { data = readJSON(text); } catch (e) { errors.push({ line: e.line || 1, code: "json", detail: e.message }); return; }
  // 배열 안의 { name, value, unit } 객체는 name 을 키로 쓴다 (skip = 이미 경로에 쓴 name 키)
  const walk = (node, path, skip, line) => {
    if (node === null || typeof node !== "object") { put(path, node === null ? "" : String(node), "", line); return; }
    const L = node[LINE] || {};
    if (Array.isArray(node)) {
      node.forEach((x, i) => {
        const nk = x && typeof x === "object" && !Array.isArray(x) ? pick(x, NAME_KEYS) : null;
        walk(x, nk ? join(path, String(x[nk])) : `${path}[${i}]`, nk, L[i]);
      });
      return;
    }
    const vk = pick(node, VALUE_KEYS);
    if (vk && (node[vk] === null || typeof node[vk] !== "object")) {
      const uk = pick(node, UNIT_KEYS);
      put(path, node[vk] ?? "", uk ? node[uk] : "", L[vk]);
      for (const [k, x] of Object.entries(node)) if (k !== vk && k !== uk && k !== skip) walk(x, `${path}@${k}`, null, L[k]);
      return;
    }
    for (const [k, x] of Object.entries(node)) if (k !== skip) walk(x, join(path, k), null, L[k]);
  };
  walk(data, "", null, 1);
}
const join = (a, b) => (a ? `${a}.${b}` : b);

// ---- INI · key=value ----
function parseINI(text, put, errors) {
  let section = "";
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1, s = raw.trim();
    if (!s || s[0] === ";" || s[0] === "#" || s.startsWith("//")) return;
    const sec = s.match(/^\[([^\]]*)\]$/);
    if (sec) { section = sec[1].trim(); return; }
    let at = s.indexOf("=");
    if (at < 0) at = s.indexOf(":");
    if (at <= 0) { errors.push({ line, code: "noeq", detail: s.slice(0, 80) }); return; }
    const key = s.slice(0, at).trim();
    let v = s.slice(at + 1).trim();
    if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    put(join(section, key), v, "", line);
  });
}

// ---- CSV ----
export function csvRows(text) {
  const first = text.split(/\r?\n/, 1)[0].replace(/"(?:[^"]|"")*"/g, ""); // 따옴표 안 구분자는 세지 않는다
  const delim = [",", "\t", ";", "|"].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = "", q = false, line = 1, start = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else { if (c === "\n") line++; cell += c; }
    } else if (c === '"' && cell.trim() === "") { cell = ""; q = true; }
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push({ cells: row, line: start }); row = []; cell = ""; line++; start = line;
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push({ cells: row, line: start }); }
  return rows.map((r) => ({ ...r, cells: r.cells.map((x) => x.trim()) })).filter((r) => r.cells.some((x) => x !== ""));
}
function parseCSV(text, put, errors) {
  const rows = csvRows(text);
  if (!rows.length) return;
  const h = rows[0].cells.map((x) => x.toLowerCase());
  const find = (re) => h.findIndex((x) => re.test(x));
  let col = { name: find(/^(name|key|param(eter)?|path|item|항목|이름|파라미터)$/), value: find(/^(value|val|값|설정값)$/), unit: find(/^(unit|units|단위)$/), section: find(/^(section|group|category|구분|섹션|그룹)$/) };
  let body = rows;
  if (col.name >= 0 && col.value >= 0) body = rows.slice(1);
  else col = { name: 0, value: 1, unit: rows[0].cells.length > 2 ? 2 : -1, section: -1 };
  for (const r of body) {
    const name = r.cells[col.name] ?? "";
    if (r.cells.length <= Math.max(col.name, col.value) || !name) { errors.push({ line: r.line, code: "csvcols", detail: r.cells.join(" | ").slice(0, 80) }); continue; }
    const sec = col.section >= 0 ? r.cells[col.section] : "";
    put(join(sec, name), r.cells[col.value], col.unit >= 0 ? r.cells[col.unit] : "", r.line);
  }
}

// ---- XML (줄 번호를 알기 위해 직접 읽는다; DOMParser 는 Node 에 없고 줄 번호를 주지 않음) ----
const ENT = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const unent = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m));

export function xmlTree(text, errors) {
  const root = { name: "#doc", attrs: {}, kids: [], text: "", line: 1 };
  const stack = [root];
  let i = 0, line = 1;
  const adv = (to) => { for (let k = i; k < to; k++) if (text.charCodeAt(k) === 10) line++; i = to; };
  while (i < text.length) {
    const lt = text.indexOf("<", i);
    if (lt < 0) { stack.at(-1).text += unent(text.slice(i)); adv(text.length); break; }
    if (lt > i) { stack.at(-1).text += unent(text.slice(i, lt)); adv(lt); }
    const end = (tok) => { const e = text.indexOf(tok, i); if (e < 0) { errors.push({ line, code: "xmlsyntax", detail: `missing ${tok}` }); adv(text.length); return -1; } return e; };
    if (text.startsWith("<!--", i)) { const e = end("-->"); if (e < 0) break; adv(e + 3); continue; }
    if (text.startsWith("<![CDATA[", i)) { const e = end("]]>"); if (e < 0) break; stack.at(-1).text += text.slice(i + 9, e); adv(e + 3); continue; }
    if (text.startsWith("<?", i)) { const e = end("?>"); if (e < 0) break; adv(e + 2); continue; }
    if (text.startsWith("<!", i)) { const e = end(">"); if (e < 0) break; adv(e + 1); continue; }
    const gt = end(">");
    if (gt < 0) break;
    const tag = text.slice(i + 1, gt), here = line;
    if (tag[0] === "/") {
      const name = tag.slice(1).trim();
      if (stack.length < 2 || stack.at(-1).name !== name) {
        errors.push({ line: here, code: "xmlmismatch", detail: `</${name}> ≠ <${stack.at(-1).name}> (line ${stack.at(-1).line})` });
        const k = stack.map((n) => n.name).lastIndexOf(name);
        if (k > 0) stack.length = k; else if (stack.length > 1) stack.pop(); // 없는 이름이면 열린 요소를 닫은 것으로 보고 이어 읽는다
      } else stack.pop();
    } else {
      const m = tag.match(/^([^\s/>]+)([\s\S]*?)(\/?)\s*$/);
      if (!m) errors.push({ line: here, code: "xmlsyntax", detail: tag.slice(0, 60) });
      else {
        const node = { name: m[1], attrs: {}, kids: [], text: "", line: here };
        for (const a of m[2].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) node.attrs[a[1]] = unent(a[2] ?? a[3]);
        stack.at(-1).kids.push(node);
        if (!m[3]) stack.push(node);
      }
    }
    adv(gt + 1);
  }
  for (const n of stack.slice(1).reverse()) errors.push({ line: n.line, code: "xmlunclosed", detail: `<${n.name}>` });
  return root;
}

function parseXML(text, put, errors) {
  const doc = xmlTree(text, errors);
  const top = doc.kids.filter((k) => k.name);
  if (top.length !== 1) { if (!top.length) errors.push({ line: 1, code: "xmlsyntax", detail: "no root" }); }
  const walk = (node, path) => {
    const nk = pick(node.attrs, NAME_KEYS), vk = pick(node.attrs, VALUE_KEYS), uk = pick(node.attrs, UNIT_KEYS);
    // 같은 이름의 형제 요소는 [0] [1] … 으로 구분 (name 속성이 있으면 그 값이 키)
    const counts = {};
    for (const k of node.kids) if (!pick(k.attrs, NAME_KEYS)) counts[k.name] = (counts[k.name] || 0) + 1;
    const seen = {};
    if (vk) put(path, node.attrs[vk], uk ? node.attrs[uk] : "", node.line);
    else if (!node.kids.length && path) put(path, node.text, uk ? node.attrs[uk] : "", node.line);
    for (const [a, x] of Object.entries(node.attrs)) if (a !== nk && a !== vk && a !== uk && path && !/^xmlns/i.test(a)) put(`${path}@${a}`, x, "", node.line);
    for (const k of node.kids) {
      const kn = pick(k.attrs, NAME_KEYS);
      let seg = kn ? k.attrs[kn] : k.name;
      if (!kn && counts[k.name] > 1) seg = `${k.name}[${(seen[k.name] = (seen[k.name] ?? -1) + 1)}]`;
      walk(k, join(path, seg));
    }
  };
  for (const r of top) walk({ ...r, attrs: {} }, ""); // 루트 요소 이름 · 속성은 경로에 넣지 않는다
}
