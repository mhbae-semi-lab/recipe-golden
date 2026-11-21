import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSample, demoApply, RECIPE, RULES, versionRows, write } from "../src/sample.js";
import { toolStatus, preCheck, startCandidate, startPilot, gate, switchBaseline, rollback, updateCandidate, compareSet, loadSet, saveSet, migrate, versionById, paramsOf, emptyState, addVersion, addSnap, addTool } from "../src/flow.js";
import { parseRecipe } from "../src/parse.js";

const tool = (st, name) => st.tools.find((t) => t.name === name).id;
const ver = (st, label) => st.versions.find((v) => v.label === label).id;

test("합성 세트: 항목 40 · 장비 3대 · 버전 10, 기준 v8", async () => {
  const st = await buildSample();
  assert.equal(st.tools.length, 3);
  assert.equal(st.versions.length, 10);
  for (const v of st.versions) assert.equal(Object.keys(paramsOf(v)).length, 40, v.label);
  assert.equal(versionById(st, st.recipes[RECIPE].baseline.ver).label, "v8");
});

test("장비 판정: EQ-01 같음(INI), EQ-02 허용 오차 안 + 단위 환산(XML), EQ-03 차단 3건(CSV)", async () => {
  const st = await buildSample();
  const a = toolStatus(st, RECIPE, tool(st, "EQ-01"));
  assert.equal(a.match.exact.label, "v8");
  assert.equal(a.main.pass, true);
  assert.equal(a.main.count.within, undefined);

  const b = toolStatus(st, RECIPE, tool(st, "EQ-02"));
  assert.equal(b.main.pass, true);
  assert.equal(b.match.exact, null);
  assert.equal(b.match.closest.label, "v8");
  assert.deepEqual(b.main.rows.filter((r) => r.status === "within").map((r) => r.path).sort(), ["Illum.Power", "Optics.FocusOffset"]);
  assert.equal(b.main.rows.find((r) => r.path === "Optics.Exposure").status, "same"); // 1.5 ms = 1500 us

  const c = toolStatus(st, RECIPE, tool(st, "EQ-03"));
  assert.equal(c.main.pass, false);
  const reasons = Object.fromEntries(c.main.blocking.map((r) => [r.path, r.status]));
  assert.deepEqual(reasons, { "Detect.Threshold.Low": "out", "Output.ImageSave": "changed", "Detect.MergeDistance": "missing" });
  const low = c.main.blocking.find((r) => r.path === "Detect.Threshold.Low");
  assert.equal(low.delta, 4); assert.equal(low.allow, 2); assert.ok(low.line > 0);
});

test("1대 시범 → Shadow → 전환 → 롤백 전체 흐름", async () => {
  const st = await buildSample();
  const eq1 = tool(st, "EQ-01");
  let now = Date.UTC(2026, 10, 20);
  startCandidate(st, RECIPE, ver(st, "v9"), RULES, now);
  assert.equal(gate(st, RECIPE).ok, false);
  startPilot(st, RECIPE, eq1, ++now);
  // 시범 장비가 아직 v8: 후보(v9) 기준으로는 차단
  const before = preCheck(st, RECIPE, eq1, { params: paramsOf(st.snaps.at(-1)) }, ++now);
  assert.equal(before.by, "cand");
  let g = gate(st, RECIPE);
  assert.equal(g.items.find((x) => x.id === "applied").ok, false);

  await demoApply(st, eq1, 9, ++now);
  const s = toolStatus(st, RECIPE, eq1);
  assert.equal(s.main.by, "cand"); assert.equal(s.main.pass, true);
  assert.equal(s.shadow.pass, false); assert.equal(s.cls.kind, "updated");
  // 다른 장비: 현재 기준이 판정, 후보 기준이면 "새 파일 필요"
  const s2 = toolStatus(st, RECIPE, tool(st, "EQ-02"));
  assert.equal(s2.main.by, "base"); assert.equal(s2.cls.kind, "needsFile");

  const f9 = parseRecipe(write(versionRows(9), "ini"), { format: "ini" });
  for (let i = 0; i < 2; i++) preCheck(st, RECIPE, eq1, { params: f9.params }, ++now);
  g = gate(st, RECIPE);
  assert.equal(g.ok, false); // 시범 전에 한 번 차단됨 + 통과 2회
  // 시범 기록을 새로 세기 (후보 내용을 바꾸면 since 가 갱신)
  updateCandidate(st, RECIPE, { rules: RULES }, ++now);
  for (let i = 0; i < 3; i++) preCheck(st, RECIPE, eq1, { params: f9.params }, ++now);
  g = gate(st, RECIPE);
  assert.deepEqual(g.items.map((x) => [x.id, x.ok]), [["pilot", true], ["applied", true], ["runs", true], ["noBlock", true], ["looser", true]]);

  const fleet = switchBaseline(st, RECIPE, ++now);
  assert.equal(versionById(st, st.recipes[RECIPE].baseline.ver).label, "v9");
  assert.deepEqual(fleet.tools.map((x) => x.tool).sort(), [tool(st, "EQ-02"), tool(st, "EQ-03")].sort());
  assert.equal(fleet.rollback.length, 3);
  // 시범 장비의 롤백 파일은 시범 전 파일(v8)이어야 한다 (전환 시점의 v9 가 아니라)
  const eq1Back = st.snaps.find((x) => x.id === fleet.rollback.find((y) => y.tool === eq1).from);
  assert.equal(paramsOf(eq1Back)["Header.Revision"].v, "8");
  assert.equal(st.bundles.filter((b) => b.kind === "pilot").length, 1);
  assert.equal(st.recipes[RECIPE].cand, null);

  const rb = rollback(st, RECIPE, ++now);
  assert.equal(versionById(st, st.recipes[RECIPE].baseline.ver).label, "v8");
  assert.equal(rb.of, fleet.id);
  assert.deepEqual(rb.tools, fleet.rollback);
  assert.ok(st.history.some((h) => h.type === "rollback"));
});

test("전환 조건을 넘기 전에는 전환할 수 없다", async () => {
  const st = await buildSample();
  startCandidate(st, RECIPE, ver(st, "v9"), RULES);
  assert.throws(() => switchBaseline(st, RECIPE), /gate/);
});

test("허용 오차를 넓힌 후보: EQ-03 이 통과로 바뀌면 놓침 위험 → 확인 전까지 전환 막힘", async () => {
  const st = await buildSample();
  const loose = structuredClone(RULES);
  loose.tol.find((r) => r.pattern === "Detect.Threshold.*").abs = 5;
  loose.ignore.push("Detect.MergeDistance", "Output.ImageSave");
  startCandidate(st, RECIPE, ver(st, "v8"), loose);
  const cmp = compareSet(st, RECIPE, { ...st.recipes[RECIPE].baseline, by: "base" }, { ...st.recipes[RECIPE].cand, by: "cand" });
  const eq3 = cmp.find((x) => x.tool === tool(st, "EQ-03"));
  assert.equal(eq3.flip, true);
  assert.equal(eq3.A.pass, false); assert.equal(eq3.B.pass, true);
  assert.deepEqual(eq3.changed.sort(), ["detect.mergedistance", "detect.threshold.low", "output.imagesave"]);
  assert.equal(cmp.filter((x) => x.flip).length, 1);
  assert.equal(toolStatus(st, RECIPE, tool(st, "EQ-03")).cls.kind, "looser");
  const eq1 = tool(st, "EQ-01");
  startPilot(st, RECIPE, eq1);
  for (let i = 0; i < 3; i++) preCheck(st, RECIPE, eq1, { params: paramsOf(st.snaps.find((s) => s.id === st.current[eq1][RECIPE])) });
  let g = gate(st, RECIPE);
  assert.equal(g.items.find((x) => x.id === "looser").ok, false);
  assert.equal(g.ok, false);
  updateCandidate(st, RECIPE, { ack: true });
  g = gate(st, RECIPE);
  assert.equal(g.ok, true);
});

test("재현 세트 저장 · 다시 열기, 내장 '모두 v8' 세트", async () => {
  const st = await buildSample();
  const eq3 = tool(st, "EQ-03");
  loadSet(st, "r-sample-v8");
  assert.equal(toolStatus(st, RECIPE, eq3).main.pass, true);
  const mine = saveSet(st, "all good");
  loadSet(st, st.sets.find((s) => s.name === "sample:now").id);
  assert.equal(toolStatus(st, RECIPE, eq3).main.pass, false);
  loadSet(st, mine.id);
  assert.equal(toolStatus(st, RECIPE, eq3).main.pass, true);
});

test("빈 상태에서 첫 버전이 기준이 되고, 같은 이름 버전은 거부", () => {
  const st = emptyState();
  const v = addVersion(st, { recipe: "R", label: "v1", fileName: "r.ini", format: "ini", text: "[A]\nx=1\n" });
  assert.equal(st.recipes.R.baseline.ver, v.id);
  assert.throws(() => addVersion(st, { recipe: "R", label: "V1", fileName: "r.ini", format: "ini", text: "" }), /exists/);
  const t = addTool(st, "T1");
  assert.equal(addTool(st, "t1").id, t.id);
  addSnap(st, { recipe: "R", tool: t.id, fileName: "r.ini", format: "ini", text: "[A]\nx=1\n" });
  addSnap(st, { recipe: "R", tool: t.id, fileName: "r.ini", format: "ini", text: "[A]\nx=2\n" });
  assert.equal(st.history.filter((h) => h.type === "snap").at(-1).changed, true);
  assert.equal(toolStatus(st, "R", t.id).main.pass, false);
});

test("migrate: 빠진 필드 채우기", () => {
  const s = migrate({ recipes: {}, versions: [] });
  assert.deepEqual(s.settings, { pilotRuns: 3 });
  assert.ok(Array.isArray(s.checks));
  assert.equal(migrate(null).schema, 1);
});
