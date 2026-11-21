// 배포 · 롤백 묶음: 압축 없는(STORE) zip 에 레시피 파일, manifest.json, SHA256SUMS 를 넣는다.
// 받는 쪽은 같은 앱의 "묶음 검증"이나 sha256sum -c SHA256SUMS 로 파일이 바뀌지 않았는지 확인한다.

const enc = new TextEncoder();
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export const toBytes = (x) => (x instanceof Uint8Array ? x : enc.encode(String(x)));
export function b64ToBytes(s) { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
export function bytesToB64(b) { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); }
export async function sha256(x) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", toBytes(x)));
  return [...d].map((v) => v.toString(16).padStart(2, "0")).join("");
}
// 원래 바이트(b64)가 있으면 그것을, 없으면 UTF-8 글자
export const fileBytes = (f) => (f.b64 ? b64ToBytes(f.b64) : toBytes(f.text ?? ""));

function dosTime(d) {
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

export function zip(files, when = new Date()) {
  const parts = [], central = [];
  let off = 0;
  const { time, date } = dosTime(when);
  for (const f of files) {
    const name = enc.encode(f.name), data = toBytes(f.data), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((n, p) => n + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const x of all) { out.set(x, p); p += x.length; }
  return out;
}

// 이 앱이 만든 STORE zip 만 읽는다 (압축된 zip 은 오류)
export function unzip(bytes) {
  const b = toBytes(bytes), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = b.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw Object.assign(new Error("not a zip"), { code: "notZip" });
  const n = v.getUint16(e + 10, true);
  let c = v.getUint32(e + 16, true);
  const dec = new TextDecoder();
  const out = [];
  for (let i = 0; i < n; i++) {
    if (v.getUint32(c, true) !== 0x02014b50) throw Object.assign(new Error("bad zip"), { code: "badZip" });
    const method = v.getUint16(c + 10, true), crc = v.getUint32(c + 16, true), size = v.getUint32(c + 20, true);
    const nl = v.getUint16(c + 28, true), xl = v.getUint16(c + 30, true), cl = v.getUint16(c + 32, true), lo = v.getUint32(c + 42, true);
    const name = dec.decode(b.subarray(c + 46, c + 46 + nl));
    if (method !== 0) throw Object.assign(new Error(`compressed entry: ${name}`), { code: "compressed", name });
    const start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
    const data = b.slice(start, start + size);
    out.push({ name, data, crcOk: crc32(data) === crc });
    c += 46 + nl + xl + cl;
  }
  return out;
}

const safe = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "_";

// spec = { kind, id, recipe, created, stage, target: { label, fileName, b64|text, sha } | null, tools: [{ name, from: { label, fileName, b64|text } , to? }], baseline: {...} }
// 배포 묶음은 recipe/ 에 대상 파일, rollback/<장비>/ 에 각 장비의 직전 파일. 롤백 묶음은 rollback/<장비>/ 만.
export async function makeBundle(spec) {
  const files = [];
  const add = async (path, f) => { const data = fileBytes(f); files.push({ name: path, data, sha: await sha256(data) }); };
  if (spec.target) await add(`recipe/${safe(spec.target.fileName)}`, spec.target);
  for (const t of spec.tools) if (t.from) await add(`rollback/${safe(t.name)}/${safe(t.from.fileName)}`, t.from);
  const manifest = {
    app: "recipe-golden", kind: spec.kind, bundle: spec.id, recipe: spec.recipe, created: new Date(spec.created).toISOString(), stage: spec.stage || null,
    target: spec.target ? { version: spec.target.label, file: `recipe/${safe(spec.target.fileName)}`, sha256: files[0].sha } : null,
    tools: spec.tools.map((t) => ({ tool: t.name, apply: spec.target ? `recipe/${safe(spec.target.fileName)}` : t.from ? `rollback/${safe(t.name)}/${safe(t.from.fileName)}` : null, from: t.from ? { version: t.from.label || null, file: `rollback/${safe(t.name)}/${safe(t.from.fileName)}` } : null })),
    baseline: spec.baseline || null,
    files: files.map((f) => ({ path: f.name, sha256: f.sha, bytes: f.data.length })),
  };
  const sums = files.map((f) => `${f.sha}  ${f.name}`).join("\n") + "\n";
  const readme = [
    `recipe-golden ${spec.kind} bundle ${spec.id}`, "",
    "KO: recipe/ 의 파일을 manifest.json 의 tools 에 적힌 장비에 복사합니다. 되돌릴 때는 rollback/<장비>/ 의 파일을 씁니다.",
    "    복사 전에 앱의 '묶음 검증' 또는 'sha256sum -c SHA256SUMS' 로 파일이 바뀌지 않았는지 확인하세요.",
    "EN: Copy the file in recipe/ to each tool listed in manifest.json. To roll back, use rollback/<tool>/.",
    "    Verify first with the app's 'Verify bundle' or 'sha256sum -c SHA256SUMS'.", "",
  ].join("\r\n");
  const all = [...files.map((f) => ({ name: f.name, data: f.data })), { name: "manifest.json", data: JSON.stringify(manifest, null, 2) }, { name: "SHA256SUMS", data: sums }, { name: "README.txt", data: readme }];
  return { bytes: zip(all, new Date(spec.created)), manifest, name: `${safe(spec.recipe)}_${spec.kind}_${safe(spec.label || spec.target?.label || "")}_${spec.id}.zip`.replace(/_+/g, "_") };
}

// 받은 묶음 검증: zip CRC, manifest 의 sha256, SHA256SUMS 가 모두 맞아야 ok
export async function verifyBundle(bytes) {
  const res = { ok: false, manifest: null, files: [], errors: [] };
  let entries;
  try { entries = unzip(bytes); } catch (e) { res.errors.push(e.code || "notZip"); return res; }
  const get = (n) => entries.find((x) => x.name === n);
  const m = get("manifest.json");
  if (!m) { res.errors.push("noManifest"); return res; }
  try { res.manifest = JSON.parse(new TextDecoder().decode(m.data)); } catch { res.errors.push("badManifest"); return res; }
  const sums = new Map((new TextDecoder().decode(get("SHA256SUMS")?.data || new Uint8Array())).split(/\r?\n/).filter(Boolean).map((l) => { const [h, ...p] = l.split(/\s+/); return [p.join(" ").replace(/^\*/, ""), h]; }));
  for (const f of res.manifest.files || []) {
    const e = get(f.path);
    const actual = e ? await sha256(e.data) : null;
    res.files.push({ path: f.path, expected: f.sha256, actual, ok: !!e && e.crcOk && actual === f.sha256 && sums.get(f.path) === f.sha256, missing: !e });
  }
  for (const e of entries) if (!["manifest.json", "SHA256SUMS", "README.txt"].includes(e.name) && !(res.manifest.files || []).some((f) => f.path === e.name)) res.errors.push(`extra:${e.name}`);
  res.ok = !res.errors.length && res.files.length > 0 && res.files.every((f) => f.ok);
  return res;
}
