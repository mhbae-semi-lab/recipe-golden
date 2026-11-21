// IndexedDB 키-값 저장소 (스키마 버전 1: kv 하나). 앱 상태는 "state" 키에 JSON 하나로 둔다.
// IndexedDB 를 못 쓰는 환경(사생활 보호 창 등)에서는 메모리로 대신하고, 새로고침하면 사라진다.
const DB = "recipe-golden", VER = 1;
const mem = new Map();
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    let req;
    try { req = indexedDB.open(DB, VER); } catch { res(null); return; }
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv"); };
    req.onsuccess = () => res(req.result);
    req.onerror = req.onblocked = () => res(null);
  });
  return dbp;
}
const wrap = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function kv(mode, fn) {
  const db = await open();
  return db ? wrap(fn(db.transaction("kv", mode).objectStore("kv"))) : null;
}
export async function get(key) { const db = await open(); return db ? kv("readonly", (s) => s.get(key)) : mem.get(key); }
export async function put(key, value) { const db = await open(); if (db) return kv("readwrite", (s) => s.put(value, key)); mem.set(key, value); }
export async function clearAll() { const db = await open(); if (db) return kv("readwrite", (s) => s.clear()); mem.clear(); }
export const persistent = async () => !!(await open());

// 로컬 오류 기록 (최근 200건). 외부로 보내지 않는다
export async function logError(e) {
  try {
    const list = (await get("errors")) || [];
    list.push({ t: new Date().toISOString(), msg: String(e?.message || e).slice(0, 500), stack: String(e?.stack || "").slice(0, 1500) });
    await put("errors", list.slice(-200));
  } catch { /* 기록 실패는 무시 */ }
}
