// 완료 측정: 합성 세트(항목 40 · 버전 10)에서 허용 오차 안 / 밖 판정과 차단 사유가 맞는지.
// 기준 v8 파일에 변경을 하나씩 넣은 사례를 만들고(정답은 사례를 만들 때 정함), 5가지 형식으로 써서 판정한다.
// node tools/measure.mjs [--out docs/measurements/accuracy.json]
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { versionRows, write, RULES } from "../src/sample.js";
import { parseRecipe } from "../src/parse.js";
import { diffParams, verdict, compileRules, matchVersion, unitInfo } from "../src/diff.js";

const FORMATS = ["json", "ini", "xml", "csv", "kv"];
const rules = compileRules(RULES);
const base = versionRows(8);
const baseParams = parseRecipe(write(base, "json"), { format: "json" }).params;
const ruleOf = (path) => RULES.tol.find((r) => new RegExp("^" + r.pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$", "i").test(path));
const ignored = (path) => RULES.ignore.some((p) => new RegExp("^" + p.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$", "i").test(path));
const fmtNum = (x) => String(Number(x.toPrecision(10)));

// 사례: { name, rows, expect: "pass" | "block", param, status }
const cases = [];
for (const [s, k, v, u] of base) {
  const path = `${s}.${k}`;
  const set = (val, unit = u) => base.map((r) => (r[0] === s && r[1] === k ? [s, k, val, unit] : [...r]));
  const num = v !== "" && !isNaN(Number(v)) && !/[a-z]/i.test(v);
  if (ignored(path)) { cases.push({ name: `${path} 무시 항목 변경`, rows: set(v + "-x"), expect: "pass", param: path, status: "ignored" }); continue; }
  if (num) {
    const n = Number(v), r = ruleOf(path);
    const tol = r ? Math.max(r.abs ?? 0, r.pct != null ? (Math.abs(n) * r.pct) / 100 : 0) : 0;
    if (tol > 0) {
      cases.push({ name: `${path} +0.5×허용`, rows: set(fmtNum(n + tol * 0.5)), expect: "pass", param: path, status: "within" });
      cases.push({ name: `${path} −1.0×허용 (경계)`, rows: set(fmtNum(n - tol)), expect: "pass", param: path, status: "within" });
      cases.push({ name: `${path} +1.1×허용`, rows: set(fmtNum(n + tol * 1.1)), expect: "block", param: path, status: "out" });
      cases.push({ name: `${path} −3×허용`, rows: set(fmtNum(n - tol * 3)), expect: "block", param: path, status: "out" });
    } else {
      cases.push({ name: `${path} 허용 없음 +작은 변화`, rows: set(fmtNum(n + Math.max(Math.abs(n) * 0.001, 0.001))), expect: "block", param: path, status: "out" });
    }
    cases.push({ name: `${path} 표기만 다름`, rows: set(n.toFixed(3)), expect: "pass", param: path, status: "same" });
    const ui = unitInfo(u);
    if (ui && ["len", "time"].includes(ui[0])) {
      const alt = ui[0] === "len" ? (u === "mm" ? "um" : "nm") : (u === "ms" ? "us" : "ms");
      const conv = (n * ui[1]) / unitInfo(alt)[1];
      cases.push({ name: `${path} 단위 환산 (${u}→${alt})`, rows: set(fmtNum(conv), alt), expect: "pass", param: path, status: "same" });
      cases.push({ name: `${path} 다른 차원 단위`, rows: set(v, ui[0] === "len" ? "ms" : "mm"), expect: "block", param: path, status: "unit" });
    }
  } else if (v === "true" || v === "false") {
    cases.push({ name: `${path} 참거짓 뒤집기`, rows: set(v === "true" ? "false" : "true"), expect: "block", param: path, status: "changed" });
    cases.push({ name: `${path} 같은 뜻 (on/off)`, rows: set(v === "true" ? "on" : "off"), expect: "pass", param: path, status: "same" });
  } else {
    cases.push({ name: `${path} 글자 변경`, rows: set(v + "X"), expect: "block", param: path, status: "changed" });
  }
  cases.push({ name: `${path} 빠짐`, rows: base.filter((r) => !(r[0] === s && r[1] === k)), expect: "block", param: path, status: "missing" });
}
cases.push({ name: "기준에 없는 항목 추가", rows: [...base.map((r) => [...r]), ["Detect", "EdgeMode", "Auto", ""]], expect: "block", param: "Detect.EdgeMode", status: "added" });
cases.push({ name: "기준 그대로", rows: base, expect: "pass", param: null, status: "same" });

const t0 = performance.now();
let correct = 0, reasonOk = 0, blocks = 0, n = 0;
const confusion = { pass: { pass: 0, block: 0 }, block: { pass: 0, block: 0 } };
const wrong = [];
for (const c of cases) for (const fmt of FORMATS) {
  n++;
  const p = parseRecipe(write(c.rows, fmt), { format: fmt });
  const rows = diffParams(baseParams, p.params, rules);
  const v = verdict(rows);
  const got = v.pass ? "pass" : "block";
  confusion[c.expect][got]++;
  const row = c.param ? rows.find((r) => r.path.toLowerCase() === c.param.toLowerCase()) : null;
  const statusOk = c.param ? row?.status === c.status : rows.every((r) => r.status === "same" || r.status === "ignored");
  // 차단이면 사유가 정확히 그 항목 하나여야 한다
  const onlyReason = got !== "block" || (v.blocking.length === 1 && v.blocking[0].path.toLowerCase() === c.param.toLowerCase());
  if (got === c.expect && statusOk && onlyReason && !p.errors.length) correct++;
  else wrong.push({ case: c.name, fmt, expect: c.expect, got, status: row?.status, errors: p.errors.length });
  if (got === "block") { blocks++; if (onlyReason && v.blocking[0].status === c.status) reasonOk++; }
}
const t1 = performance.now();

// 버전 식별: 버전 10개 × 형식 5개
let idOk = 0;
const versions = Array.from({ length: 10 }, (_, i) => ({ label: `v${i + 1}`, t: i, params: parseRecipe(write(versionRows(i + 1), "json"), { format: "json" }).params }));
for (const vv of versions) for (const fmt of FORMATS) {
  const m = matchVersion(parseRecipe(write(versionRows(+vv.label.slice(1)), fmt), { format: fmt }).params, versions, rules);
  if (m.exact?.label === vv.label) idOk++;
}

// 처리 시간: 항목 5,000개 파일 비교
const big = Array.from({ length: 5000 }, (_, i) => [`S${i % 50}`, `P${i}`, String(i * 0.5), i % 3 ? "um" : ""]);
const bigText = write(big, "ini"), bigEdit = write(big.map((r, i) => (i % 97 ? r : [r[0], r[1], String(Number(r[2]) + 1), r[3]])), "xml");
const tb = performance.now();
const bp = parseRecipe(bigText, { format: "ini" }).params, ap = parseRecipe(bigEdit, { format: "xml" }).params;
const brows = diffParams(bp, ap, compileRules({ tol: [{ pattern: "S1*", abs: 0.5 }] }));
const tBig = performance.now() - tb;

const out = {
  measured: new Date().toISOString().slice(0, 10), node: process.version,
  set: { params: base.length, versions: 10, formats: FORMATS, baseline: "v8", rules: RULES },
  cases: cases.length, judgments: n, correct, accuracy: +(correct / n).toFixed(4),
  confusion, blocked: blocks, blockedWithExactReason: reasonOk,
  versionIdentification: { total: 50, exact: idOk },
  timing: { judgmentsMs: +(t1 - t0).toFixed(1), perJudgmentMs: +((t1 - t0) / n).toFixed(3), bigFile: { params: big.length, diffRows: brows.length, nonSame: brows.filter((r) => r.status !== "same").length, ms: +tBig.toFixed(1) } },
  wrong: wrong.slice(0, 20),
};
const arg = process.argv.indexOf("--out");
if (arg > 0) { mkdirSync(dirname(process.argv[arg + 1]), { recursive: true }); writeFileSync(process.argv[arg + 1], JSON.stringify(out, null, 2) + "\n"); }
console.log(`사례 ${cases.length} × 형식 ${FORMATS.length} = 판정 ${n}회: 정답 ${correct} (${(100 * correct / n).toFixed(1)}%)`);
console.log(`  기대 통과 → 통과 ${confusion.pass.pass} / 차단 ${confusion.pass.block},  기대 차단 → 차단 ${confusion.block.block} / 통과 ${confusion.block.pass}`);
console.log(`  차단 ${blocks}건 중 사유가 정확히 그 항목 · 상태 ${reasonOk}건`);
console.log(`버전 식별 (버전 10 × 형식 5): ${idOk}/50`);
console.log(`시간: 판정 1회 평균 ${out.timing.perJudgmentMs}ms (파싱 포함), 항목 5,000개 INI↔XML 비교 ${out.timing.bigFile.ms}ms`);
if (wrong.length) { console.log("틀린 사례:", wrong.slice(0, 10)); process.exitCode = 1; }
