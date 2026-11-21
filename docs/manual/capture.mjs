// 매뉴얼 · 보고서용 화면 캡처 (합성 데이터만). headless Chrome 을 DevTools 프로토콜로 움직인다.
// log-analyzer 의 docs/manual/capture.mjs 를 이 앱에 맞게 고쳐 쓴 것.
//   1) python -m http.server 8734 --bind 127.0.0.1      (저장소 루트에서)
//   2) node docs/manual/capture.mjs [http://127.0.0.1:8734/]
// 결과: docs/manual/shots/*.png (1280 x 800, 배율 1.5) + marks.json (말풍선 자리). Chrome 경로는 CHROME 환경 변수로 바꾼다.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const URL0 = process.argv[2] || "http://127.0.0.1:8734/";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "shots");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9334;
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "rg-capture-"));
const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "--window-size=1280,800", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, seq = 0;
const pending = new Map();
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((x) => x.type === "page");
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* 아직 시작 중 */ }
    await sleep(200);
  }
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); }
  });
}
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
async function js(expr) {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function view(w, h, scheme = "light", mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1.5, mobile });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }] });
}
// 요소를 화면 맨 위로 올리고 그 화면을 찍는다. marks: 말풍선 자리 요소 → marks.json 에 CSS px 사각형 (화면 밖이면 null)
const MARKS = {};
async function shot(name, sel, offset = 70, marks = []) {
  if (sel) await js(`const el = document.querySelector(${JSON.stringify(sel)}); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - ${offset});`);
  await js(`document.querySelector("#toast").hidden = true;`);
  await sleep(300);
  MARKS[name] = await js(`return ${JSON.stringify(marks)}.map((m) => { const el = document.querySelector(m); if (!el) return null;
    const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || !r.width) return null;
    return [r.left, Math.max(0, r.top), r.right, Math.min(r.bottom, innerHeight)].map(Math.round); });`);
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name + ".png"), Buffer.from(r.data, "base64"));
  console.log("shot", name, MARKS[name].map((x) => (x ? "o" : "-")).join(""));
}
async function load(lang = "ko", fresh = false) {
  if (fresh) await js(`for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); await new Promise(r => { const q = indexedDB.deleteDatabase("recipe-golden"); q.onsuccess = q.onerror = q.onblocked = r; });`);
  await send("Page.navigate", { url: URL0 });
  await sleep(1500);
  await js(`await document.fonts.ready;
    if (document.querySelector("#onboard").open) document.querySelector("#onboard form button").click();
    const s = document.querySelector("#lang"); if (s.value !== "${lang}") { s.value = "${lang}"; s.dispatchEvent(new Event("change", { bubbles: true })); }
    window.confirm = () => true;`);
  await sleep(400);
}
const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).click()`);
const pick = (sel, text) => js(`const s = document.querySelector(${JSON.stringify(sel)}); s.value = [...s.options].find((o) => o.text.startsWith(${JSON.stringify(text)})).value; s.dispatchEvent(new Event("change", { bubbles: true }));`);
// 내려받기를 가로채 zip 을 페이지 안에 보관 (묶음 검증 화면용)
const catchDownloads = () => js(`window.__dl = []; const oc = URL.createObjectURL; const blobs = new Map(); URL.createObjectURL = (b) => { const u = oc(b); blobs.set(u, b); return u; };
  HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push({ name: this.download, blob: blobs.get(this.href) }); };`);

try {
  await connect();
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: URL0 });
  await sleep(1200);
  await view(1280, 800);
  await load("ko", true);
  await send("Page.navigate", { url: URL0 }); // 안내 창이 다시 뜨도록 (onboarded 는 닫을 때 저장)
  await js(`await new Promise(r => { const q = indexedDB.deleteDatabase("recipe-golden"); q.onsuccess = q.onerror = q.onblocked = r; });`);
  await send("Page.navigate", { url: URL0 });
  await sleep(1800);
  await js(`await document.fonts.ready`);
  await shot("Onboard");
  await load("ko");

  await shot("Home", null, 0, ["#recipe", "#lang", "#theme", "#open-help", "#open-settings", "#load-sample", ".src-tabs .file-btn", ".src-tabs .file-btn:nth-of-type(2)", "#watch", "#stats"]);
  await shot("Board", "#bd-h", 80, ["#board tbody tr:nth-child(1) td.file", "#board tbody tr:nth-child(2) td:nth-child(3)", "#board tbody tr:nth-child(3) .judge", "#board thead th.is-base", "#board tbody tr:nth-child(1) td.vcell.past", "#board tbody tr:nth-child(3) td.vcell.near", ".legend"]);
  await js(`document.querySelectorAll("[data-act=diff-base]")[2].click()`); await sleep(500);
  await shot("Diff", "#diff", 66, ["#df-a", "#df-b", "#df-filter", "#df-rules", "#diff-sum", "#diff-body .grp summary", "#diff-body tr.r-out"]);
  await shot("Baseline", "#bl-h", 80, ["#baseline-body .big-line b", "#baseline-body table.mini", "#baseline-body .chips", "#baseline-body [data-act=tab]"]);
  await pick("#ck-tool", "EQ-03");
  await click("#ck-current"); await sleep(400);
  await shot("Check", "#ck-h", 80, ["#ck-tool", "#check .file-like", "#ck-current", "#ck-result .verdict", "#ck-result .reasons", "#ck-result [data-act=ck-save]"]);

  // 내 형식 파일 + 깨진 줄 (합성)
  await js(`const xml = '<?xml version="1.0"?>\\n<Recipe>\\n  <Section name="Optics">\\n    <Param name="Gain" value="6.5" unit="dB"/>\\n    <Param name="Exposure" value="1.5" unit="ms">\\n  </Section>\\n</Recipe>\\n';
    const ini = '[Optics]\\nGain=6.5 dB\\nExposure 1500 us\\n[Detect]\\nThreshold.Low=38\\nThreshold.Low=40\\n';
    const dt = new DataTransfer(); dt.items.add(new File([xml], 'MY-RECIPE_v1.xml')); dt.items.add(new File([ini], 'MY-RECIPE.ini')); dt.items.add(new File([new Uint8Array([0, 1, 2, 3, 0, 5])], 'image.bin'));
    const inp = document.querySelector('#files'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));`);
  await sleep(800);
  await js(`document.querySelectorAll('#im-table details').forEach((d) => (d.open = true)); const r = document.querySelector('#im-table tbody tr:nth-child(2) select[data-k=role]'); r.value = 'tool'; r.dispatchEvent(new Event('change', { bubbles: true }));`);
  await sleep(300);
  await js(`document.querySelectorAll('#im-table details').forEach((d) => (d.open = true));`);
  await shot("Import", null, 0, ["#im-table tbody tr:nth-child(1) select[data-k=format]", "#im-table tbody tr:nth-child(1) input[data-k=recipe]", "#im-table tbody tr:nth-child(2) select[data-k=role]", "#im-table tbody tr:nth-child(2) input[data-k=tool]", "#im-table tbody tr:nth-child(1) details", "#im-table tbody tr:nth-child(2) details", "#im-table tbody tr.bad"]);
  await js(`document.querySelector("#import").close()`);

  // 현장 검증 절차
  await click("#vt-repro"); await sleep(300);
  await shot("Repro", "#verify", 66, ["#vt-repro", "#vp-repro table", "#vp-repro [data-act=set-load]", "#set-name", "#vp-repro [data-act=set-save]"]);
  await click("#vt-compare"); await sleep(300);
  await shot("Compare", "#verify", 66, ["#cand-ver", "#vp-compare p.planned", "#vp-compare table.rules", "#ignore", "#vp-compare table.cmp", "#vp-compare tr.flip .tag", "#vp-compare [data-act=cand-start]"]);
  await click("[data-act=cand-start]"); await sleep(300);
  await click("#vt-shadow"); await sleep(300);
  await shot("PilotStart", "#verify", 66, ["#pilot-tool", "[data-act=pilot-start]", "#mode-badge"]);
  await pick("#pilot-tool", "EQ-01");
  await click("[data-act=pilot-start]"); await sleep(300);
  await click("[data-act=pilot-manual]"); await sleep(400);
  for (let i = 0; i < 3; i++) { await click("[data-act=pilot-check]"); await sleep(300); }
  await click("#vt-shadow"); await sleep(300);
  await shot("Shadow", "#verify", 66, ["[data-act=bundle-pilot]", "#vp-shadow .file-like", "[data-act=pilot-manual]", "[data-act=pilot-check]", "#vp-shadow table:nth-of-type(1)", "#vp-shadow .tbl-wrap:last-of-type"]);
  await shot("BoardPilot", "#bd-h", 80, ["#board tbody tr:nth-child(1) .tag.cand", "#board tbody tr:nth-child(1) .shadow-line", "#board tbody tr:nth-child(2) .shadow-line", "#mode-badge"]);
  await click("#vt-switch"); await sleep(300);
  await shot("Gate", "#verify", 66, ["#vp-switch .gate", "[data-act=switch]", "#vp-switch table.mini", "[data-act=rollback]"]);
  await catchDownloads();
  await click("[data-act=switch]"); await sleep(500);
  await click("#vt-switch"); await sleep(300);
  await shot("Switched", "#verify", 66, ["#vp-switch .note [data-act=bundle-dl]:not([data-rb])", "#vp-switch .note [data-act=bundle-dl][data-rb]", "#vp-switch .note [data-act=bundle-apply]", "#vp-switch table.mini", "[data-act=rollback]"]);
  await click("#vp-switch .note [data-act=bundle-dl]:not([data-rb])"); await sleep(500);
  await click("#vp-switch .note [data-act=bundle-apply]"); await sleep(500);
  await shot("BoardAfter", "#bd-h", 80, ["#board thead th.is-base", "#board tbody tr:nth-child(2) td.file", "#board tbody tr:nth-child(3) .judge"]);
  await click("#vt-switch"); await sleep(200);
  await click("[data-act=rollback]"); await sleep(500);
  await click("#vt-switch"); await sleep(300);
  await click("#vp-switch .note [data-act=bundle-apply]"); await sleep(500); // 롤백 묶음을 장비에 복사했다고 기록
  await click("#vt-switch"); await sleep(300);
  // 받은 전체 배포 묶음 검증
  await js(`const f = window.__dl[0]; const dt = new DataTransfer(); dt.items.add(new File([f.blob], f.name, { type: "application/zip" }));
    const inp = document.querySelector("#vb-file"); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true }));`);
  await sleep(800);
  await shot("Rollback", "#vp-switch .note", 120, ["#vp-switch .note", "#vp-switch table.mini tr:nth-child(2)", "#vp-switch .file-like", "#vb-result .verdict", "#vb-result .reasons"]);
  // 허용 오차를 넓힌 후보 → 놓침 위험
  await click("#vt-compare"); await sleep(300);
  await pick("#cand-ver", "v8");
  await js(`const p = [...document.querySelectorAll('#vp-compare [data-k="pattern"]')].find((i) => i.value === "Detect.Threshold.*");
    const a = document.querySelector('#vp-compare [data-rule="' + p.dataset.rule + '"][data-k="abs"]'); a.value = "5"; a.dispatchEvent(new Event("change", { bubbles: true }));`);
  await sleep(300);
  await js(`const g = document.querySelector("#ignore"); g.value += "\\nDetect.MergeDistance\\nOutput.ImageSave"; g.dispatchEvent(new Event("change", { bubbles: true }));`);
  await sleep(300);
  await shot("CompareLoose", "#vp-compare table.cmp", 140, ["#vp-compare table.rules", "#ignore", "#vp-compare tr.flip"]);
  await click("[data-act=cand-start]"); await sleep(300);
  await click("#vt-shadow"); await sleep(300);
  await pick("#pilot-tool", "EQ-01");
  await click("[data-act=pilot-start]"); await sleep(300);
  for (let i = 0; i < 3; i++) { await click("[data-act=pilot-check]"); await sleep(300); }
  await click("#vt-switch"); await sleep(300);
  await shot("GateLoose", "#verify", 66, ["#vp-switch .gate li.no", "#ack", "[data-act=switch]"]);
  await click("#vt-compare"); await sleep(200);
  await click("[data-act=cand-cancel]"); await sleep(300);

  await shot("History", "#hs-h", 80, ["#hs-tool", "#hs-type", "#hist tbody tr:nth-child(1)", "#hist tbody tr.changed"]);
  await click("#open-settings"); await sleep(400);
  await shot("Settings", null, 0, ["#s-runs", "#backup-export", "#settings .file-like", "#reset-all", "#err-count"]);
  await js(`document.querySelector("#settings form button[value=cancel]").click()`);
  await click("#open-help"); await sleep(400);
  await shot("Help");
  await js(`document.querySelector("#help form button").click()`);

  await load("en", true);
  await shot("EnHome", "#bd-h", 80);
  await js(`document.querySelectorAll("[data-act=diff-base]")[2].click()`); await sleep(300);
  await pick("#ck-tool", "EQ-03"); await click("#ck-current"); await sleep(300);
  await shot("EnCheck", "#ck-h", 80);

  await view(390, 844, "dark", true);
  await load("ko");
  await shot("MobileDark", "#bd-h", 130);
  await view(1280, 800, "dark");
  await load("ko");
  await shot("DarkBoard", "#bd-h", 80);
  writeFileSync(join(OUT, "marks.json"), JSON.stringify(MARKS, null, 1));
} finally {
  try { ws?.close(); } catch { /* */ }
  proc.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* 잠긴 파일은 남긴다 */ }
}
