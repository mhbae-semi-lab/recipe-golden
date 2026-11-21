// 차별점 2 시연 시나리오: 합성 세트에서 v9 를 1대 시범 → 전체 전환 → 롤백까지 한 흐름으로 돌리고 측정한다.
// node tools/scenario.mjs [--out docs/measurements/scenario.json]
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildSample, demoApply, RECIPE, RULES } from "../src/sample.js";
import * as F from "../src/flow.js";
import { makeBundle, verifyBundle, unzip, zip, sha256 } from "../src/bundle.js";

const st = await buildSample();
const id = (name) => st.tools.find((t) => t.name === name).id;
const ver = (label) => st.versions.find((v) => v.label === label);
const out = { steps: [] };
const step = (name, data) => { out.steps.push({ step: name, ...data }); console.log(`- ${name}:`, JSON.stringify(data)); };
let now = Date.UTC(2026, 10, 20, 9);

const before = Object.fromEntries(st.tools.map((t) => [t.name, F.currentSnap(st, t.id, RECIPE).sha]));
step("시작", { baseline: "v8", tools: st.tools.map((t) => `${t.name}:${F.toolStatus(st, RECIPE, t.id).main.pass ? "통과" : "차단"}`) });

F.startCandidate(st, RECIPE, ver("v9").id, RULES, ++now);
const cmp = F.compareSet(st, RECIPE, { ...st.recipes[RECIPE].baseline, by: "base" }, { ...st.recipes[RECIPE].cand, by: "cand" });
step("비교 (v8 vs v9, 같은 장비 파일)", { flips: cmp.filter((x) => x.flip).map((x) => F.toolById(st, x.tool).name), gateOk: F.gate(st, RECIPE).ok });

F.startPilot(st, RECIPE, id("EQ-01"), ++now);
const pilotSpec = st.bundles.at(-1);
const vp = ver("v9"), pilotFrom = F.snapById(st, pilotSpec.tools[0].from);
const pilotZip = await makeBundle({ kind: "pilot", id: pilotSpec.id, recipe: RECIPE, created: now, target: { ...vp }, tools: [{ name: "EQ-01", from: pilotFrom }] });
step("1대 시범 시작 (EQ-01)", { bundle: pilotZip.name, files: pilotZip.manifest.files.length, verify: (await verifyBundle(pilotZip.bytes)).ok, gateOk: F.gate(st, RECIPE).ok });

await demoApply(st, id("EQ-01"), 9, ++now);
const runs = [];
for (let i = 0; i < 3; i++) { const s = F.currentSnap(st, id("EQ-01"), RECIPE); runs.push(F.preCheck(st, RECIPE, id("EQ-01"), { params: F.paramsOf(s), sha: s.sha }, ++now).pass); }
const shadow = F.fleetShadow(st, RECIPE).map((x) => ({ tool: F.toolById(st, x.tool).name, decides: x.main.by, pass: x.main.pass, shadowPass: x.shadow.pass, cls: x.cls?.kind || null }));
const g = F.gate(st, RECIPE);
step("시범 장비 적용 · 검사 전 검증 3회", { runs, shadow, gate: g.items.map((x) => `${x.id}:${x.ok}`), gateOk: g.ok });

const fleet = F.switchBaseline(st, RECIPE, ++now);
const fileOf = (s) => ({ fileName: s.fileName, b64: s.b64, text: s.text });
const fleetZip = await makeBundle({ kind: "fleet", id: fleet.id, recipe: RECIPE, created: now, target: { ...vp }, tools: fleet.tools.map((x) => ({ name: F.toolById(st, x.tool).name, from: fileOf(F.snapById(st, x.from)) })) });
const rbZip = await makeBundle({ kind: "rollback", id: fleet.id + "-rb", recipe: RECIPE, created: now, target: null, tools: fleet.rollback.map((x) => ({ name: F.toolById(st, x.tool).name, from: fileOf(F.snapById(st, x.from)) })) });
step("전환 (기준 v9)", { fleetTools: fleet.tools.map((x) => F.toolById(st, x.tool).name), fleetVerify: (await verifyBundle(fleetZip.bytes)).ok, rollbackTools: fleet.rollback.length, rollbackVerify: (await verifyBundle(rbZip.bytes)).ok, fleetBytes: fleetZip.bytes.length, rollbackBytes: rbZip.bytes.length });

// 전체 배포 적용 (장비 파일이 모두 v9)
for (const x of fleet.tools) await demoApply(st, x.tool, 9, ++now);
step("전체 적용 뒤", { tools: st.tools.map((t) => `${t.name}:${F.toolStatus(st, RECIPE, t.id).match.exact?.label}:${F.toolStatus(st, RECIPE, t.id).main.pass ? "통과" : "차단"}`) });

// 롤백: 롤백 묶음 안 파일의 SHA-256 이 전환 전(시범 전) 장비 파일과 같은지
F.rollback(st, RECIPE, ++now);
const entries = unzip(rbZip.bytes);
let restored = 0;
for (const t of st.tools) {
  const e = entries.find((x) => x.name.startsWith(`rollback/${t.name}/`));
  if (e && (await sha256(e.data)) === before[t.name]) restored++;
}
step("롤백 (기준 v8)", { baseline: F.versionById(st, st.recipes[RECIPE].baseline.ver).label, restoredToPreChangeFiles: `${restored}/${st.tools.length}` });

// 변조 탐지: 묶음 안 파일 1바이트 변경
const tampered = unzip(fleetZip.bytes).map((x) => ({ name: x.name, data: x.data }));
tampered[0].data = tampered[0].data.slice(); tampered[0].data[10] ^= 1;
const tv = await verifyBundle(zip(tampered));
step("변조 탐지 (대상 파일 1바이트)", { ok: tv.ok, failed: tv.files.filter((f) => !f.ok).map((f) => f.path) });

out.summary = { gateAfterRuns: g.ok, restored: `${restored}/${st.tools.length}`, tamperDetected: !tv.ok, historyEvents: st.history.length };
const arg = process.argv.indexOf("--out");
if (arg > 0) { mkdirSync(dirname(process.argv[arg + 1]), { recursive: true }); writeFileSync(process.argv[arg + 1], JSON.stringify(out, null, 2) + "\n"); }
if (!g.ok || restored !== st.tools.length || tv.ok) process.exitCode = 1;
