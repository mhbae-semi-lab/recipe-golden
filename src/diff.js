// 기준 파라미터와 실제 파라미터 비교. 허용 오차 · 단위 환산 · 무시 항목을 반영해 줄마다 상태를 매긴다.
// 상태: same(같음) · within(허용 오차 안) · ignored(무시 항목) — 통과
//       out(허용 오차 밖) · changed(값 다름) · unit(단위 맞지 않음) · missing(빠짐) · added(기준에 없음) — 차단

export const BLOCKING = new Set(["out", "changed", "unit", "missing", "added"]);

// 단위 → [차원, SI 배율]. 목록에 없는 단위는 글자가 같을 때만 같은 단위로 본다.
const U = {};
const def = (dim, list) => { for (const [names, f] of list) for (const n of names.split(" ")) U[n.toLowerCase()] = [dim, f]; };
def("len", [["nm", 1e-9], ["um µm μm micron", 1e-6], ["mm", 1e-3], ["cm", 1e-2], ["m", 1]]);
def("time", [["ns", 1e-9], ["us µs μs", 1e-6], ["ms msec", 1e-3], ["s sec", 1], ["min", 60], ["h hr", 3600]]);
def("freq", [["hz", 1], ["khz", 1e3], ["mhz", 1e6]]);
def("angle", [["deg ° degree", Math.PI / 180], ["rad", 1], ["mrad", 1e-3], ["urad µrad", 1e-6]]);
def("press", [["pa", 1], ["kpa", 1e3], ["torr", 133.322], ["mtorr", 0.133322], ["bar", 1e5], ["mbar", 100]]);
def("volt", [["v", 1], ["mv", 1e-3], ["kv", 1e3]]);
def("amp", [["a", 1], ["ma", 1e-3], ["ua µa", 1e-6]]);
def("pct", [["%", 1]]);
def("temp", [["°c degc c", 1]]);
def("speed", [["mm/s", 1e-3], ["um/s µm/s", 1e-6], ["m/s", 1]]);
export const unitInfo = (u) => U[String(u || "").trim().toLowerCase()] || null;

const NUM = /^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)\s*([^\d\s+\-.][^\s]*)?$/i;
const BOOL = { true: true, false: false, on: true, off: false, yes: true, no: false, enable: true, disable: false, enabled: true, disabled: false };

// 값 문자열 → { n: 숫자 | null, u: 단위, b: 참거짓 | null, s: 정리한 글자 }
export function parseValue(v, unit = "") {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  const m = s.match(NUM);
  if (m && !(m[1].includes(",") && m[1].split(",")[1]?.length === 3)) { // 1,000 은 천 단위로 보고 숫자로 읽지 않는다
    return { n: Number(m[1].replace(",", ".")), u: (unit || m[2] || "").trim(), b: null, s };
  }
  const b = BOOL[s.toLowerCase()];
  return { n: null, u: String(unit || "").trim(), b: b === undefined ? null : b, s };
}

// 글롭: * 는 아무 글자, ? 는 한 글자. 대소문자 무시
export const glob = (p) => new RegExp("^" + String(p).trim().replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");

// rules = { tol: [{ pattern, abs, pct, unit }], ignore: ["Header.SavedAt", "*.Comment"] }
// 허용 오차는 위에서부터 처음 맞는 규칙 하나를 쓴다. abs 와 pct 가 둘 다 있으면 더 넓은 쪽.
export function compileRules(rules = {}) {
  return {
    compiled: true,
    tol: (rules.tol || []).filter((r) => r && String(r.pattern || "").trim()).map((r) => ({ ...r, re: glob(r.pattern) })),
    ignore: (rules.ignore || []).map((p) => String(p).trim()).filter(Boolean).map(glob),
  };
}

// 실제 값을 기준 단위로 바꾼다. 실패하면 null
function toBaseUnit(n, from, to) {
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return n;
  const a = unitInfo(from), b = unitInfo(to);
  if (!a || !b || a[0] !== b[0]) return null;
  return (n * a[1]) / b[1];
}

const round = (x) => Number(x.toPrecision(12));

export function diffParams(base, act, rules) {
  const R = rules?.compiled ? rules : compileRules(rules);
  const bk = new Map(Object.keys(base || {}).map((k) => [k.toLowerCase(), k]));
  const ak = new Map(Object.keys(act || {}).map((k) => [k.toLowerCase(), k]));
  const keys = [...new Set([...bk.keys(), ...ak.keys()])];
  const rows = [];
  for (const key of keys) {
    const bp = bk.get(key), ap = ak.get(key);
    const path = bp ?? ap, B = bp ? base[bp] : null, A = ap ? act[ap] : null;
    const row = { key, path, base: B ? fmt(B) : null, act: A ? fmt(A) : null, line: A?.line || 0 };
    if (R.ignore.some((re) => re.test(path))) { row.status = "ignored"; row.differs = !B || !A || fmt(B) !== fmt(A); rows.push(row); continue; }
    if (!A) { row.status = "missing"; rows.push(row); continue; }
    if (!B) { row.status = "added"; rows.push(row); continue; }
    const b = parseValue(B.v, B.u), a = parseValue(A.v, A.u);
    const rule = R.tol.find((r) => r.re.test(path));
    if (b.n !== null && a.n !== null) {
      // 한쪽에만 단위가 있으면 같은 단위로 본다 (note 로 표시)
      const bu = b.u || a.u, au = a.u || b.u;
      if ((b.u && !a.u) || (!b.u && a.u)) row.note = "unitAssumed";
      const av = toBaseUnit(a.n, au, bu);
      if (av === null) { row.status = "unit"; row.unitA = au; row.unitB = bu; rows.push(row); continue; }
      const delta = round(av - b.n);
      let allow = 0;
      if (rule) {
        const abs = rule.abs != null && rule.abs !== "" ? toBaseUnit(Number(rule.abs), rule.unit || bu, bu) : null;
        const pct = rule.pct != null && rule.pct !== "" ? (Math.abs(b.n) * Number(rule.pct)) / 100 : null;
        if (rule.abs != null && rule.abs !== "" && abs === null) row.note = "ruleUnit";
        allow = Math.max(abs ?? 0, pct ?? 0);
        row.rule = rule.pattern;
      }
      row.delta = delta; row.allow = round(allow); row.unit = bu;
      if (au && bu && au.toLowerCase() !== bu.toLowerCase()) row.converted = round(av);
      const eps = 1e-9 * Math.max(1, Math.abs(b.n));
      row.status = Math.abs(delta) <= eps ? "same" : Math.abs(delta) <= allow + eps ? "within" : "out";
      rows.push(row); continue;
    }
    if (b.b !== null && a.b !== null) { row.status = b.b === a.b ? "same" : "changed"; rows.push(row); continue; }
    row.status = b.s === a.s && (b.u || "").toLowerCase() === (a.u || "").toLowerCase() ? "same" : "changed";
    rows.push(row);
  }
  const order = { out: 0, changed: 1, unit: 2, missing: 3, added: 4, within: 5, ignored: 6, same: 7 };
  return rows.sort((x, y) => order[x.status] - order[y.status] || x.path.localeCompare(y.path));
}
const fmt = (p) => (p.u ? `${p.v} ${p.u}` : p.v);

export function verdict(rows) {
  const blocking = rows.filter((r) => BLOCKING.has(r.status));
  const count = {};
  for (const r of rows) count[r.status] = (count[r.status] || 0) + 1;
  return { pass: blocking.length === 0, blocking, count, total: rows.length };
}

// 차이 개수 (같음 · 무시 제외). 버전 식별용
export const diffCount = (rows) => rows.filter((r) => r.status !== "same" && !(r.status === "ignored")).length;

// 파일이 어느 등록 버전과 같은지. exact = 같음 · 무시만 있는 버전, 없으면 차이가 가장 적은 버전
export function matchVersion(params, versions, rules) {
  let best = null;
  for (const v of versions) {
    const n = diffCount(diffParams(v.params, params, rules));
    if (!best || n < best.n || (n === best.n && v.t > best.v.t)) best = { v, n };
  }
  return best ? { exact: best.n === 0 ? best.v : null, closest: best.v, n: best.n } : { exact: null, closest: null, n: 0 };
}
