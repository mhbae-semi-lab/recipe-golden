import { test } from "node:test";
import assert from "node:assert/strict";
import { diffParams, verdict, parseValue, compileRules, matchVersion, glob } from "../src/diff.js";

const P = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? { v: v[0], u: v[1] } : { v: String(v), u: "" }]));
const st = (rows, key) => rows.find((r) => r.key === key.toLowerCase())?.status;

test("값 읽기: 숫자 · 단위 · 참거짓 · 천 단위 쉼표", () => {
  assert.deepEqual(parseValue("1.5 ms"), { n: 1.5, u: "ms", b: null, s: "1.5 ms" });
  assert.equal(parseValue("1e-3").n, 0.001);
  assert.equal(parseValue("-5%").u, "%");
  assert.equal(parseValue("ON").b, true);
  assert.equal(parseValue("1,000").n, null);
  assert.equal(parseValue("1,5").n, 1.5);
  assert.equal(parseValue("v1.2").n, null);
});

test("허용 오차: 안 · 경계 · 밖, 퍼센트, 더 넓은 쪽", () => {
  const rules = { tol: [{ pattern: "A.*", abs: 2 }, { pattern: "B", pct: 10 }, { pattern: "C", abs: 0.5, pct: 10 }] };
  const base = P({ "A.x": 38, "A.y": 38, "A.z": 38, B: 200, C: 100 });
  const rows = diffParams(base, P({ "A.x": 39, "A.y": 40, "A.z": 40.01, B: 221, C: 109 }), rules);
  assert.equal(st(rows, "A.x"), "within");
  assert.equal(st(rows, "A.y"), "within"); // 경계는 안
  assert.equal(st(rows, "A.z"), "out");
  assert.equal(st(rows, "B"), "out");
  assert.equal(st(rows, "C"), "within"); // abs 0.5 와 10% 중 넓은 쪽
  const z = rows.find((r) => r.key === "a.z");
  assert.equal(z.delta, 2.01);
  assert.equal(z.allow, 2);
});

test("단위 환산: 1.5 ms = 1500 us, 차원이 다르면 차단, 규칙 단위 환산", () => {
  const rows = diffParams(P({ E: ["1500", "us"], F: ["0.10", "um"], G: ["5", "mm"] }), P({ E: ["1.5", "ms"], F: ["130", "nm"], G: ["5", "ms"] }), { tol: [{ pattern: "F", abs: 0.05, unit: "um" }] });
  assert.equal(st(rows, "E"), "same");
  assert.equal(st(rows, "F"), "within");
  assert.equal(st(rows, "G"), "unit");
  assert.equal(rows.find((r) => r.key === "f").converted, 0.13);
});

test("한쪽만 단위가 있으면 같은 단위로 보고 표시", () => {
  const rows = diffParams(P({ A: ["5", "mm"] }), P({ A: "5" }), {});
  assert.equal(st(rows, "A"), "same");
  assert.equal(rows[0].note, "unitAssumed");
});

test("빠짐 · 추가 · 글자 변경 · 무시 · 대소문자 다른 키", () => {
  const rows = diffParams(P({ "Opt.Mode": "Bright", "Opt.On": "true", Gone: 1, "Header.SavedAt": "x", "Header.Comment": "a" }),
    P({ "opt.mode": "Dark", "Opt.On": "yes", New: 2, "Header.SavedAt": "y", "Header.Comment": "b" }),
    { ignore: ["Header.SavedAt", "*.comment"] });
  assert.equal(st(rows, "Opt.Mode"), "changed");
  assert.equal(st(rows, "Opt.On"), "same"); // true = yes
  assert.equal(st(rows, "Gone"), "missing");
  assert.equal(st(rows, "New"), "added");
  assert.equal(st(rows, "Header.SavedAt"), "ignored");
  assert.equal(st(rows, "Header.Comment"), "ignored");
  const v = verdict(rows);
  assert.equal(v.pass, false);
  assert.deepEqual(v.blocking.map((r) => r.status).sort(), ["added", "changed", "missing"]);
  assert.equal(rows[0].status, "changed"); // 차단 줄이 위로
});

test("규칙 없음 = 정확히 같아야 함, 부동소수 오차는 같음", () => {
  const rows = diffParams(P({ A: 0.3, B: 1 }), P({ A: 0.1 + 0.2, B: 1.0001 }), {});
  assert.equal(st(rows, "A"), "same");
  assert.equal(st(rows, "B"), "out");
});

test("글롭", () => {
  assert.ok(glob("Detect.Threshold.*").test("detect.threshold.low"));
  assert.ok(!glob("Detect.Threshold.*").test("Detect.MinSize"));
  assert.ok(glob("*.Comment").test("Header.Comment"));
  assert.ok(glob("A?").test("AB"));
  assert.equal(compileRules({ tol: [{ pattern: "" }] }).tol.length, 0);
});

test("버전 식별: 같은 버전 · 가장 가까운 버전", () => {
  const vs = [{ label: "v1", t: 1, params: P({ A: 1, B: 1 }) }, { label: "v2", t: 2, params: P({ A: 2, B: 1 }) }];
  assert.equal(matchVersion(P({ A: 2, B: 1 }), vs, compileRules({})).exact.label, "v2");
  const m = matchVersion(P({ A: 2, B: 3 }), vs, compileRules({}));
  assert.equal(m.exact, null);
  assert.equal(m.closest.label, "v2");
  assert.equal(m.n, 1);
});
