// 화면. 상태는 flow.js 의 JSON 하나(st)이고, 바뀔 때마다 IndexedDB 에 저장하고 전체를 다시 그린다 (장비 · 버전 수가 작아 충분히 빠름).
import { decode, parseRecipe, recipeName, versionHint, FORMATS } from "./parse.js";
import { diffParams, verdict, compileRules, BLOCKING } from "./diff.js";
import * as F from "./flow.js";
import { sha256, bytesToB64, makeBundle, verifyBundle } from "./bundle.js";
import { buildSample, RECIPE as SAMPLE_RECIPE } from "./sample.js";
import { t, setLang, lang, applyI18n, statusName, reasonText, evText, helpHtml } from "./i18n.js";
import * as store from "./store.js";

const APP_VERSION = "1.0.0";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtTime = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const MAX_FILE = 5 * 1024 * 1024;

let st = F.emptyState();
const ui = { recipe: "", A: "", B: "", filter: "diff", useRules: true, tab: "repro", histTool: "", histType: "", histLimit: 100, ck: null, draft: null, verifyResult: null, watch: null, importItems: [] };

// ---------- 저장 ----------
let saveTimer = null;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.put("state", st).catch(fail), 200); }
function commit() { persist(); render(); }

function toast(msg, ms = 3500) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), ms);
}
function fail(e) { console.error(e); store.logError(e); toast(t("errToast", { msg: e?.message || e })); }
window.addEventListener("error", (e) => fail(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => fail(e.reason));

function download(name, data, type = "application/octet-stream") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- 공통 조각 ----------
const R = () => st.recipes[ui.recipe];
const vLabel = (id) => F.versionById(st, id)?.label || "?";
const toolName = (id) => F.toolById(st, id)?.name || "?";
const toolsWithFiles = () => st.tools.filter((x) => F.currentSnap(st, x.id, ui.recipe));
function verdictBadge(v, small = false) {
  if (!v) return "";
  const within = v.count.within || 0;
  const cls = v.pass ? (within ? "within" : "ok") : "block";
  const txt = v.pass ? (within ? t("vWithinN", { n: within }) : t("vPass")) : t("vBlockN", { n: v.blocking.length });
  return `<span class="badge ${cls}${small ? " sm" : ""}">${esc(txt)}</span>`;
}
const clsText = (c) => (c ? `<span class="cls ${c.kind}">${esc(t("cls_" + c.kind))}</span>` : "");

// ---------- 전체 그리기 ----------
function render() {
  const names = Object.keys(st.recipes).sort();
  if (!names.includes(ui.recipe)) ui.recipe = names[0] || "";
  $("#recipe").innerHTML = names.length ? names.map((n) => `<option ${n === ui.recipe ? "selected" : ""}>${esc(n)}</option>`).join("") : `<option value="">${esc(t("noRecipe"))}</option>`;
  renderStats(); renderBoard(); renderBaseline(); renderCheck(); renderDiff(); renderVerify(); renderHistory();
  const c = R()?.cand;
  $("#mode-badge").className = "badge" + (c ? " within" : "");
  $("#mode-badge").textContent = c ? t(c.stage === "pilot" ? "modePilot" : "modeCompare", { ver: vLabel(c.ver), tool: c.pilot ? toolName(c.pilot) : "" }) : t("modeNone");
}

function renderStats() {
  const vers = F.versionsOf(st, ui.recipe), tools = toolsWithFiles();
  const sts = tools.map((x) => F.toolStatus(st, ui.recipe, x.id));
  const blocked = sts.filter((s) => s.main && !s.main.pass).length;
  const b = R()?.baseline;
  $("#stats").innerHTML = ui.recipe ? [
    [t("stRecipe"), ui.recipe], [t("stVersions"), vers.length], [t("stTools"), tools.length],
    [t("stBaseline"), b ? vLabel(b.ver) : "—"], [t("stBlocked"), `${blocked} / ${tools.length}`],
  ].map(([k, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("") : `<p class="hint">${esc(t("noData"))}</p>`;
}

// 장비 × 버전 현황판. ○ = 그 장비의 예전 파일이 그 버전과 같았던 적
const pastVersions = (toolId) => new Set(st.snaps.filter((s) => s.tool === toolId && s.recipe === ui.recipe).map((s) => F.snapMatch(st, ui.recipe, s).exact?.id).filter(Boolean));

function renderBoard() {
  const vers = F.versionsOf(st, ui.recipe), r = R(), tools = toolsWithFiles();
  $("#board-empty").hidden = tools.length > 0;
  if (!tools.length) { $("#board").innerHTML = ""; return; }
  const head = `<thead><tr><th scope="col">${esc(t("tool"))}</th><th scope="col">${esc(t("curFile"))}</th><th scope="col">${esc(t("identified"))}</th><th scope="col">${esc(t("judgment"))}</th>` +
    vers.map((v) => {
      const mark = r?.baseline?.ver === v.id ? ` <span class="mk base" title="${esc(t("baseline"))}">◆</span>` : r?.cand?.ver === v.id ? ` <span class="mk cand" title="${esc(t("candidate"))}">◇</span>` : "";
      return `<th scope="col" class="vcol${r?.baseline?.ver === v.id ? " is-base" : ""}"><button type="button" class="link" data-act="diff-ver" data-ver="${v.id}" title="${esc(v.note || "")}">${esc(v.label)}</button>${mark}</th>`;
    }).join("") + "</tr></thead>";
  const rows = tools.map((x) => {
    const s = F.toolStatus(st, ui.recipe, x.id);
    const past = pastVersions(x.id);
    const id = s.match.exact ? `<b>${esc(s.match.exact.label)}</b>` : s.match.closest ? esc(t("nearVer", { ver: s.match.closest.label, n: s.match.n })) : "—";
    const src = s.snap.source === "manual" ? ` <span class="tag">${esc(t("srcManual"))}</span>` : s.snap.source === "watch" ? ` <span class="tag">${esc(t("srcWatch"))}</span>` : "";
    const judge = `<button type="button" class="link judge" data-act="diff-base" data-tool="${x.id}">${verdictBadge(s.main)}</button>` +
      (s.main?.by === "cand" ? ` <span class="tag cand">${esc(t("byCand"))}</span>` : "") +
      (s.shadow ? `<div class="shadow-line">${esc(t("shadowLine"))} ${verdictBadge(s.shadow, true)} ${clsText(s.cls)}</div>` : "");
    const cells = vers.map((v) => {
      let mk = "", cls = "", lab = "";
      if (s.match.exact?.id === v.id) { mk = "●"; cls = s.main?.pass ? "cur ok" : "cur block"; lab = t("cellCur"); }
      else if (!s.match.exact && s.match.closest?.id === v.id) { mk = "◐"; cls = s.main?.pass ? "near ok" : "near block"; lab = t("cellNear", { n: s.match.n }); }
      else if (past.has(v.id)) { mk = "○"; cls = "past"; lab = t("cellPast"); }
      return `<td class="vcell ${cls}${r?.baseline?.ver === v.id ? " is-base" : ""}"><button type="button" data-act="diff-cell" data-tool="${x.id}" data-ver="${v.id}" aria-label="${esc(`${x.name} · ${v.label}: ${lab || t("cellNone")}`)}">${mk || "<span aria-hidden='true'>·</span>"}</button></td>`;
    }).join("");
    return `<tr><th scope="row">${esc(x.name)}</th><td class="file"><span>${esc(s.snap.fileName)}</span><small>${esc(s.snap.format.toUpperCase())} · ${esc(fmtTime(s.snap.t))}</small>${src}</td><td>${id}</td><td>${judge}</td>${cells}</tr>`;
  }).join("");
  $("#board").innerHTML = head + `<tbody>${rows}</tbody>`;
}

function rulesTable(rules) {
  const tol = rules?.tol || [];
  return `<table class="mini"><thead><tr><th scope="col">${esc(t("rPattern"))}</th><th scope="col">${esc(t("rAllow"))}</th></tr></thead><tbody>` +
    (tol.length ? tol.map((r) => `<tr><td><code>${esc(r.pattern)}</code></td><td>${esc(allowText(r))}</td></tr>`).join("") : `<tr><td colspan="2" class="hint">${esc(t("rNone"))}</td></tr>`) +
    `</tbody></table><p class="chips"><span class="hint">${esc(t("rIgnore"))}</span> ${(rules?.ignore || []).map((p) => `<code>${esc(p)}</code>`).join(" ") || "—"}</p>`;
}
const allowText = (r) => [r.abs != null && r.abs !== "" ? `±${r.abs}${r.unit ? " " + r.unit : ""}` : "", r.pct != null && r.pct !== "" ? `±${r.pct}%` : ""].filter(Boolean).join(t("rOr")) || t("rExact");

function renderBaseline() {
  const r = R(), el = $("#baseline-body");
  if (!r?.baseline) { el.innerHTML = `<p class="hint">${esc(t("noBaseline"))}</p>`; return; }
  const v = F.versionById(st, r.baseline.ver);
  el.innerHTML = `<p class="big-line"><span class="hint">${esc(t("baseVer"))}</span> <b>${esc(v?.label)}</b> <small>${esc(v?.fileName || "")} · ${esc(t("since", { t: fmtTime(r.baseline.t) }))}</small>
      <button class="btn ghost sm" type="button" data-act="diff-ver" data-ver="${r.baseline.ver}">${esc(t("viewParams"))}</button></p>` +
    rulesTable(r.baseline.rules) +
    (r.cand ? `<p class="note">${esc(t("candRunning", { ver: vLabel(r.cand.ver), stage: t(r.cand.stage === "pilot" ? "stagePilot" : "stageCompare") }))} <button class="btn ghost sm" type="button" data-act="tab" data-tab="${r.cand.stage === "pilot" ? "shadow" : "compare"}">${esc(t("goVerify"))}</button></p>`
      : `<div class="row"><button class="btn sm" type="button" data-act="tab" data-tab="compare">${esc(t("startChange"))}</button></div>`);
}

// ---------- 검사 전 검증 ----------
function renderCheck() {
  const tools = st.tools;
  const sel = $("#ck-tool"), keep = sel.value;
  sel.innerHTML = tools.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
  if (tools.some((x) => x.id === keep)) sel.value = keep;
  $("#ck-current").disabled = !F.currentSnap(st, sel.value, ui.recipe);
  const c = ui.ck;
  if (!c || c.recipe !== ui.recipe) { $("#ck-result").innerHTML = ""; return; }
  if (c.error) { $("#ck-result").innerHTML = `<p class="msg err">${esc(t(c.error))}</p>`; return; }
  const reasons = c.main.blocking.map((row) => `<li>${reasonText(row)}</li>`).join("");
  const within = c.main.rows.filter((row) => row.status === "within").map((row) => `<li>${reasonText(row)}</li>`).join("");
  $("#ck-result").innerHTML = `<div class="result ${c.pass ? "pass" : "block"}">
      <p class="verdict">${esc(c.pass ? t("ckPass") : t("ckBlock"))}</p>
      <p class="hint">${esc(t("ckMeta", { tool: toolName(c.tool), file: c.fileName, ver: c.main.label, by: t(c.by === "cand" ? "byCandLong" : "byBase"), t: fmtTime(c.t) }))}</p>
      ${reasons ? `<h3>${esc(t("ckReasons", { n: c.main.blocking.length }))}</h3><ul class="reasons">${reasons}</ul>` : ""}
      ${within ? `<details><summary>${esc(t("ckWithin", { n: c.main.count.within }))}</summary><ul class="reasons">${within}</ul></details>` : ""}
      ${c.shadow ? `<p class="shadow-line">${esc(t("shadowLine"))} ${verdictBadge(c.shadow, true)} ${clsText(c.cls ? { kind: c.cls } : null)}</p>` : ""}
      <div class="row"><button class="btn ghost sm" type="button" data-act="ck-save">${esc(t("ckSave"))}</button>
      <button class="btn ghost sm" type="button" data-act="ck-diff">${esc(t("ckDiff"))}</button></div></div>`;
}

async function runCheck(toolId, file) {
  if (!R()?.baseline) { ui.ck = { recipe: ui.recipe, error: "noBaseline" }; render(); return; }
  const res = F.preCheck(st, ui.recipe, toolId, file);
  ui.ck = { ...res, recipe: ui.recipe, tool: toolId, params: file.params, fileName: file.fileName };
  commit();
}

// ---------- Diff ----------
function diffOptions() {
  const r = R();
  const vs = F.versionsOf(st, ui.recipe).map((v) => [`v:${v.id}`, `${t("optVer")} ${v.label}${r?.baseline?.ver === v.id ? " " + t("tagBase") : r?.cand?.ver === v.id ? " " + t("tagCand") : ""}`]);
  const ts = toolsWithFiles().map((x) => [`t:${x.id}`, `${t("optTool")} ${x.name}`]);
  return [...vs, ...ts];
}
function sideParams(key) {
  const [k, id] = key.split(":");
  if (k === "v") { const v = F.versionById(st, id); return v ? { params: F.paramsOf(v), label: v.label } : null; }
  const s = F.currentSnap(st, id, ui.recipe);
  if (k === "c") return ui.ck?.params ? { params: ui.ck.params, label: ui.ck.fileName } : null;
  return s ? { params: F.paramsOf(s), label: toolName(id) } : null;
}
function renderDiff() {
  const opts = diffOptions(), keys = opts.map((o) => o[0]);
  if (ui.ck?.params) opts.push(["c:check", `${t("optCheck")} ${ui.ck.fileName}`]), keys.push("c:check");
  const r = R();
  if (!keys.includes(ui.A)) ui.A = r?.baseline ? `v:${r.baseline.ver}` : keys[0] || "";
  if (!keys.includes(ui.B)) ui.B = keys.find((k) => k.startsWith("t:")) || keys[1] || keys[0] || "";
  for (const [id, val] of [["#df-a", ui.A], ["#df-b", ui.B]]) $(id).innerHTML = opts.map(([k, l]) => `<option value="${k}" ${k === val ? "selected" : ""}>${esc(l)}</option>`).join("");
  $("#df-filter").value = ui.filter; $("#df-rules").checked = ui.useRules;
  const A = sideParams(ui.A), B = sideParams(ui.B);
  if (!A || !B) { $("#diff-sum").innerHTML = ""; $("#diff-body").innerHTML = `<p class="hint">${esc(t("diffEmpty"))}</p>`; return; }
  const rules = ui.useRules ? R()?.baseline?.rules || {} : {};
  const rows = diffParams(A.params, B.params, compileRules(rules));
  const v = verdict(rows);
  const order = ["out", "changed", "unit", "missing", "added", "within", "ignored", "same"];
  $("#diff-sum").innerHTML = `<div class="stat">${verdictBadge(v)}<span>${esc(`${A.label} ↔ ${B.label}`)}</span></div>` +
    order.filter((s) => v.count[s]).map((s) => `<div class="stat"><b>${v.count[s]}</b><span class="st-${s}">${esc(statusName(s))}</span></div>`).join("");
  const show = rows.filter((x) => ui.filter === "all" || (ui.filter === "block" ? BLOCKING.has(x.status) : x.status !== "same" && !(x.status === "ignored" && !x.differs)));
  if (!show.length) { $("#diff-body").innerHTML = `<p class="empty">${esc(t("diffNone"))}</p>`; return; }
  // 파라미터 트리: 첫 마디(섹션)로 묶는다
  const groups = new Map();
  for (const x of show.sort((a, b) => a.path.localeCompare(b.path))) {
    const sec = x.path.includes(".") ? x.path.split(".")[0] : t("noSection");
    if (!groups.has(sec)) groups.set(sec, []);
    groups.get(sec).push(x);
  }
  $("#diff-body").innerHTML = [...groups].map(([sec, list]) => {
    const bad = list.filter((x) => BLOCKING.has(x.status)).length;
    return `<details class="grp" open><summary><b>${esc(sec)}</b> <small>${list.length}${bad ? ` · <span class="st-out">${esc(t("nBlock", { n: bad }))}</span>` : ""}</small></summary>
      <div class="tbl-wrap"><table class="dt"><thead><tr><th scope="col">${esc(t("dParam"))}</th><th scope="col">A · ${esc(A.label)}</th><th scope="col">B · ${esc(B.label)}</th><th scope="col">${esc(t("dStatus"))}</th><th scope="col">${esc(t("dDetail"))}</th><th scope="col">${esc(t("dLine"))}</th></tr></thead><tbody>` +
      list.map((x) => `<tr class="r-${x.status}"><td><code>${esc(x.path.slice(sec === t("noSection") ? 0 : sec.length + 1) || x.path)}</code></td><td>${esc(x.base ?? "—")}</td><td>${esc(x.act ?? "—")}</td><td><span class="st st-${x.status}">${esc(statusName(x.status))}</span></td><td>${esc(detailText(x))}</td><td>${x.line || ""}</td></tr>`).join("") +
      `</tbody></table></div></details>`;
  }).join("");
}
function detailText(x) {
  if (x.delta === undefined) return x.status === "unit" ? t("dUnit", { a: x.unitA, b: x.unitB }) : x.note ? t(x.note) : "";
  if (x.status === "same") return x.converted !== undefined ? t("dConv", { v: x.converted, u: x.unit }) : "";
  const d = `${x.delta > 0 ? "+" : ""}${x.delta}${x.unit ? " " + x.unit : ""}`;
  return x.allow ? t("dDeltaAllow", { d, a: x.allow, u: x.unit || "" }) : t("dDelta", { d });
}

// ---------- 현장 검증 4단계 ----------
function setTab(tab) {
  ui.tab = tab;
  for (const k of ["repro", "compare", "shadow", "switch"]) {
    const b = $(`#vt-${k}`), p = $(`#vp-${k}`);
    b.setAttribute("aria-selected", String(k === tab)); b.tabIndex = k === tab ? 0 : -1; p.hidden = k !== tab;
  }
}
function renderVerify() { setTab(ui.tab); renderRepro(); renderCompare(); renderShadow(); renderSwitch(); }

function setName(s) { return s.name === "sample:now" ? t("setNow") : s.name === "sample:allv8" ? t("setAll8") : s.name; }
function renderRepro() {
  const sets = st.sets;
  $("#vp-repro").innerHTML = `<p class="hint">${esc(t("reproHint"))}</p>
    <div class="tbl-wrap"><table class="mini"><thead><tr><th scope="col">${esc(t("setName"))}</th><th scope="col">${esc(t("setTools"))}</th><th scope="col">${esc(t("setSaved"))}</th><th scope="col"></th></tr></thead><tbody>` +
    (sets.length ? sets.map((s) => {
      const n = Object.values(s.current).filter((m) => m[ui.recipe]).length;
      const blocked = Object.entries(s.current).filter(([tool, m]) => { const sn = F.snapById(st, m[ui.recipe]); return sn && R()?.baseline && !F.judge(st, { ...R().baseline, by: "base" }, F.paramsOf(sn)).pass; }).length;
      return `<tr><td>${esc(setName(s))}${s.builtIn ? ` <span class="tag">${esc(t("builtIn"))}</span>` : ""}</td><td>${esc(t("setSummary", { n, b: blocked }))}</td><td>${esc(fmtTime(s.t))}</td><td><button class="btn ghost sm" type="button" data-act="set-load" data-id="${s.id}">${esc(t("setLoad"))}</button>${s.builtIn ? "" : ` <button class="btn ghost sm" type="button" data-act="set-del" data-id="${s.id}" aria-label="${esc(t("delete") + " " + s.name)}">✕</button>`}</td></tr>`;
    }).join("") : `<tr><td colspan="4" class="hint">${esc(t("setEmpty"))}</td></tr>`) +
    `</tbody></table></div>
    <div class="row"><label class="field inline"><span>${esc(t("setNameNew"))}</span> <input id="set-name" placeholder="${esc(t("setNamePh"))}"></label>
    <button class="btn sm" type="button" data-act="set-save">${esc(t("setSave"))}</button></div>`;
}

// 비교: 후보(진행 중) 또는 초안. 같은 장비 파일로 현재 기준 vs 후보 판정을 나란히
function editing() {
  const r = R();
  if (!r?.baseline) return null;
  if (r.cand) return { live: true, ver: r.cand.ver, rules: r.cand.rules };
  if (!ui.draft || ui.draft.recipe !== ui.recipe) {
    const next = F.versionsOf(st, ui.recipe).find((v) => v.t > (F.versionById(st, r.baseline.ver)?.t ?? 0));
    ui.draft = { recipe: ui.recipe, ver: next?.id || r.baseline.ver, rules: structuredClone(r.baseline.rules) };
  }
  return { live: false, ver: ui.draft.ver, rules: ui.draft.rules };
}
function renderCompare() {
  const el = $("#vp-compare"), r = R(), ed = editing();
  if (!ed) { el.innerHTML = `<p class="hint">${esc(t("noBaseline"))}</p>`; return; }
  const vers = F.versionsOf(st, ui.recipe);
  const tolRows = ed.rules.tol.map((x, i) => `<tr>
      <td><input aria-label="${esc(t("rPattern"))} ${i + 1}" data-rule="${i}" data-k="pattern" value="${esc(x.pattern)}" spellcheck="false"></td>
      <td><input aria-label="± ${i + 1}" data-rule="${i}" data-k="abs" type="number" step="any" value="${esc(x.abs ?? "")}"></td>
      <td><input aria-label="% ${i + 1}" data-rule="${i}" data-k="pct" type="number" step="any" value="${esc(x.pct ?? "")}"></td>
      <td><input aria-label="${esc(t("rUnit"))} ${i + 1}" data-rule="${i}" data-k="unit" value="${esc(x.unit ?? "")}" spellcheck="false" size="5"></td>
      <td><button class="btn ghost sm" type="button" data-act="rule-del" data-i="${i}" aria-label="${esc(t("delete"))} ${i + 1}">✕</button></td></tr>`).join("");
  const base = { ...r.baseline, by: "base" }, cand = { ver: ed.ver, rules: ed.rules, by: "cand" };
  const cmp = F.compareSet(st, ui.recipe, base, cand);
  const planned = diffParams(F.paramsOf(F.versionById(st, r.baseline.ver)), F.paramsOf(F.versionById(st, ed.ver)), compileRules(ed.rules)).filter((x) => x.status !== "same" && x.status !== "ignored");
  el.innerHTML = `<p class="hint">${esc(t(ed.live ? "cmpLive" : "cmpDraft"))}</p>
    <div class="cmp-grid">
      <div>
        <label class="field"><span>${esc(t("candVer"))}</span><select id="cand-ver">${vers.map((v) => `<option value="${v.id}" ${v.id === ed.ver ? "selected" : ""}>${esc(v.label)}${v.id === r.baseline.ver ? " " + esc(t("tagBase")) : ""} — ${esc(v.note || "")}</option>`).join("")}</select></label>
        <p class="hint planned">${esc(t("plannedN", { n: planned.length, a: vLabel(r.baseline.ver), b: vLabel(ed.ver) }))} ${planned.slice(0, 6).map((x) => `<code>${esc(x.path)}</code>`).join(" ")}${planned.length > 6 ? " …" : ""}</p>
        <h3>${esc(t("tolRules"))} <small>${esc(t("tolHint"))}</small></h3>
        <div class="tbl-wrap"><table class="rules"><thead><tr><th scope="col">${esc(t("rPattern"))}</th><th scope="col">± ${esc(t("rAbs"))}</th><th scope="col">± %</th><th scope="col">${esc(t("rUnit"))}</th><th scope="col"></th></tr></thead><tbody>${tolRows}</tbody></table></div>
        <button class="btn ghost sm" type="button" data-act="rule-add">${esc(t("ruleAdd"))}</button>
        <label class="field"><span>${esc(t("ignoreLabel"))}</span><textarea id="ignore" rows="3" spellcheck="false">${esc(ed.rules.ignore.join("\n"))}</textarea></label>
      </div>
      <div>
        <h3>${esc(t("cmpTitle"))} <small>${esc(t("cmpSub", { a: vLabel(r.baseline.ver), b: vLabel(ed.ver) }))}</small></h3>
        <div class="tbl-wrap"><table class="mini cmp"><thead><tr><th scope="col">${esc(t("tool"))}</th><th scope="col">${esc(t("cmpNow"))}</th><th scope="col">${esc(t("cmpCand"))}</th><th scope="col">${esc(t("cmpChanged"))}</th></tr></thead><tbody>` +
        (cmp.length ? cmp.map((x) => `<tr class="${x.flip ? "flip" : ""}"><th scope="row">${esc(toolName(x.tool))}</th><td>${verdictBadge(x.A, true)}</td><td>${verdictBadge(x.B, true)}${x.flip ? ` <span class="tag warn">${esc(t("flip"))}</span>` : ""}</td><td>${x.changed.length ? x.changed.slice(0, 4).map((k) => `<code>${esc(x.B.rows.find((r2) => r2.key === k)?.path || k)}</code>`).join(" ") + (x.changed.length > 4 ? " …" : "") : "—"}</td></tr>`).join("") : `<tr><td colspan="4" class="hint">${esc(t("noToolFiles"))}</td></tr>`) +
        `</tbody></table></div>
        <p class="hint">${esc(t("flipN", { n: cmp.filter((x) => x.flip).length, total: cmp.length }))}</p>
      </div>
    </div>
    <div class="row end">${ed.live ? `<button class="btn ghost sm danger" type="button" data-act="cand-cancel">${esc(t("candCancel"))}</button> <button class="btn sm" type="button" data-act="tab" data-tab="shadow">${esc(t("toShadow"))}</button>`
      : `<button class="btn sm" type="button" data-act="cand-start">${esc(t("candStart"))}</button>`}</div>`;
}
function editRules(fn) {
  const r = R();
  if (r?.cand) { const rules = structuredClone(r.cand.rules); fn(rules); F.updateCandidate(st, ui.recipe, { rules }); commit(); }
  else if (ui.draft) { fn(ui.draft.rules); render(); }
}

function renderShadow() {
  const el = $("#vp-shadow"), r = R(), c = r?.cand;
  if (!c) { el.innerHTML = `<p class="hint">${esc(t("needCand"))}</p><button class="btn sm" type="button" data-act="tab" data-tab="compare">${esc(t("toCompare"))}</button>`; return; }
  const tools = toolsWithFiles();
  if (c.stage !== "pilot") {
    el.innerHTML = `<p class="hint">${esc(t("pilotHint", { ver: vLabel(c.ver) }))}</p>
      <div class="row"><label class="field inline"><span>${esc(t("pilotTool"))}</span> <select id="pilot-tool">${tools.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label>
      <button class="btn sm" type="button" data-act="pilot-start" ${tools.length ? "" : "disabled"}>${esc(t("pilotStart"))}</button></div>`;
    return;
  }
  const fleet = F.fleetShadow(st, ui.recipe);
  const checks = st.checks.filter((x) => x.recipe === ui.recipe && x.t >= (c.since || c.t)).slice(-30).reverse();
  const g = F.gate(st, ui.recipe);
  const applied = g.items.find((x) => x.id === "applied")?.ok;
  el.innerHTML = `<p class="hint">${esc(t("pilotOn", { tool: toolName(c.pilot), ver: vLabel(c.ver), base: vLabel(r.baseline.ver) }))}</p>
    <ol class="pilot-steps">
      <li class="${applied ? "done" : ""}"><b>${esc(t("ps1"))}</b> <button class="btn ghost sm" type="button" data-act="bundle-pilot">${esc(t("dlPilot"))}</button>
        <label class="btn ghost sm file-like"><span>${esc(t("pilotImport"))}</span><input type="file" id="pilot-file" class="sr-only"></label>
        <button class="btn ghost sm" type="button" data-act="pilot-manual">${esc(t("markApplied"))}</button>
        <span class="state">${applied ? "✓ " + esc(t("appliedYes")) : esc(t("appliedNo"))}</span></li>
      <li class="${g.items.find((x) => x.id === "runs")?.ok ? "done" : ""}"><b>${esc(t("ps2", { n: g.need }))}</b> <button class="btn ghost sm" type="button" data-act="pilot-check">${esc(t("pilotCheck"))}</button>
        <span class="state">${esc(t("passCount", { n: g.passes, need: g.need }))}</span></li>
    </ol>
    <h3>${esc(t("shadowFleet"))} <small>${esc(t("shadowFleetHint"))}</small></h3>
    <div class="tbl-wrap"><table class="mini"><thead><tr><th scope="col">${esc(t("tool"))}</th><th scope="col">${esc(t("decides"))}</th><th scope="col">${esc(t("shadowCol"))}</th><th scope="col">${esc(t("clsCol"))}</th></tr></thead><tbody>` +
    fleet.map((x) => `<tr><th scope="row">${esc(toolName(x.tool))}</th><td>${verdictBadge(x.main, true)} <small>${esc(x.main?.by === "cand" ? t("byCand") : t("byBaseShort"))} ${esc(x.main?.label || "")}</small></td><td>${verdictBadge(x.shadow, true)} <small>${esc(x.shadow?.label || "")}</small></td><td>${clsText(x.cls) || "—"}</td></tr>`).join("") +
    `</tbody></table></div>
    <h3>${esc(t("shadowLog"))} <small>${esc(t("shadowLogHint"))}</small></h3>
    <div class="tbl-wrap"><table class="mini"><thead><tr><th scope="col">${esc(t("time"))}</th><th scope="col">${esc(t("tool"))}</th><th scope="col">${esc(t("decides"))}</th><th scope="col">${esc(t("shadowCol"))}</th><th scope="col">${esc(t("clsCol"))}</th></tr></thead><tbody>` +
    (checks.length ? checks.map((x) => `<tr><td>${esc(fmtTime(x.t))}</td><td>${esc(toolName(x.tool))}</td><td><span class="badge sm ${x.pass ? "ok" : "block"}">${esc(x.pass ? t("vPass") : t("vBlock"))}</span> <small>${esc(x.by === "cand" ? t("byCand") : t("byBaseShort"))}</small></td><td>${x.shadowPass == null ? "—" : `<span class="badge sm ${x.shadowPass ? "ok" : "block"}">${esc(x.shadowPass ? t("vPass") : t("vBlock"))}</span>`}</td><td>${x.cls ? clsText({ kind: x.cls }) : "—"}</td></tr>`).join("") : `<tr><td colspan="5" class="hint">${esc(t("noChecks"))}</td></tr>`) +
    `</tbody></table></div>
    <div class="row end"><button class="btn sm" type="button" data-act="tab" data-tab="switch">${esc(t("toSwitch"))}</button></div>`;
}

function renderSwitch() {
  const el = $("#vp-switch"), r = R();
  if (!r?.baseline) { el.innerHTML = `<p class="hint">${esc(t("noBaseline"))}</p>`; return; }
  let html = "";
  if (r.cand) {
    const g = F.gate(st, ui.recipe);
    html += `<h3>${esc(t("gateTitle", { ver: vLabel(r.cand.ver) }))}</h3><ul class="gate">` + g.items.map((x) => `<li class="${x.ok ? "ok" : "no"}"><span aria-hidden="true">${x.ok ? "✓" : "✗"}</span> ${esc(t("g_" + x.id + (x.id === "looser" && (x.tools?.length || x.checks) ? "Bad" : ""), { ...x, tool: r.cand.pilot ? toolName(r.cand.pilot) : "", tools: (x.tools || []).map(toolName).join(", ") || t("checksN", { n: x.checks }) }))}${x.id === "looser" && (!x.ok || x.ack) ?` <label class="chk"><input type="checkbox" id="ack" ${r.cand.ack ? "checked" : ""}> ${esc(t("ack"))}</label>` : ""}</li>`).join("") + "</ul>" +
      `<div class="row"><button class="btn" type="button" data-act="switch" ${g.ok ? "" : "disabled"}>${esc(t("switchBtn", { ver: vLabel(r.cand.ver) }))}</button>${g.ok ? "" : `<span class="hint">${esc(t("gateNotYet"))}</span>`}</div>`;
  } else html += `<p class="hint">${esc(t("noCandSwitch"))}</p>`;
  const bundles = st.bundles.filter((b) => b.recipe === ui.recipe).slice().reverse();
  const lastFleet = bundles.find((b) => b.kind === "fleet"), lastRb = bundles.find((b) => b.kind === "rollback");
  if (lastFleet && (!lastRb || lastRb.t < lastFleet.t)) {
    html += `<div class="note"><b>${esc(t("switched", { ver: vLabel(lastFleet.ver), t: fmtTime(lastFleet.t) }))}</b><div class="row">
      <button class="btn sm" type="button" data-act="bundle-dl" data-id="${lastFleet.id}">${esc(t("dlFleet", { n: lastFleet.tools.length }))}</button>
      <button class="btn ghost sm" type="button" data-act="bundle-dl" data-id="${lastFleet.id}" data-rb="1">${esc(t("dlRollback", { n: lastFleet.rollback.length }))}</button>
      <button class="btn ghost sm" type="button" data-act="bundle-apply" data-id="${lastFleet.id}">${esc(t("markApplied"))}</button></div></div>`;
  }
  if (lastRb && (!lastFleet || lastRb.t >= lastFleet.t)) {
    html += `<div class="note"><b>${esc(t("rolledBack", { ver: vLabel(lastRb.ver), t: fmtTime(lastRb.t) }))}</b><div class="row">
      <button class="btn sm" type="button" data-act="bundle-dl" data-id="${lastRb.id}">${esc(t("dlRollback", { n: lastRb.tools.length }))}</button>
      <button class="btn ghost sm" type="button" data-act="bundle-apply" data-id="${lastRb.id}">${esc(t("markApplied"))}</button></div></div>`;
  }
  const past = r.past.slice().reverse();
  html += `<h3>${esc(t("baseHistory"))}</h3><div class="tbl-wrap"><table class="mini"><thead><tr><th scope="col">${esc(t("baseVer"))}</th><th scope="col">${esc(t("period"))}</th><th scope="col">${esc(t("rules"))}</th></tr></thead><tbody>
      <tr class="cur-row"><td><b>${esc(vLabel(r.baseline.ver))}</b> <span class="tag">${esc(t("now"))}</span></td><td>${esc(fmtTime(r.baseline.t))} ~</td><td>${esc(t("ruleSummary", { n: r.baseline.rules.tol.length, m: r.baseline.rules.ignore.length }))}</td></tr>` +
    past.map((p) => `<tr><td>${esc(vLabel(p.ver))}${p.rolledBack ? ` <span class="tag warn">${esc(t("rolledBackTag"))}</span>` : ""}</td><td>${esc(fmtTime(p.t))} ~ ${esc(fmtTime(p.until))}</td><td>${esc(t("ruleSummary", { n: p.rules.tol.length, m: p.rules.ignore.length }))}</td></tr>`).join("") +
    `</tbody></table></div>
    <div class="row"><button class="btn ghost sm danger" type="button" data-act="rollback" ${r.past.length ? "" : "disabled"}>${esc(r.past.length ? t(r.past.at(-1).rolledBack ? "rollbackRedo" : "rollbackBtn", { ver: vLabel(r.past.at(-1).ver) }) : t("rollbackNone"))}</button></div>
    <h3>${esc(t("verifyBundle"))} <small>${esc(t("verifyBundleHint"))}</small></h3>
    <label class="btn ghost sm file-like"><span>${esc(t("pickZip"))}</span><input type="file" id="vb-file" accept=".zip,application/zip" class="sr-only"></label>
    <div id="vb-result">${ui.verifyResult ? verifyHtml(ui.verifyResult) : ""}</div>`;
  if (bundles.length) html += `<h3>${esc(t("bundles"))}</h3><ul class="bundles">` + bundles.slice(0, 10).map((b) => `<li>${esc(fmtTime(b.t))} · ${esc(t("kind_" + b.kind))} · ${esc(vLabel(b.ver))} <button class="btn ghost sm" type="button" data-act="bundle-dl" data-id="${b.id}">${esc(t("download"))}</button></li>`).join("") + "</ul>";
  el.innerHTML = html;
}
function verifyHtml(v) {
  return `<div class="result ${v.ok ? "pass" : "block"}"><p class="verdict">${esc(v.ok ? t("vbOk") : t("vbBad"))}</p>
    ${v.manifest ? `<p class="hint">${esc(t("vbMeta", { kind: t("kind_" + v.manifest.kind), recipe: v.manifest.recipe, ver: v.manifest.target?.version || "—", n: (v.manifest.tools || []).length }))}</p>` : ""}
    ${v.errors.length ? `<p class="msg err">${esc(v.errors.join(", "))}</p>` : ""}
    <ul class="reasons">${v.files.map((f) => `<li class="${f.ok ? "" : "bad"}">${f.ok ? "✓" : "✗"} <code>${esc(f.path)}</code>${f.ok ? "" : ` — ${esc(f.missing ? t("vbMissing") : t("vbHash", { e: f.expected.slice(0, 12), a: (f.actual || "").slice(0, 12) }))}`}</li>`).join("")}</ul></div>`;
}

// ---------- 묶음 ----------
function fileOf(item) { return item ? { fileName: item.fileName, b64: item.b64, text: item.text, label: null } : null; }
const snapLabel = (s) => F.snapMatch(st, s.recipe, s).exact?.label || null;
// 배포 묶음: 대상 버전 + 받는 장비들의 직전 파일. rollbackOnly 면 전환 때 모든 장비(시범 포함)의 직전 파일만
async function bundleFor(b, rollbackOnly = false) {
  const v = F.versionById(st, b.ver);
  const rb = b.kind === "rollback" || rollbackOnly;
  const list = rollbackOnly ? b.rollback : b.tools;
  const tools = list.map((x) => { const s = F.snapById(st, x.from); return { name: toolName(x.tool), from: s ? { ...fileOf(s), label: snapLabel(s) } : null }; });
  // 롤백 묶음 이름에는 되돌아갈 기준 버전을 쓴다
  const label = rollbackOnly ? vLabel(b.fromBase?.ver) : b.kind === "rollback" ? vLabel(b.ver) : v.label;
  return makeBundle({ kind: rb ? "rollback" : b.kind, id: b.id + (rollbackOnly ? "-rb" : ""), recipe: b.recipe, created: b.t, label, stage: b.kind === "pilot" ? "pilot (1 tool)" : b.kind === "fleet" ? "fleet" : null,
    target: rb ? null : { ...fileOf(v), label: v.label }, tools, baseline: rb ? { version: vLabel(b.ver) } : { version: v.label, rules: st.recipes[b.recipe]?.baseline?.rules } });
}
async function downloadBundle(b, rollbackOnly) {
  const z = await bundleFor(b, rollbackOnly);
  download(z.name, z.bytes, "application/zip");
  F.log(st, { type: "bundle", recipe: b.recipe, kind: rollbackOnly ? "rollback" : b.kind, ver: b.ver, name: z.name });
  commit();
}
// 수동 기록: 묶음을 장비에 복사했다고 기록 (실제 확인은 장비 파일을 다시 가져오거나 폴더 감시로)
async function applyBundle(b) {
  const v = F.versionById(st, b.ver);
  const list = b.kind === "rollback" ? b.tools.map((x) => [x.tool, F.snapById(st, x.from)]) : b.tools.map((x) => [x.tool, v]);
  for (const [tool, src] of list) if (src) F.addSnap(st, { tool, recipe: b.recipe, fileName: src.fileName, format: src.format, text: src.text, b64: src.b64, sha: src.sha, source: "manual" });
  toast(t("appliedToast", { n: list.length }));
  commit();
}

// ---------- 이력 ----------
function renderHistory() {
  const types = ["version", "snap", "check", "baseline", "cand", "pilot", "switch", "rollback", "bundle", "set"];
  $("#hs-tool").innerHTML = `<option value="">${esc(t("allTools"))}</option>` + st.tools.map((x) => `<option value="${x.id}" ${x.id === ui.histTool ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  $("#hs-type").innerHTML = `<option value="">${esc(t("allKinds"))}</option>` + types.map((k) => `<option value="${k}" ${k === ui.histType ? "selected" : ""}>${esc(t("ev_" + k))}</option>`).join("");
  const list = st.history.filter((h) => (!h.recipe || h.recipe === ui.recipe) && (!ui.histTool || h.tool === ui.histTool) && (!ui.histType || h.type === ui.histType)).slice().reverse();
  $("#hist").innerHTML = `<thead><tr><th scope="col">${esc(t("time"))}</th><th scope="col">${esc(t("kind"))}</th><th scope="col">${esc(t("tool"))}</th><th scope="col">${esc(t("detail"))}</th></tr></thead><tbody>` +
    (list.length ? list.slice(0, ui.histLimit).map((h) => `<tr class="ev-${h.type}${h.changed ? " changed" : ""}"><td>${esc(fmtTime(h.t))}</td><td>${esc(t("ev_" + h.type))}</td><td>${esc(h.tool ? toolName(h.tool) : "")}</td><td>${esc(evText(h, { vLabel, toolName, snap: (id) => F.snapById(st, id) }))}</td></tr>`).join("") : `<tr><td colspan="4" class="hint">${esc(t("noHistory"))}</td></tr>`) + "</tbody>";
  $("#hs-more").hidden = list.length <= ui.histLimit;
}

// ---------- 가져오기 ----------
async function readItems(entries) {
  const items = [];
  for (const { file, rel } of entries) {
    const it = { name: rel || file.name, include: true };
    if (file.size > MAX_FILE) { items.push({ ...it, include: false, error: t("tooBig") }); continue; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { text, encoding } = decode(bytes);
    if (/\u0000/.test(text.slice(0, 2000))) { items.push({ ...it, include: false, error: t("binary") }); continue; }
    const p = parseRecipe(text, { fileName: file.name });
    const parts = (rel || file.name).split(/[\\/]/);
    const sub = parts.length >= 3 ? parts[parts.length - 2] : "";
    const vh = versionHint(file.name);
    const role = /^_?versions?$/i.test(sub) ? "version" : sub ? "tool" : vh || !st.tools.length ? "version" : "tool";
    items.push({ ...it, fileName: file.name, bytes, text, encoding, format: p.format, parse: p, recipe: recipeName(file.name, p.params), role, label: vh, tool: sub && role === "tool" ? sub : st.tools[0]?.name || "EQ-01", include: Object.keys(p.params).length > 0, sha: await sha256(bytes), b64: bytesToB64(bytes) });
  }
  return items;
}
function renderImport() {
  const items = ui.importItems;
  $("#dl-recipes").innerHTML = Object.keys(st.recipes).map((n) => `<option value="${esc(n)}">`).join("");
  $("#dl-tools").innerHTML = st.tools.map((x) => `<option value="${esc(x.name)}">`).join("");
  $("#im-table").innerHTML = `<thead><tr><th scope="col"><span class="sr-only">${esc(t("include"))}</span></th><th scope="col">${esc(t("file"))}</th><th scope="col">${esc(t("format"))}</th><th scope="col">${esc(t("recipe"))}</th><th scope="col">${esc(t("role"))}</th><th scope="col">${esc(t("roleTarget"))}</th><th scope="col">${esc(t("readResult"))}</th></tr></thead><tbody>` +
    items.map((x, i) => x.error ? `<tr class="bad"><td></td><td>${esc(x.name)}</td><td colspan="5">${esc(x.error)}</td></tr>` : `<tr>
      <td><input type="checkbox" data-im="${i}" data-k="include" ${x.include ? "checked" : ""} aria-label="${esc(t("include") + " " + x.name)}"></td>
      <td>${esc(x.name)}<small class="block">${esc(x.encoding)} · ${esc(x.sha.slice(0, 12))}</small></td>
      <td><select data-im="${i}" data-k="format" aria-label="${esc(t("format"))}">${FORMATS.map((f) => `<option value="${f}" ${f === x.format ? "selected" : ""}>${f === "kv" ? "key=value" : f.toUpperCase()}</option>`).join("")}</select></td>
      <td><input data-im="${i}" data-k="recipe" value="${esc(x.recipe)}" list="dl-recipes" aria-label="${esc(t("recipe"))}" size="12"></td>
      <td><select data-im="${i}" data-k="role" aria-label="${esc(t("role"))}"><option value="version" ${x.role === "version" ? "selected" : ""}>${esc(t("roleVersion"))}</option><option value="tool" ${x.role === "tool" ? "selected" : ""}>${esc(t("roleTool"))}</option></select></td>
      <td>${x.role === "version" ? `<input data-im="${i}" data-k="label" value="${esc(x.label)}" placeholder="${esc(t("labelPh"))}" aria-label="${esc(t("roleVersion"))}" size="8">` : `<input data-im="${i}" data-k="tool" value="${esc(x.tool)}" list="dl-tools" aria-label="${esc(t("tool"))}" size="8">`}</td>
      <td>${esc(t("readN", { n: Object.keys(x.parse.params).length }))}${x.parse.errors.length ? `<details class="errs"><summary class="st-out">${esc(t("errN", { n: x.parse.errors.length }))}</summary><ul>${x.parse.errors.slice(0, 50).map((e) => `<li>${esc(t("lineN", { n: e.line }))}: ${esc(t("perr_" + e.code))}${e.detail ? ` <code>${esc(e.detail)}</code>` : ""}</li>`).join("")}</ul></details>` : ""}</td></tr>`).join("") + "</tbody>";
}
async function openImport(entries) {
  if (!entries.length) return;
  ui.importItems = await readItems(entries);
  $("#im-err").textContent = "";
  renderImport();
  $("#import").showModal();
}
function doImport() {
  const errs = [];
  let n = 0;
  // 버전을 먼저 (같은 묶음 안의 장비 파일이 새 버전을 기준으로 판정되도록)
  const items = ui.importItems.filter((x) => x.include && !x.error).sort((a, b) => (a.role === "version" ? 0 : 1) - (b.role === "version" ? 0 : 1));
  for (const x of items) {
    const recipe = x.recipe.trim();
    if (!recipe) { errs.push(`${x.name}: ${t("needRecipe")}`); continue; }
    const file = { recipe, fileName: x.fileName, format: x.format, text: x.text, b64: x.b64, sha: x.sha };
    try {
      if (x.role === "version") F.addVersion(st, { ...file, label: x.label });
      else { const tool = F.addTool(st, x.tool || "EQ-01"); F.addSnap(st, { ...file, tool: tool.id }); }
      n++;
    } catch (e) { errs.push(`${x.name}: ${e.code === "verExists" ? t("verExists", { label: e.label }) : e.message}`); }
  }
  if (n) { st.origin = "user"; if (!ui.recipe || !st.recipes[ui.recipe]) ui.recipe = items[0]?.recipe.trim(); }
  if (n) commit();
  if (errs.length) { $("#im-err").textContent = errs.join(" · "); ui.importItems = ui.importItems.filter((x) => errs.some((e) => e.startsWith(x.name + ":"))); renderImport(); return; }
  $("#import").close();
  toast(t("importedN", { n }));
}

// 폴더 감시 (File System Access API, Chromium 계열). 하위 폴더 이름 = 장비, versions 폴더 = 버전
async function scanFolder(first) {
  const w = ui.watch;
  if (!w) return;
  const found = [];
  try {
    for await (const [name, h] of w.dir.entries()) {
      if (h.kind !== "directory") continue;
      for await (const [fn, fh] of h.entries()) {
        if (fh.kind !== "file") continue;
        const f = await fh.getFile();
        const key = `${name}/${fn}`, sig = `${f.lastModified}:${f.size}`;
        if (w.seen.get(key) === sig) continue;
        w.seen.set(key, sig);
        found.push({ file: f, rel: `${w.dir.name}/${key}`, sub: name });
      }
    }
  } catch (e) { ui.watch = null; clearInterval(w.timer); toast(t("watchLost")); renderWatch(); return; }
  w.last = Date.now();
  renderWatch();
  if (!found.length) return;
  if (first) { await openImport(found); return; }
  // 이후 변경: 등록된 레시피의 장비 파일이면 바로 기록
  let n = 0;
  for (const it of await readItems(found)) {
    if (it.error || it.role !== "tool" || !st.recipes[it.recipe]) continue;
    const tool = F.addTool(st, it.tool);
    const cur = F.currentSnap(st, tool.id, it.recipe);
    if (cur && cur.sha === it.sha) continue;
    F.addSnap(st, { recipe: it.recipe, tool: tool.id, fileName: it.fileName, format: it.format, text: it.text, b64: it.b64, sha: it.sha, source: "watch" });
    n++;
  }
  if (n) { toast(t("watchChanged", { n })); commit(); }
}
function renderWatch() {
  const w = ui.watch, el = $("#watch-state");
  el.hidden = !w;
  if (w) el.textContent = t("watchState", { name: w.dir.name, t: w.last ? fmtTime(w.last).slice(11) + ":" + String(new Date(w.last).getSeconds()).padStart(2, "0") : "…" });
  $("#watch").textContent = w ? t("watchStop") : t("watch");
}

// ---------- 예시 · 백업 ----------
async function loadSample(ask = true) {
  if (ask && st.origin === "user" && !confirm(t("sampleConfirm"))) return;
  st = await buildSample();
  st.origin = "sample";
  ui.recipe = SAMPLE_RECIPE; ui.A = ""; ui.B = ""; ui.ck = null; ui.draft = null; ui.verifyResult = null;
  commit();
}

// ---------- 이벤트 ----------
function bind() {
  $("#lang").addEventListener("change", (e) => { setLang(e.target.value); store.put("lang", lang()); applyI18n(); render(); });
  $("#theme").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next; store.put("theme", next);
  });
  $("#recipe").addEventListener("change", (e) => { ui.recipe = e.target.value; ui.A = ui.B = ""; ui.ck = null; ui.draft = null; render(); });
  $("#load-sample").addEventListener("click", () => loadSample());
  $("#files").addEventListener("change", (e) => { openImport([...e.target.files].map((file) => ({ file, rel: "" }))).catch(fail); e.target.value = ""; });
  $("#folder").addEventListener("change", (e) => { openImport([...e.target.files].map((file) => ({ file, rel: file.webkitRelativePath }))).catch(fail); e.target.value = ""; });
  if ("showDirectoryPicker" in window) {
    $("#watch").hidden = false;
    $("#watch").addEventListener("click", async () => {
      if (ui.watch) { clearInterval(ui.watch.timer); ui.watch = null; renderWatch(); return; }
      let dir;
      try { dir = await window.showDirectoryPicker({ mode: "read" }); } catch { return; }
      ui.watch = { dir, seen: new Map(), last: 0 };
      ui.watch.timer = setInterval(() => scanFolder(false).catch(fail), 5000);
      await scanFolder(true);
    });
  }
  // 끌어다 놓기
  let depth = 0;
  document.body.dataset.drop = t("dropHere");
  addEventListener("dragenter", (e) => { if (e.dataTransfer?.types?.includes("Files")) { depth++; document.body.classList.add("dragging"); } });
  addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; document.body.classList.remove("dragging"); } });
  addEventListener("dragover", (e) => e.preventDefault());
  addEventListener("drop", async (e) => {
    e.preventDefault(); depth = 0; document.body.classList.remove("dragging");
    const entries = [];
    const walk = async (entry, path) => {
      if (entry.isFile) entries.push({ file: await new Promise((res, rej) => entry.file(res, rej)), rel: path + entry.name });
      else if (entry.isDirectory) { const rd = entry.createReader(); let batch; do { batch = await new Promise((res, rej) => rd.readEntries(res, rej)); for (const x of batch) await walk(x, path + entry.name + "/"); } while (batch.length); }
    };
    const its = [...(e.dataTransfer?.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
    if (its.length) for (const x of its) await walk(x, "");
    else for (const file of e.dataTransfer.files) entries.push({ file, rel: "" });
    openImport(entries.map((x) => ({ ...x, rel: x.rel.includes("/") ? x.rel : "" }))).catch(fail);
  });

  // 가져오기 대화상자
  $("#im-table").addEventListener("change", (e) => {
    const i = e.target.dataset.im, k = e.target.dataset.k;
    if (i === undefined) return;
    const x = ui.importItems[+i];
    x[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (k === "format") { x.parse = parseRecipe(x.text, { format: x.format, fileName: x.fileName }); }
    if (k === "role" || k === "format") renderImport();
  });
  $("#im-ok").addEventListener("click", () => { try { doImport(); } catch (e) { fail(e); } });

  // 검사 전 검증
  $("#ck-tool").addEventListener("change", () => { $("#ck-current").disabled = !F.currentSnap(st, $("#ck-tool").value, ui.recipe); });
  $("#ck-current").addEventListener("click", () => {
    const s = F.currentSnap(st, $("#ck-tool").value, ui.recipe);
    if (s) runCheck($("#ck-tool").value, { params: F.paramsOf(s), sha: s.sha, fileName: s.fileName });
  });
  $("#ck-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE) { toast(t("tooBig")); return; }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const p = parseRecipe(decode(bytes).text, { fileName: f.name });
    if (p.errors.length) toast(t("ckParseErr", { n: p.errors.length, line: p.errors[0].line }));
    runCheck($("#ck-tool").value, { params: p.params, sha: await sha256(bytes), fileName: f.name });
  });

  // Diff
  $("#df-a").addEventListener("change", (e) => { ui.A = e.target.value; renderDiff(); });
  $("#df-b").addEventListener("change", (e) => { ui.B = e.target.value; renderDiff(); });
  $("#df-filter").addEventListener("change", (e) => { ui.filter = e.target.value; renderDiff(); });
  $("#df-rules").addEventListener("change", (e) => { ui.useRules = e.target.checked; renderDiff(); });

  // 탭 (화살표 키)
  const tabs = ["repro", "compare", "shadow", "switch"];
  for (const k of tabs) $(`#vt-${k}`).addEventListener("click", () => setTab(k));
  $(".vtabs").addEventListener("keydown", (e) => {
    const i = tabs.indexOf(ui.tab);
    const j = e.key === "ArrowRight" ? (i + 1) % 4 : e.key === "ArrowLeft" ? (i + 3) % 4 : e.key === "Home" ? 0 : e.key === "End" ? 3 : -1;
    if (j < 0) return;
    e.preventDefault(); setTab(tabs[j]); $(`#vt-${tabs[j]}`).focus();
  });

  // 비교 탭 입력
  $("#vp-compare").addEventListener("change", (e) => {
    const el = e.target;
    if (el.id === "cand-ver") { if (R()?.cand) { F.updateCandidate(st, ui.recipe, { ver: el.value }); commit(); } else { ui.draft.ver = el.value; render(); } return; }
    if (el.id === "ignore") { editRules((r) => { r.ignore = el.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean); }); return; }
    if (el.dataset.rule !== undefined) editRules((r) => { const x = r.tol[+el.dataset.rule]; const k = el.dataset.k; x[k] = k === "abs" || k === "pct" ? (el.value === "" ? null : Number(el.value)) : el.value.trim(); });
  });
  $("#vp-switch").addEventListener("change", async (e) => {
    if (e.target.id === "ack") { F.updateCandidate(st, ui.recipe, { ack: e.target.checked }); commit(); }
    if (e.target.id === "vb-file") {
      const f = e.target.files[0]; e.target.value = "";
      if (f) { ui.verifyResult = await verifyBundle(new Uint8Array(await f.arrayBuffer())); renderSwitch(); }
    }
  });
  $("#vp-shadow").addEventListener("change", async (e) => {
    if (e.target.id !== "pilot-file") return;
    const f = e.target.files[0]; e.target.value = "";
    const c = R()?.cand;
    if (!f || !c) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const { text } = decode(bytes);
    const p = parseRecipe(text, { fileName: f.name });
    F.addSnap(st, { recipe: ui.recipe, tool: c.pilot, fileName: f.name, format: p.format, text, b64: bytesToB64(bytes), sha: await sha256(bytes) });
    commit();
  });

  // 버튼 (data-act)
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    act(b.dataset.act, b.dataset, b).catch(fail);
  });

  // 이력
  $("#hs-tool").addEventListener("change", (e) => { ui.histTool = e.target.value; renderHistory(); });
  $("#hs-type").addEventListener("change", (e) => { ui.histType = e.target.value; renderHistory(); });
  $("#hs-more").addEventListener("click", () => { ui.histLimit += 200; renderHistory(); });

  // 설정 · 도움말
  $("#open-help").addEventListener("click", () => { $("#help-body").innerHTML = helpHtml(); $("#help").showModal(); });
  $("#open-settings").addEventListener("click", async () => {
    $("#s-runs").value = st.settings.pilotRuns;
    $("#settings-err").textContent = "";
    const errs = (await store.get("errors")) || [];
    $("#err-count").textContent = t("errCount", { n: errs.length, p: (await store.persistent()) ? t("persistYes") : t("persistNo") });
    $("#settings").showModal();
  });
  $("#settings-save").addEventListener("click", (e) => {
    const n = Number($("#s-runs").value);
    if (!Number.isInteger(n) || n < 1 || n > 50) { e.preventDefault(); $("#settings-err").textContent = t("runsErr"); return; }
    st.settings.pilotRuns = n; commit();
  });
  $("#backup-export").addEventListener("click", () => download(`recipe-golden-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "recipe-golden", schema: F.SCHEMA, exported: new Date().toISOString(), state: st }), "application/json"));
  $("#backup-import").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const b = JSON.parse(await f.text());
      if (b?.app !== "recipe-golden" || !b.state) throw new Error(t("notBackup"));
      st = F.migrate(b.state); ui.recipe = ""; ui.ck = null; ui.draft = null;
      commit(); $("#settings").close(); toast(t("backupLoaded"));
    } catch (err) { $("#settings-err").textContent = err.message; }
  });
  $("#reset-all").addEventListener("click", async () => {
    if (!confirm(t("resetConfirm"))) return;
    await store.clearAll();
    st = F.emptyState(); st.origin = "user"; ui.recipe = ""; ui.ck = null; ui.draft = null;
    commit(); $("#settings").close();
  });
}

async function act(a, d) {
  const r = R();
  if (a === "diff-ver") { ui.A = r?.baseline ? `v:${r.baseline.ver}` : ui.A; ui.B = `v:${d.ver}`; if (ui.A === ui.B) ui.filter = "all"; renderDiff(); $("#diff").scrollIntoView({ behavior: "smooth" }); }
  else if (a === "diff-cell") { ui.A = `v:${d.ver}`; ui.B = `t:${d.tool}`; ui.filter = "diff"; renderDiff(); $("#diff").scrollIntoView({ behavior: "smooth" }); }
  else if (a === "diff-base") { const dec = F.deciding(st, ui.recipe, d.tool); ui.A = dec ? `v:${dec.ver}` : ui.A; ui.B = `t:${d.tool}`; ui.filter = "diff"; renderDiff(); $("#diff").scrollIntoView({ behavior: "smooth" }); }
  else if (a === "tab") { setTab(d.tab); $("#verify").scrollIntoView({ behavior: "smooth" }); }
  else if (a === "ck-save") {
    const c = ui.ck;
    const out = { app: "recipe-golden", type: "pre-run-check", recipe: c.recipe, tool: toolName(c.tool), file: c.fileName, sha256: c.sha || null, time: new Date(c.t).toISOString(), result: c.pass ? "PASS" : "BLOCK", decidedBy: c.by === "cand" ? "candidate (pilot)" : "baseline", baselineVersion: c.main.label, reasons: c.reasons, shadow: c.shadow ? { version: c.shadow.label, result: c.shadow.pass ? "PASS" : "BLOCK", class: c.cls } : null };
    download(`check_${toolName(c.tool)}_${new Date(c.t).toISOString().slice(0, 19).replace(/[:T]/g, "")}.json`, JSON.stringify(out, null, 2), "application/json");
  }
  else if (a === "ck-diff") { ui.A = `v:${ui.ck.ver}`; ui.B = "c:check"; renderDiff(); $("#diff").scrollIntoView({ behavior: "smooth" }); }
  else if (a === "set-save") { F.saveSet(st, $("#set-name").value); commit(); toast(t("setSavedToast")); }
  else if (a === "set-load") { F.loadSet(st, d.id); commit(); toast(t("setLoadedToast")); }
  else if (a === "set-del") { st.sets = st.sets.filter((s) => s.id !== d.id); commit(); }
  else if (a === "rule-add") editRules((rules) => rules.tol.push({ pattern: "", abs: null, pct: null, unit: "" }));
  else if (a === "rule-del") editRules((rules) => rules.tol.splice(+d.i, 1));
  else if (a === "cand-start") { F.startCandidate(st, ui.recipe, ui.draft.ver, ui.draft.rules); ui.draft = null; commit(); }
  else if (a === "cand-cancel") { if (confirm(t("candCancelConfirm"))) { F.cancelCandidate(st, ui.recipe); commit(); } }
  else if (a === "pilot-start") {
    F.startPilot(st, ui.recipe, $("#pilot-tool").value);
    commit();
  }
  else if (a === "bundle-pilot") { const b = [...st.bundles].reverse().find((x) => x.recipe === ui.recipe && x.kind === "pilot" && x.ver === r.cand.ver); if (b) await downloadBundle(b); }
  else if (a === "pilot-manual") { const b = [...st.bundles].reverse().find((x) => x.recipe === ui.recipe && x.kind === "pilot" && x.ver === r.cand.ver); if (b) await applyBundle(b); }
  else if (a === "pilot-check") {
    const s = F.currentSnap(st, r.cand.pilot, ui.recipe);
    if (s) await runCheck(r.cand.pilot, { params: F.paramsOf(s), sha: s.sha, fileName: s.fileName });
  }
  else if (a === "switch") { if (!confirm(t("switchConfirm", { ver: vLabel(r.cand.ver) }))) return; F.switchBaseline(st, ui.recipe); commit(); toast(t("switchedToast")); }
  else if (a === "rollback") { if (!confirm(t("rollbackConfirm", { ver: vLabel(r.past.at(-1).ver) }))) return; F.rollback(st, ui.recipe); commit(); toast(t("rolledBackToast")); }
  else if (a === "bundle-dl") { const b = st.bundles.find((x) => x.id === d.id); if (b) await downloadBundle(b, !!d.rb); }
  else if (a === "bundle-apply") { const b = st.bundles.find((x) => x.id === d.id); if (b) await applyBundle(b); }
}

// ---------- 시작 ----------
async function start() {
  const theme = await store.get("theme");
  if (theme) document.documentElement.dataset.theme = theme;
  setLang((await store.get("lang")) || (navigator.language?.startsWith("ko") ? "ko" : "en"));
  $("#lang").value = lang();
  applyI18n();
  $("#version").textContent = `v${APP_VERSION}`;
  bind();
  const saved = await store.get("state");
  if (saved) { st = F.migrate(saved); render(); }
  else await loadSample(false);
  if (!(await store.get("onboarded"))) { $("#onboard").showModal(); $("#onboard").addEventListener("close", () => store.put("onboarded", true), { once: true }); }
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) { toast(t("updateReady"), 8000); w.postMessage("skip"); } });
      });
    }).catch(() => {});
  }
}
start().catch(fail);
