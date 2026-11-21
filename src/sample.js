// 합성 예시 세트: 레시피 1개(항목 40) · 버전 10 · 장비 3대. 실제 장비 · 레시피와 관련 없는 가상의 값이다.
// 같은 내용을 5가지 형식(JSON · INI · XML · CSV · key=value)으로 쓸 수 있어, 형식이 달라도 같은 버전으로 식별되는지 보여준다.

import { emptyState, addVersion, addSnap, addTool, saveSet, recipeOf, setBaseline } from "./flow.js";
import { sha256, bytesToB64, toBytes } from "./bundle.js";

export const RECIPE = "DEMO-SCAN";
export const TOOLS = ["EQ-01", "EQ-02", "EQ-03"];

// [섹션, 키, 값, 단위] — v1 값
const V1 = [
  ["Header", "Name", RECIPE, ""], ["Header", "Revision", "1", ""], ["Header", "SavedAt", "", ""], ["Header", "SavedBy", "engineer-a", ""], ["Header", "Comment", "initial", ""],
  ["Wafer", "Size", "300", "mm"], ["Wafer", "EdgeExclusion", "3", "mm"], ["Wafer", "NotchDirection", "Down", ""], ["Wafer", "Thickness", "775", "um"],
  ["Stage", "ScanSpeed", "100", "mm/s"], ["Stage", "Accel", "2000", "mm/s2"], ["Stage", "SettleTime", "20", "ms"], ["Stage", "ZOffset", "0.0", "um"],
  ["Optics", "FocusOffset", "0.00", "um"], ["Optics", "Exposure", "1200", "us"], ["Optics", "Gain", "6.0", "dB"], ["Optics", "Binning", "1", ""], ["Optics", "Filter", "Green", ""],
  ["Illum", "Power", "60", "%"], ["Illum", "Angle", "30", "deg"], ["Illum", "Mode", "Bright", ""], ["Illum", "Warmup", "120", "s"],
  ["Align", "MarkScoreMin", "0.80", ""], ["Align", "SearchRange", "40", "um"], ["Align", "Retry", "2", ""], ["Align", "Method", "Pattern", ""],
  ["Detect", "Threshold.Low", "40", ""], ["Detect", "Threshold.High", "210", ""], ["Detect", "MinSize", "1.0", "um"], ["Detect", "MaxCount", "5000", ""],
  ["Detect", "Sensitivity", "70", "%"], ["Detect", "MergeDistance", "2.0", "um"], ["Detect", "NoiseFilter", "Median", ""],
  ["Classify", "Model", "rule-v1", ""], ["Classify", "ConfidenceMin", "0.60", ""], ["Classify", "ReviewSample", "50", ""],
  ["Output", "Format", "CSV", ""], ["Output", "ImageSave", "true", ""], ["Output", "ImageQuality", "85", "%"],
  ["Run", "MaxDuration", "45", "min"],
];

// 버전별 바뀐 값 (누적)
const CHANGES = [
  {},
  { "Detect.Sensitivity": "72", "Optics.Gain": "6.5", "Header.Comment": "gain up" },
  { "Stage.ScanSpeed": "120", "Stage.SettleTime": "15", "Header.Comment": "faster scan" },
  { "Align.SearchRange": "50", "Align.Retry": "3", "Header.Comment": "align retry" },
  { "Detect.Threshold.Low": "38", "Detect.MinSize": "0.8", "Header.Comment": "small defects" },
  { "Illum.Power": "65", "Optics.FocusOffset": "0.10", "Header.Comment": "focus tune" },
  { "Classify.Model": "rule-v2", "Classify.ConfidenceMin": "0.65", "Header.Comment": "classifier v2" },
  { "Optics.Exposure": "1500", "Output.ImageQuality": "90", "Header.Comment": "exposure up" },
  { "Detect.Threshold.Low": "36", "Illum.Angle": "32", "Detect.MergeDistance": "1.5", "Header.Comment": "sensitivity tune" },
  { "Stage.ZOffset": "-0.5", "Detect.MaxCount": "8000", "Header.Comment": "draft" },
];

export const DAY = 86400000;
export const T0 = Date.UTC(2026, 9, 1, 0, 0); // 2026-10-01 (합성 날짜)
const verTime = (i) => T0 + i * 5 * DAY + 9 * 3600000;

// 기준 규칙 (허용 오차 · 무시 항목)
export const RULES = {
  tol: [
    { pattern: "Optics.FocusOffset", abs: 0.05, unit: "um" },
    { pattern: "Optics.Exposure", pct: 2 },
    { pattern: "Illum.Power", abs: 2, unit: "%" },
    { pattern: "Illum.Angle", abs: 0.5, unit: "deg" },
    { pattern: "Detect.Threshold.*", abs: 2 },
    { pattern: "Detect.Sensitivity", abs: 1, unit: "%" },
    { pattern: "Stage.ZOffset", abs: 0.2, unit: "um" },
    { pattern: "Wafer.Thickness", pct: 5 },
    { pattern: "Align.MarkScoreMin", abs: 0.02 },
  ],
  ignore: ["Header.SavedAt", "Header.SavedBy", "*.Comment"],
};

// n = 1..10 → [섹션, 키, 값, 단위] 목록
export function versionRows(n) {
  const rows = V1.map((r) => [...r]);
  for (let i = 1; i < n; i++) for (const [p, v] of Object.entries(CHANGES[i])) rows.find((r) => `${r[0]}.${r[1]}` === p)[2] = v;
  rows.find((r) => r[1] === "Revision")[2] = String(n);
  rows.find((r) => r[1] === "SavedAt")[2] = new Date(verTime(n - 1)).toISOString().slice(0, 19);
  return rows;
}
export const edit = (rows, patch) => rows.map((r) => { const k = `${r[0]}.${r[1]}`; return k in patch ? [r[0], r[1], ...(Array.isArray(patch[k]) ? patch[k] : [patch[k], r[3]])] : [...r]; }).filter((r) => r[2] !== null);

// ---- 형식별로 쓰기 ----
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const csvCell = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
export function write(rows, format) {
  const sections = [...new Set(rows.map((r) => r[0]))];
  if (format === "json") {
    const o = {};
    for (const [s, k, v, u] of rows) {
      let node = (o[s] ||= {});
      const parts = k.split(".");
      for (const p of parts.slice(0, -1)) node = node[p] ||= {};
      const num = v !== "" && !isNaN(Number(v)) && !/^0\d/.test(v) ? Number(v) : v === "true" || v === "false" ? v === "true" : v;
      node[parts.at(-1)] = u ? { value: num, unit: u } : num;
    }
    return JSON.stringify(o, null, 2) + "\n";
  }
  if (format === "ini") return sections.map((s) => `[${s}]\r\n` + rows.filter((r) => r[0] === s).map(([, k, v, u]) => `${k}=${v}${u ? " " + u : ""}`).join("\r\n")).join("\r\n\r\n") + "\r\n";
  if (format === "kv") return `# ${RECIPE} recipe (key=value)\n` + rows.map(([s, k, v, u]) => `${s}.${k} = ${v}${u ? " " + u : ""}`).join("\n") + "\n";
  if (format === "csv") return "section,name,value,unit\r\n" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  if (format === "xml") {
    const head = rows.filter((r) => r[0] === "Header").map(([, k, v]) => `    <${k}>${esc(v)}</${k}>`).join("\n");
    const body = sections.filter((s) => s !== "Header").map((s) => `  <Section name="${s}">\n` + rows.filter((r) => r[0] === s).map(([, k, v, u]) => `    <Param name="${k}" value="${esc(v)}"${u ? ` unit="${u}"` : ""}/>`).join("\n") + "\n  </Section>").join("\n");
    return `<?xml version="1.0" encoding="utf-8"?>\n<!-- synthetic recipe -->\n<Recipe name="${RECIPE}">\n  <Header>\n${head}\n  </Header>\n${body}\n</Recipe>\n`;
  }
  throw new Error(`unknown format ${format}`);
}
const EXT = { json: "json", ini: "ini", kv: "txt", csv: "csv", xml: "xml" };
export const fileName = (format, tag = "") => `${RECIPE}${tag ? "_" + tag : ""}.${EXT[format]}`;

async function file(rows, format, tag) {
  const text = write(rows, format);
  const bytes = toBytes(text);
  return { fileName: fileName(format, tag), format, text, b64: bytesToB64(bytes), sha: await sha256(bytes) };
}

// 장비 3대의 파일 이력. [시각(일), 장비, 버전 n, 형식, 로컬 수정]
const EQ02_EDIT = { "Optics.FocusOffset": "0.12", "Optics.Exposure": ["1.5", "ms"], "Illum.Power": "66" };
const EQ03_EDIT = { "Detect.Threshold.Low": "42", "Detect.MergeDistance": null, "Output.ImageSave": "false" };
const TIMELINE = [
  [16, 0, 4, "ini"], [17, 1, 4, "xml"], [18, 2, 4, "csv"],
  [26, 0, 6, "ini"], [27, 1, 6, "xml"], [31, 1, 7, "xml"], [32, 2, 6, "csv"],
  [36, 0, 8, "ini"], [37, 1, 8, "xml", EQ02_EDIT], [38, 2, 8, "csv"], [44, 2, 8, "csv", EQ03_EDIT],
];

export async function buildSample() {
  const st = emptyState();
  const tools = TOOLS.map((n) => addTool(st, n));
  for (let n = 1; n <= 10; n++) {
    // v1~v3 는 예전 key=value 파일, v4 부터 JSON
    const f = await file(versionRows(n), n <= 3 ? "kv" : "json", `v${n}`);
    addVersion(st, { ...f, recipe: RECIPE, label: `v${n}`, note: CHANGES[n - 1]["Header.Comment"] || "initial", t: verTime(n - 1) }, verTime(n - 1));
  }
  const r = recipeOf(st, RECIPE);
  const v8 = st.versions.find((v) => v.label === "v8");
  r.past = []; r.baseline = null;
  st.history = st.history.filter((h) => h.type !== "baseline");
  setBaseline(st, RECIPE, v8.id, RULES, verTime(7) + 3600000, "sample");
  for (const [d, ti, n, fmt, patch] of TIMELINE) {
    const t = T0 + d * DAY + 14 * 3600000;
    const f = await file(patch ? edit(versionRows(n), patch) : versionRows(n), fmt, patch ? "local" : `v${n}`);
    addSnap(st, { ...f, recipe: RECIPE, tool: tools[ti].id, source: "sample", t }, t);
  }
  const tEnd = T0 + 45 * DAY;
  saveSet(st, "sample:now", tEnd, true);
  // 모두 v8 그대로
  const all8 = structuredClone(st.current);
  const s8 = st.snaps.filter((s) => s.tool === tools[2].id).find((s) => s.text === write(versionRows(8), "csv"));
  all8[tools[2].id][RECIPE] = s8.id;
  st.sets.push({ id: "r-sample-v8", name: "sample:allv8", t: tEnd, builtIn: true, current: all8 });
  st.history.sort((a, b) => a.t - b.t);
  return st;
}

// 시연용: 시범 장비에 버전 n 파일이 복사됐다고 가정하고 장비 파일로 등록
export async function demoApply(st, toolId, n, now = Date.now()) {
  const tool = st.tools.find((t) => t.id === toolId);
  const fmt = { "EQ-01": "ini", "EQ-02": "xml", "EQ-03": "csv" }[tool?.name] || "ini";
  const f = await file(versionRows(n), fmt, `v${n}`);
  return addSnap(st, { ...f, recipe: RECIPE, tool: toolId, source: "demo", t: now }, now);
}
