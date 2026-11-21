// 앱 상태와 기준 관리 흐름 (화면 없이 테스트할 수 있게 순수 함수로).
// 상태는 JSON 하나: 레시피 · 버전 · 장비 · 장비 파일(스냅숏) · 검증 기록 · 이력 · 재현 세트 · 배포 묶음.
// 기준 변경은 후보(cand)로 시작해 비교 → 1대 시범(Shadow) → 전환 순서로 가고, 이전 기준으로 언제든 되돌린다.

import { parseRecipe } from "./parse.js";
import { diffParams, verdict, matchVersion, compileRules } from "./diff.js";

export const SCHEMA = 1;
export const emptyState = () => ({ schema: SCHEMA, recipes: {}, versions: [], tools: [], snaps: [], current: {}, checks: [], history: [], sets: [], bundles: [], settings: { pilotRuns: 3 } });

// 예전 스키마 · 빠진 필드를 채운다 (필드 추가만 하므로 오래된 백업도 읽힌다)
export function migrate(s) {
  if (!s || typeof s !== "object") return emptyState();
  const e = emptyState();
  for (const k of Object.keys(e)) if (s[k] === undefined) s[k] = e[k];
  s.settings = { ...e.settings, ...s.settings };
  s.schema = SCHEMA;
  return s;
}

let seq = 0;
export const newId = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

const cache = new WeakMap();
export function paramsOf(item) {
  if (!item) return {};
  let c = cache.get(item);
  if (!c) { c = parseRecipe(item.text, { format: item.format, fileName: item.fileName }); cache.set(item, c); }
  return c.params;
}

export const recipeOf = (st, name) => (st.recipes[name] ||= { name, baseline: null, past: [], cand: null });
export const versionsOf = (st, recipe) => st.versions.filter((v) => v.recipe === recipe).sort((a, b) => a.t - b.t);
export const versionById = (st, id) => st.versions.find((v) => v.id === id) || null;
export const snapById = (st, id) => st.snaps.find((s) => s.id === id) || null;
export const toolById = (st, id) => st.tools.find((t) => t.id === id) || null;
export const currentSnap = (st, tool, recipe) => snapById(st, st.current[tool]?.[recipe]);

export function log(st, ev, now = Date.now()) {
  st.history.push({ t: now, ...ev });
  if (st.history.length > 5000) st.history.splice(0, st.history.length - 5000);
}

export function addTool(st, name) {
  const n = String(name || "").trim();
  let t = st.tools.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!t) { t = { id: newId("t"), name: n }; st.tools.push(t); }
  return t;
}

// file = { recipe, label, fileName, format, text, b64, sha, note }
export function addVersion(st, file, now = Date.now()) {
  const r = recipeOf(st, file.recipe);
  const list = versionsOf(st, file.recipe);
  const label = String(file.label || "").trim() || `v${list.length + 1}`;
  const dup = list.find((v) => v.label.toLowerCase() === label.toLowerCase());
  if (dup) throw Object.assign(new Error(`version exists: ${label}`), { code: "verExists", label });
  const v = { id: newId("v"), recipe: file.recipe, label, t: file.t ?? now, note: file.note || "", fileName: file.fileName, format: file.format, text: file.text, b64: file.b64 || "", sha: file.sha || "" };
  st.versions.push(v);
  log(st, { type: "version", recipe: v.recipe, ver: v.id, label }, now);
  if (!r.baseline) setBaseline(st, file.recipe, v.id, defaultRules(), now, "first");
  return v;
}

export const defaultRules = () => ({ tol: [], ignore: ["Header.SavedAt", "Header.SavedBy", "*.Comment"] });

export function setBaseline(st, recipe, ver, rules, now = Date.now(), why = "direct") {
  const r = recipeOf(st, recipe);
  if (r.baseline) r.past.push({ ...r.baseline, until: now });
  r.baseline = { ver, rules: structuredClone(rules || defaultRules()), t: now };
  log(st, { type: "baseline", recipe, ver, why, label: versionById(st, ver)?.label }, now);
}

// 장비 파일 등록. 이전 파일과 내용이 다르면 "변경" 이력
export function addSnap(st, file, now = Date.now()) {
  const tool = file.tool;
  const prev = currentSnap(st, tool, file.recipe);
  const s = { id: newId("s"), tool, recipe: file.recipe, fileName: file.fileName, format: file.format, text: file.text, b64: file.b64 || "", sha: file.sha || "", t: file.t ?? now, source: file.source || "import" };
  st.snaps.push(s);
  (st.current[tool] ||= {})[file.recipe] = s.id;
  const changed = prev && prev.text !== s.text;
  log(st, { type: "snap", recipe: s.recipe, tool, snap: s.id, source: s.source, changed: !!changed, prev: prev?.id }, s.t);
  return s;
}

// 이 장비를 판정하는 기준: 시범 장비면 후보, 아니면 현재 기준
export function deciding(st, recipe, tool) {
  const r = st.recipes[recipe];
  if (!r) return null;
  if (r.cand && r.cand.stage === "pilot" && r.cand.pilot === tool) return { ...r.cand, by: "cand" };
  return r.baseline ? { ...r.baseline, by: "base" } : null;
}

export function judge(st, b, params) {
  if (!b) return null;
  const v = versionById(st, b.ver);
  const rows = diffParams(paramsOf(v), params, compileRules(b.rules));
  return { ...verdict(rows), rows, ver: b.ver, label: v?.label, by: b.by };
}

// 장비 파일이 어느 등록 버전과 같은지 (기준 규칙의 무시 항목 반영).
// 버전 수 × 항목 수만큼 비교하므로 (파일, 규칙, 버전 목록) 이 같으면 다시 계산하지 않는다
const matchMemo = new Map();
export function snapMatch(st, recipe, snap) {
  const r = st.recipes[recipe];
  const rulesRaw = (r?.baseline || r?.cand)?.rules;
  const vers = versionsOf(st, recipe);
  const key = `${snap.id}|${JSON.stringify(rulesRaw)}|${vers.map((v) => v.id).join(",")}`;
  let match = matchMemo.get(key);
  if (!match) {
    if (matchMemo.size > 5000) matchMemo.clear();
    match = matchVersion(paramsOf(snap), vers.map((v) => ({ ...v, params: paramsOf(v) })), compileRules(rulesRaw));
    matchMemo.set(key, match);
  }
  return match;
}

// 장비 현황: 현재 파일, 버전 식별, 판정 (+ 후보가 있으면 후보 판정)
export function toolStatus(st, recipe, tool) {
  const snap = currentSnap(st, tool, recipe);
  if (!snap) return { snap: null };
  const r = st.recipes[recipe];
  const params = paramsOf(snap);
  const match = snapMatch(st, recipe, snap);
  const dec = deciding(st, recipe, tool);
  const main = judge(st, dec, params);
  let shadow = null;
  if (r?.cand) shadow = judge(st, dec?.by === "cand" ? { ...r.baseline, by: "base" } : { ...r.cand, by: "cand" }, params);
  return { snap, params, match, main, shadow, cls: shadow ? classify(st, recipe, main, shadow) : null };
}

// 두 판정이 다를 때 이유 분류
//  updated: 후보가 통과 — 파일이 이미 새 버전 값 (시범 장비)
//  looser : 후보가 통과 — 허용 오차를 넓히거나 무시 항목을 늘려서 (놓침 위험)
//  needsFile: 후보가 차단 — 새 버전 값으로 아직 안 바뀐 파일
//  tighter: 후보가 차단 — 규칙이 더 엄격해져서
export function classify(st, recipe, main, shadow) {
  if (!main || !shadow || main.pass === shadow.pass) return null;
  const cand = main.by === "cand" ? main : shadow, base = main.by === "cand" ? shadow : main;
  const r = st.recipes[recipe];
  const bv = paramsOf(versionById(st, r.baseline?.ver)), cv = paramsOf(versionById(st, r.cand?.ver));
  const lower = (o) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k.toLowerCase(), x]));
  const BL = lower(bv), CL = lower(cv);
  const valueChanged = (key) => JSON.stringify(BL[key] && [BL[key].v, BL[key].u]) !== JSON.stringify(CL[key] && [CL[key].v, CL[key].u]);
  if (cand.pass) {
    const keys = base.blocking.map((x) => x.key);
    const looser = keys.filter((k) => { const row = cand.rows.find((x) => x.key === k); return row && row.status !== "same"; });
    return looser.length ? { kind: "looser", keys: looser } : { kind: "updated", keys };
  }
  const keys = cand.blocking.map((x) => x.key);
  const tighter = keys.filter((k) => !valueChanged(k));
  return tighter.length ? { kind: "tighter", keys: tighter } : { kind: "needsFile", keys };
}

// 검사 전 검증. file = { params, text, sha, fileName }. 기록을 남기고 결과를 돌려준다
export function preCheck(st, recipe, tool, file, now = Date.now()) {
  const dec = deciding(st, recipe, tool);
  if (!dec) return { error: "noBaseline" };
  const params = file.params || parseRecipe(file.text, { fileName: file.fileName }).params;
  const main = judge(st, dec, params);
  const r = st.recipes[recipe];
  const shadow = r.cand ? judge(st, dec.by === "cand" ? { ...r.baseline, by: "base" } : { ...r.cand, by: "cand" }, params) : null;
  const cls = shadow ? classify(st, recipe, main, shadow) : null;
  const rec = {
    t: now, recipe, tool, sha: file.sha || "", fileName: file.fileName || "", by: main.by, ver: main.ver, pass: main.pass,
    shadowPass: shadow ? shadow.pass : null, cls: cls?.kind || null, clsKeys: cls?.keys || [],
    reasons: main.blocking.slice(0, 50).map(({ key, path, status, base, act, delta, allow, unit, line, unitA, unitB }) => ({ key, path, status, base, act, delta, allow, unit, line, unitA, unitB })),
  };
  st.checks.push(rec);
  if (st.checks.length > 5000) st.checks.splice(0, st.checks.length - 5000);
  log(st, { type: "check", recipe, tool, pass: rec.pass, by: rec.by, n: rec.reasons.length }, now);
  return { ...rec, main, shadow };
}

export function startCandidate(st, recipe, ver, rules, now = Date.now()) {
  const r = recipeOf(st, recipe);
  if (!r.baseline) throw Object.assign(new Error("no baseline"), { code: "noBaseline" });
  r.cand = { ver, rules: structuredClone(rules), t: now, stage: "compare", pilot: null, since: null, ack: false };
  log(st, { type: "cand", recipe, ver, label: versionById(st, ver)?.label, what: "start" }, now);
  return r.cand;
}
export function updateCandidate(st, recipe, patch, now = Date.now()) {
  const c = st.recipes[recipe]?.cand;
  if (!c) return null;
  Object.assign(c, structuredClone(patch));
  if (patch.ver || patch.rules) { c.ack = false; if (c.stage === "pilot") c.since = now; } // 내용이 바뀌면 시범 기록을 새로 센다
  return c;
}
export function cancelCandidate(st, recipe, now = Date.now()) {
  const r = st.recipes[recipe];
  if (!r?.cand) return;
  log(st, { type: "cand", recipe, ver: r.cand.ver, what: "cancel" }, now);
  r.cand = null;
}

export function startPilot(st, recipe, tool, now = Date.now()) {
  const c = st.recipes[recipe]?.cand;
  if (!c) throw Object.assign(new Error("no candidate"), { code: "noCand" });
  // 시범 장비의 시범 전 파일을 기억한다 (전환 뒤 롤백 묶음은 이 파일로 되돌린다)
  c.stage = "pilot"; c.pilot = tool; c.since = now; c.ack = false; c.pilotFrom = currentSnap(st, tool, recipe)?.id || null;
  st.bundles.push({ id: newId("b"), t: now, recipe, kind: "pilot", ver: c.ver, tools: [{ tool, from: c.pilotFrom }] });
  log(st, { type: "pilot", recipe, tool, ver: c.ver, label: versionById(st, c.ver)?.label }, now);
  return c;
}

// 현재 장비 상태 전체에 대한 Shadow 요약 (놓침 위험 장비)
export function fleetShadow(st, recipe) {
  return st.tools.map((t) => ({ tool: t.id, ...toolStatus(st, recipe, t.id) })).filter((x) => x.snap);
}

// 전환 조건. 모두 ok 여야 전환 버튼이 켜진다
export function gate(st, recipe) {
  const r = st.recipes[recipe], c = r?.cand;
  if (!c) return { ok: false, items: [] };
  const need = Math.max(1, st.settings.pilotRuns | 0);
  const items = [];
  const pilotSnap = c.pilot ? currentSnap(st, c.pilot, recipe) : null;
  const applied = !!pilotSnap && judge(st, { ver: c.ver, rules: { tol: [], ignore: c.rules.ignore } }, paramsOf(pilotSnap)).blocking.length === 0;
  items.push({ id: "pilot", ok: c.stage === "pilot" && !!c.pilot });
  items.push({ id: "applied", ok: applied });
  const runs = st.checks.filter((x) => x.recipe === recipe && x.tool === c.pilot && x.by === "cand" && x.t >= (c.since || 0));
  const passes = runs.filter((x) => x.pass).length, blocks = runs.length - passes;
  items.push({ id: "runs", ok: passes >= need, passes, need });
  items.push({ id: "noBlock", ok: blocks === 0, blocks });
  const looser = fleetShadow(st, recipe).filter((x) => x.cls?.kind === "looser");
  const looserChecks = st.checks.filter((x) => x.recipe === recipe && x.t >= (c.since || c.t) && x.cls === "looser").length;
  items.push({ id: "looser", ok: (looser.length === 0 && looserChecks === 0) || c.ack, tools: looser.map((x) => x.tool), checks: looserChecks, ack: c.ack });
  return { ok: items.every((x) => x.ok), items, passes, need };
}

// 전환: 후보를 기준으로. 전체 배포 묶음과 롤백 묶음 내용을 같이 만든다 (각 장비의 직전 파일)
export function switchBaseline(st, recipe, now = Date.now(), { force = false } = {}) {
  const r = st.recipes[recipe], c = r?.cand;
  if (!c) throw Object.assign(new Error("no candidate"), { code: "noCand" });
  if (!force && !gate(st, recipe).ok) throw Object.assign(new Error("gate not passed"), { code: "gate" });
  const fromBase = r.baseline;
  const tools = st.tools.filter((t) => currentSnap(st, t.id, recipe)).map((t) => ({ tool: t.id, from: t.id === c.pilot && c.pilotFrom ? c.pilotFrom : currentSnap(st, t.id, recipe).id }));
  r.past.push({ ...fromBase, until: now });
  r.baseline = { ver: c.ver, rules: structuredClone(c.rules), t: now };
  r.cand = null;
  const b = { id: newId("b"), t: now, recipe, kind: "fleet", ver: c.ver, pilot: c.pilot, fromBase, tools: tools.filter((x) => x.tool !== c.pilot), rollback: tools };
  st.bundles.push(b);
  log(st, { type: "switch", recipe, ver: c.ver, label: versionById(st, c.ver)?.label, from: fromBase?.ver, bundle: b.id }, now);
  return b;
}

// 롤백: 직전 기준으로 되돌린다. 가장 최근 전체 배포 묶음의 롤백 목록을 돌려준다
export function rollback(st, recipe, now = Date.now()) {
  const r = st.recipes[recipe];
  const prev = r?.past.at(-1);
  if (!prev) throw Object.assign(new Error("nothing to roll back"), { code: "noPast" });
  r.past.pop();
  const cur = r.baseline;
  r.baseline = { ver: prev.ver, rules: structuredClone(prev.rules), t: now };
  r.past.push({ ...cur, until: now, rolledBack: true });
  r.cand = null;
  const fleet = [...st.bundles].reverse().find((b) => b.recipe === recipe && b.kind === "fleet" && b.ver === cur.ver);
  const b = { id: newId("b"), t: now, recipe, kind: "rollback", ver: prev.ver, tools: fleet ? fleet.rollback : [], of: fleet?.id || null };
  st.bundles.push(b);
  log(st, { type: "rollback", recipe, ver: prev.ver, label: versionById(st, prev.ver)?.label, from: cur.ver, bundle: b.id }, now);
  return b;
}

// 재현 세트: 지금 장비 파일 상태를 이름 붙여 저장 · 다시 열기
export function saveSet(st, name, now = Date.now(), builtIn = false) {
  const s = { id: newId("r"), name: String(name || "").trim() || new Date(now).toISOString().slice(0, 16), t: now, builtIn, current: structuredClone(st.current) };
  st.sets.push(s);
  if (!builtIn) log(st, { type: "set", what: "save", name: s.name }, now);
  return s;
}
export function loadSet(st, id, now = Date.now()) {
  const s = st.sets.find((x) => x.id === id);
  if (!s) return null;
  st.current = structuredClone(s.current);
  log(st, { type: "set", what: "load", name: s.name }, now);
  return s;
}

// 비교: 같은 장비 세트(현재 또는 재현 세트)에서 현재 기준 vs 후보(또는 임의 기준 a, b)
export function compareSet(st, recipe, a, b, current = st.current) {
  return st.tools.map((t) => {
    const snap = snapById(st, current[t.id]?.[recipe]);
    if (!snap) return null;
    const p = paramsOf(snap);
    const A = judge(st, a, p), B = judge(st, b, p);
    const changed = B.rows.filter((row) => { const o = A.rows.find((x) => x.key === row.key); return !o || o.status !== row.status; }).map((x) => x.key);
    return { tool: t.id, snap, A, B, flip: A.pass !== B.pass, changed };
  }).filter(Boolean);
}
