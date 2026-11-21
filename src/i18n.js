// 화면 문자열 (한국어 · 영어). {이름} 자리에 값을 넣는다.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const S = {
  ko: {
    skip: "본문으로 건너뛰기", appName: "레시피 기준 관리", recipe: "레시피", language: "언어", theme: "화면 테마", help: "도움말", settings: "설정",
    heroTitle: "어느 장비가 기준과 다른가, 무엇이 언제 바뀌었나",
    heroText: "장비 연동(SECS/GEM · MES) 없이 <b>레시피 파일만으로</b> 기준 버전을 정하고, 허용 오차 · 단위를 반영해 장비별 차이를 봅니다. 바꿀 때는 <b>1대 시범 → 전체</b> 배포 묶음과 <b>롤백 묶음</b>을 한 화면에서 만듭니다. 파일은 이 브라우저 밖으로 나가지 않습니다.",
    step1: "파일 가져오기 · 기준 등록", step2: "장비 × 버전 현황판 · Diff", step3: "검사 전 검증", step4: "비교 → 1대 시범 → 전환 · 롤백",
    sourceTitle: "파일 가져오기", loadSample: "예시 세트 (합성)", openFiles: "레시피 파일 열기", openFolder: "폴더 가져오기", watch: "폴더 연결 (변경 감시)", watchStop: "폴더 감시 끄기",
    dropHint: "파일이나 폴더를 이 페이지에 끌어다 놓아도 됩니다", dropHere: "여기에 놓으면 가져옵니다",
    board: "장비 × 버전 현황판", boardHint: "● 지금 쓰는 버전 · ◐ 가장 가까운 버전 · ○ 예전에 썼던 버전 · 칸을 누르면 그 버전과 장비 파일의 Diff",
    vPass: "통과", vWithin: "허용 오차 안", vBlock: "차단", vWithinN: "통과 · 허용 오차 안 {n}", vBlockN: "차단 {n}",
    boardEmpty: "장비 파일이 없습니다. 장비 PC 에서 가져온 레시피 파일을 열고 '장비 현재 파일'로 등록하세요.",
    baseline: "기준", candidate: "후보", baselineHint: "허용 오차 · 무시 항목. 바꾸려면 아래 '현장 검증 → 비교'에서 후보로 시작",
    check: "검사 전 검증", checkHint: "검사를 시작하기 전에 그 장비가 쓸 파일을 기준과 비교해 통과 / 차단과 사유를 냅니다",
    tool: "장비", ckPick: "검사할 파일 고르기", ckCurrent: "장비 현재 파일로 검증",
    diff: "Diff", diffHint: "섹션별로 묶어 보여줍니다. 허용 오차 · 단위 환산 · 무시 항목 반영", filter: "보기", fDiff: "차이만", fBlock: "차단만", fAll: "전체", useRules: "기준 규칙 적용",
    verifyTitle: "현장 검증 절차", verifyHint: "바꾸기 전에 같은 장비 파일로 확인하고, 1대에서 먼저 돌려 보고, 언제든 되돌립니다",
    vtRepro: "재현", vtCompare: "비교", vtShadow: "Shadow (1대 시범)", vtSwitch: "전환 · 롤백",
    history: "이력", historyHint: "버전 등록 · 장비 파일 변경 · 검증 · 기준 전환 · 롤백", kind: "종류", more: "더 보기",
    footer: "예시 세트는 가상의 레시피 DEMO-SCAN 과 장비 EQ-01~03 입니다 (실제 장비 · 레시피와 무관). 데이터는 이 기기에만 저장됩니다.",
    importTitle: "가져올 파일", importHint: "파일마다 레시피와 등록 방식을 고릅니다. '버전'은 기준 후보가 되는 레시피, '장비 현재 파일'은 장비 PC 에서 가져온 지금 쓰는 파일입니다.",
    cancel: "취소", importOk: "가져오기", pilotSection: "1대 시범", pilotRuns: "전환 전에 필요한 시범 장비 검증 통과 횟수",
    dataSection: "데이터", backupExport: "백업 내보내기 (JSON)", backupImport: "백업 가져오기", resetAll: "이 기기의 데이터 모두 지우기",
    dataHint: "저장 위치: 이 브라우저의 IndexedDB (버전 · 장비 파일 · 기준 · 검증 기록 · 이력). 서버로 보내지 않습니다.", close: "닫기", save: "저장",
    obTitle: "처음 오셨나요?",
    ob1: "<b>예시 세트</b>(레시피 1개 · 항목 40 · 버전 10 · 장비 3대)가 열려 있습니다. 현황판에서 EQ-03 이 왜 차단인지 눌러 보세요.",
    ob2: "<b>내 레시피</b>는 파일이나 폴더를 끌어다 놓습니다. JSON · INI · XML · CSV · key=value 를 읽습니다.",
    ob3: "기준을 바꿀 때는 '현장 검증'에서 <b>비교 → 1대 시범 → 전환</b> 순서로 갑니다. 롤백 묶음은 전환할 때 같이 만들어집니다.",
    obPrivacy: "파일은 이 브라우저 안에서만 읽고 이 기기에만 저장합니다. 외부 서버 · LLM 으로 보내지 않습니다.", obStart: "시작하기",
    errToast: "오류: {msg} (설정에 기록됨)", noRecipe: "레시피 없음",
    modePilot: "1대 시범 중: {tool} · {ver}", modeCompare: "후보 {ver} 비교 중", modeNone: "진행 중인 변경 없음",
    stRecipe: "레시피", stVersions: "버전", stTools: "장비", stBaseline: "기준", stBlocked: "차단 장비", noData: "아직 데이터가 없습니다. 예시 세트를 열거나 레시피 파일을 가져오세요.",
    curFile: "현재 파일", identified: "버전 식별", judgment: "기준 대비", nearVer: "{ver} 근처 · 차이 {n}", srcManual: "수동 기록", srcWatch: "감시",
    byCand: "후보 기준", byCandLong: "후보 기준 (시범 장비)", byBase: "현재 기준", byBaseShort: "현재", shadowLine: "옆 칸(Shadow):",
    cellCur: "지금 쓰는 버전", cellNear: "가장 가까운 버전, 차이 {n}", cellPast: "예전에 썼던 버전", cellNone: "쓴 적 없음",
    rPattern: "항목 (글롭)", rAllow: "허용", rNone: "허용 오차 규칙 없음 — 모든 항목이 정확히 같아야 합니다", rIgnore: "무시 항목:", rOr: " 또는 ", rExact: "정확히 같음",
    rUnit: "단위", rAbs: "절대값", noBaseline: "기준이 없습니다. 레시피 파일을 '버전'으로 가져오면 첫 버전이 기준이 됩니다.",
    baseVer: "기준 버전", since: "{t} 부터", viewParams: "파라미터 보기", candRunning: "후보 {ver} 진행 중 ({stage})", stagePilot: "1대 시범", stageCompare: "비교", goVerify: "현장 검증으로",
    startChange: "기준 변경 시작", ckPass: "통과 — 검사를 시작해도 됩니다", ckBlock: "차단 — 이 파일로는 검사를 시작하지 마세요",
    ckMeta: "{tool} · {file} · 판정 기준 {ver} ({by}) · {t}", ckReasons: "차단 사유 {n}건", ckWithin: "허용 오차 안의 차이 {n}건", ckSave: "결과 파일 내려받기 (JSON)", ckDiff: "Diff 로 보기",
    ckParseErr: "읽지 못한 줄 {n}개 (첫 줄 {line}) — 그 항목은 빠진 것으로 판정합니다",
    optVer: "버전", tagBase: "(기준)", tagCand: "(후보)", optTool: "장비", optCheck: "검증한 파일", diffEmpty: "비교할 버전이나 장비 파일이 없습니다.", diffNone: "차이가 없습니다.", noSection: "(섹션 없음)", nBlock: "차단 {n}",
    dParam: "항목", dStatus: "상태", dDetail: "차이 · 허용", dLine: "줄 (B)", dUnit: "{a} → {b} 로 바꿀 수 없음", dConv: "단위 환산: {v} {u}", dDeltaAllow: "{d} (허용 ±{a} {u})", dDelta: "{d}",
    unitAssumed: "한쪽에만 단위 — 같은 단위로 봄", ruleUnit: "규칙 단위를 환산할 수 없어 허용 0",
    setNow: "예시 · 지금 상태 (EQ-03 로컬 수정)", setAll8: "예시 · 모두 기준 v8", reproHint: "장비 파일 상태를 이름 붙여 저장해 두면, 나중에 같은 상태에서 기준 · 규칙 변경을 다시 비교할 수 있습니다.",
    setName: "재현 세트", setTools: "장비 · 차단", setSaved: "저장", builtIn: "내장", setSummary: "장비 {n} · 차단 {b}", setLoad: "열기", delete: "삭제", setEmpty: "저장한 세트가 없습니다.",
    setNameNew: "새 세트 이름", setNamePh: "예: 11월 Down 직전", setSave: "지금 장비 파일 상태 저장", setSavedToast: "재현 세트를 저장했습니다", setLoadedToast: "재현 세트를 열었습니다 (장비 파일 상태가 바뀜)",
    plannedN: "{a} → {b} 에서 바뀌는 항목 {n}개:", candVer: "후보 기준 버전", tolRules: "허용 오차 규칙", tolHint: "위에서부터 처음 맞는 규칙 하나. ±값과 ±% 가 둘 다 있으면 더 넓은 쪽",
    ruleAdd: "규칙 추가", ignoreLabel: "무시 항목 (한 줄에 하나, * 사용 가능)", cmpTitle: "같은 장비 파일로 비교", cmpSub: "현재 기준 {a} vs 후보 {b}", cmpNow: "현재 기준", cmpCand: "후보", cmpChanged: "상태가 바뀐 항목",
    flip: "판정 바뀜", noToolFiles: "장비 파일이 없습니다.", flipN: "장비 {total}대 중 {n}대의 판정이 바뀝니다.",
    cmpLive: "후보가 진행 중입니다. 여기서 고친 내용은 바로 후보에 들어가고, 시범 기록은 새로 셉니다.", cmpDraft: "초안입니다. 버전 · 규칙을 바꾸면 오른쪽 비교가 바로 바뀝니다. '후보로 시작'을 눌러야 Shadow 단계로 갈 수 있습니다.",
    candCancel: "후보 취소", candCancelConfirm: "후보를 취소할까요? 기준은 그대로입니다.", toShadow: "다음: 1대 시범", candStart: "후보로 시작",
    needCand: "진행 중인 후보가 없습니다. 먼저 비교 단계에서 후보를 시작하세요.", toCompare: "비교로", toSwitch: "다음: 전환 조건 확인",
    pilotHint: "후보 {ver}: 먼저 장비 1대에만 씁니다. 그 장비는 후보 기준으로 판정하고, 나머지 장비는 현재 기준으로 판정합니다. 모든 판정에서 다른 쪽 결과는 옆 칸(Shadow)에 남습니다.",
    pilotTool: "시범 장비", pilotStart: "1대 시범 시작", pilotOn: "시범 장비 {tool}: 후보 {ver} 기준으로 판정. 다른 장비: 현재 기준 {base} 로 판정하고, 후보 기준 결과는 옆 칸에만 보입니다.",
    ps1: "시범 묶음을 장비에 복사하고 적용을 확인", dlPilot: "시범 묶음 내려받기 (zip)", pilotImport: "시범 장비 파일 가져오기", markApplied: "적용됨으로 기록 (수동)", appliedYes: "후보 버전과 같은 파일 확인", appliedNo: "아직 후보 버전 파일이 아님",
    ps2: "시범 장비에서 검사 전 검증 {n}회 통과", pilotCheck: "시범 장비 검사 전 검증 실행", passCount: "통과 {n} / {need}",
    shadowFleet: "장비별 판정과 옆 칸", shadowFleetHint: "결정은 '판정' 칸, 다른 기준의 결과는 옆 칸", decides: "판정 (결정)", shadowCol: "옆 칸 (Shadow)", clsCol: "다른 이유",
    shadowLog: "시범 시작 뒤 검증 기록", shadowLogHint: "두 판정이 다른 경우 이유를 분류", time: "시각", noChecks: "아직 검증 기록이 없습니다.",
    cls_updated: "새 버전 파일 (예상)", cls_looser: "놓침 위험: 규칙이 느슨해져 통과", cls_needsFile: "새 파일 필요 (예상)", cls_tighter: "규칙이 엄격해져 차단",
    gateTitle: "후보 {ver} 전환 조건", g_pilot: "1대 시범을 시작함 ({tool})", g_applied: "시범 장비 파일이 후보 버전과 같음", g_runs: "시범 장비 검증 통과 {passes} / {need}회", g_noBlock: "시범 장비 차단 0건 (지금 {blocks}건)",
    g_looser: "놓침 위험 0", g_looserBad: "놓침 위험: 규칙이 느슨해져서만 통과 — {tools}", checksN: "검증 기록 {n}건", ack: "확인했고 의도한 변경입니다",
    switchBtn: "전환: 기준을 {ver} 로, 전체 배포 묶음 · 롤백 묶음 만들기", gateNotYet: "조건을 모두 채우면 켜집니다", noCandSwitch: "진행 중인 후보가 없습니다. 이전 기준으로 되돌리기와 묶음 검증은 아래에서 할 수 있습니다.",
    switchConfirm: "기준을 {ver} 로 바꿉니다. 이전 기준은 이력에 남고 언제든 되돌릴 수 있습니다.", switchedToast: "전환했습니다. 전체 배포 묶음과 롤백 묶음을 내려받으세요.",
    switched: "{t} 에 기준을 {ver} 로 전환", dlFleet: "전체 배포 묶음 (나머지 장비 {n}대)", dlRollback: "롤백 묶음 (장비 {n}대의 직전 파일)", rolledBack: "{t} 에 기준을 {ver} 로 롤백",
    rollbackConfirm: "기준을 {ver} 로 되돌립니다. 장비 파일은 롤백 묶음으로 되돌립니다.", rolledBackToast: "롤백했습니다. 롤백 묶음을 내려받아 장비에 복사하세요.",
    baseHistory: "기준 이력", period: "기간", rules: "규칙", now: "현재", ruleSummary: "허용 오차 {n} · 무시 {m}", rolledBackTag: "롤백됨", rollbackBtn: "직전 기준 {ver} 로 롤백", rollbackNone: "되돌릴 이전 기준 없음", rollbackRedo: "롤백 취소: 기준을 다시 {ver} 로",
    verifyBundle: "묶음 검증", verifyBundleHint: "장비 쪽에서 받은 zip 의 파일이 만들 때와 같은지 (SHA-256)", pickZip: "zip 고르기",
    vbOk: "검증 통과 — 묶음 안 파일이 모두 만들 때와 같습니다", vbBad: "검증 실패 — 아래 파일을 쓰지 마세요", vbMeta: "{kind} · {recipe} · 대상 {ver} · 장비 {n}대", vbMissing: "파일 없음", vbHash: "SHA-256 다름 (기대 {e}…, 실제 {a}…)",
    bundles: "만든 묶음", kind_pilot: "시범 묶음", kind_fleet: "전체 배포 묶음", kind_rollback: "롤백 묶음", download: "내려받기", appliedToast: "장비 {n}대에 적용됨으로 기록했습니다 (실제 파일로 확인하려면 다시 가져오세요)",
    allTools: "모든 장비", allKinds: "모든 종류", detail: "내용", noHistory: "이력이 없습니다.",
    ev_version: "버전 등록", ev_snap: "장비 파일", ev_check: "검사 전 검증", ev_baseline: "기준 지정", ev_cand: "후보", ev_pilot: "1대 시범", ev_switch: "전환", ev_rollback: "롤백", ev_bundle: "묶음", ev_set: "재현 세트",
    tooBig: "5MB 보다 큰 파일은 레시피로 보지 않습니다", binary: "글자 파일이 아닙니다", include: "가져오기", file: "파일", format: "형식", roleTarget: "버전 이름 / 장비", readResult: "읽은 결과",
    role: "등록 방식", roleVersion: "버전", roleTool: "장비 현재 파일", labelPh: "v11", readN: "항목 {n}개", errN: "읽지 못한 줄 {n}개", lineN: "{n}번째 줄",
    perr_empty: "빈 파일", perr_dup: "같은 항목이 또 나옴 (뒤의 값을 씀)", perr_json: "JSON 문법 오류", perr_noeq: "'키=값' 모양이 아님", perr_csvcols: "열이 모자람 (항목 · 값 필요)", perr_xmlsyntax: "XML 문법 오류", perr_xmlmismatch: "여는 태그와 닫는 태그가 다름", perr_xmlunclosed: "닫지 않은 태그",
    needRecipe: "레시피 이름이 필요합니다", verExists: "버전 {label} 이 이미 있습니다", importedN: "{n}개를 가져왔습니다",
    watchLost: "폴더 연결이 끊겼습니다 (권한 또는 이동)", watchChanged: "폴더에서 장비 파일 변경 {n}건을 감지해 기록했습니다", watchState: "연결된 폴더: {name} · 5초마다 확인 · 마지막 {t} (하위 폴더 이름 = 장비, versions 폴더 = 버전)",
    sampleConfirm: "예시 세트를 열면 지금 이 기기의 데이터가 예시로 바뀝니다. 먼저 백업하세요. 계속할까요?",
    errCount: "로컬 오류 기록 {n}건 · 저장소: {p}", persistYes: "IndexedDB", persistNo: "메모리 (새로고침하면 사라짐)", runsErr: "1~50 사이 정수", notBackup: "이 앱의 백업 파일이 아닙니다", backupLoaded: "백업을 가져왔습니다",
    resetConfirm: "이 기기에 저장한 버전 · 장비 파일 · 이력을 모두 지웁니다. 되돌릴 수 없습니다.", updateReady: "새 버전을 받았습니다. 새로고침하면 적용됩니다.",
    st_same: "같음", st_within: "허용 오차 안", st_ignored: "무시", st_out: "허용 오차 밖", st_changed: "값 다름", st_unit: "단위 맞지 않음", st_missing: "빠짐", st_added: "기준에 없음",
  },
  en: {
    skip: "Skip to content", appName: "Recipe Baseline Manager", recipe: "Recipe", language: "Language", theme: "Theme", help: "Help", settings: "Settings",
    heroTitle: "Which tool differs from the baseline, and what changed when",
    heroText: "Set baseline versions <b>from recipe files alone</b> — no SECS/GEM or MES link — and see per-tool differences with tolerances and units applied. When you change it, build the <b>one-tool pilot → fleet</b> deploy bundle and the <b>rollback bundle</b> on one screen. Files never leave this browser.",
    step1: "Import files · register baseline", step2: "Tool × version board · Diff", step3: "Pre-run check", step4: "Compare → one-tool pilot → switch · rollback",
    sourceTitle: "Import files", loadSample: "Sample set (synthetic)", openFiles: "Open recipe files", openFolder: "Import folder", watch: "Connect folder (watch)", watchStop: "Stop watching",
    dropHint: "You can also drop files or folders on this page", dropHere: "Drop to import",
    board: "Tool × version board", boardHint: "● version in use · ◐ closest version · ○ used before · click a cell to diff that version with the tool file",
    vPass: "Pass", vWithin: "Within tolerance", vBlock: "Block", vWithinN: "Pass · {n} within tolerance", vBlockN: "Block {n}",
    boardEmpty: "No tool files yet. Open recipe files taken from the tool PCs and register them as 'Tool current file'.",
    baseline: "Baseline", candidate: "Candidate", baselineHint: "Tolerances and ignored items. To change them, start a candidate under 'Field validation → Compare'",
    check: "Pre-run check", checkHint: "Before a run starts, compare the file that tool will use with the baseline: pass or block, with reasons",
    tool: "Tool", ckPick: "Choose file to check", ckCurrent: "Check the tool's current file",
    diff: "Diff", diffHint: "Grouped by section. Tolerances, unit conversion and ignored items applied", filter: "Show", fDiff: "Differences", fBlock: "Blocking only", fAll: "All", useRules: "Apply baseline rules",
    verifyTitle: "Field validation", verifyHint: "Check on the same tool files before changing, run on one tool first, and roll back any time",
    vtRepro: "Reproduce", vtCompare: "Compare", vtShadow: "Shadow (one-tool pilot)", vtSwitch: "Switch · rollback",
    history: "History", historyHint: "Versions, tool file changes, checks, baseline switches and rollbacks", kind: "Type", more: "Show more",
    footer: "The sample set is a fictional recipe DEMO-SCAN on tools EQ-01~03 (unrelated to real tools or recipes). Data stays on this device.",
    importTitle: "Files to import", importHint: "Pick a recipe and role per file. 'Version' is a recipe that can become the baseline; 'Tool current file' is what a tool PC is using now.",
    cancel: "Cancel", importOk: "Import", pilotSection: "One-tool pilot", pilotRuns: "Passing pilot checks required before switching",
    dataSection: "Data", backupExport: "Export backup (JSON)", backupImport: "Import backup", resetAll: "Delete all data on this device",
    dataHint: "Stored in this browser's IndexedDB (versions, tool files, baselines, checks, history). Nothing is sent to a server.", close: "Close", save: "Save",
    obTitle: "New here?",
    ob1: "The <b>sample set</b> (1 recipe · 40 parameters · 10 versions · 3 tools) is open. Click EQ-03 on the board to see why it is blocked.",
    ob2: "Drop <b>your recipe</b> files or folders. JSON, INI, XML, CSV and key=value are read.",
    ob3: "To change the baseline, go <b>Compare → one-tool pilot → switch</b> under 'Field validation'. The rollback bundle is built at the switch.",
    obPrivacy: "Files are read only inside this browser and stored only on this device. Nothing goes to an external server or LLM.", obStart: "Start",
    errToast: "Error: {msg} (logged in Settings)", noRecipe: "No recipe",
    modePilot: "Pilot: {ver} on {tool}", modeCompare: "Comparing candidate {ver}", modeNone: "No change in progress",
    stRecipe: "Recipe", stVersions: "Versions", stTools: "Tools", stBaseline: "Baseline", stBlocked: "Blocked tools", noData: "No data yet. Open the sample set or import recipe files.",
    curFile: "Current file", identified: "Version", judgment: "Vs baseline", nearVer: "near {ver} · {n} diffs", srcManual: "manual", srcWatch: "watched",
    byCand: "candidate", byCandLong: "candidate (pilot tool)", byBase: "baseline", byBaseShort: "current", shadowLine: "Shadow:",
    cellCur: "version in use", cellNear: "closest version, {n} diffs", cellPast: "used before", cellNone: "never used",
    rPattern: "Item (glob)", rAllow: "Allowed", rNone: "No tolerance rules — every item must match exactly", rIgnore: "Ignored:", rOr: " or ", rExact: "exact",
    rUnit: "Unit", rAbs: "absolute", noBaseline: "No baseline. Import a recipe file as a 'Version' and the first version becomes the baseline.",
    baseVer: "Baseline version", since: "since {t}", viewParams: "View parameters", candRunning: "Candidate {ver} in progress ({stage})", stagePilot: "one-tool pilot", stageCompare: "compare", goVerify: "Go to field validation",
    startChange: "Start a baseline change", ckPass: "PASS — the run may start", ckBlock: "BLOCK — do not start a run with this file",
    ckMeta: "{tool} · {file} · judged against {ver} ({by}) · {t}", ckReasons: "{n} blocking reason(s)", ckWithin: "{n} difference(s) within tolerance", ckSave: "Download result (JSON)", ckDiff: "View as diff",
    ckParseErr: "{n} unreadable line(s) (first: line {line}) — those items count as missing",
    optVer: "Version", tagBase: "(baseline)", tagCand: "(candidate)", optTool: "Tool", optCheck: "Checked file", diffEmpty: "Nothing to compare yet.", diffNone: "No differences.", noSection: "(no section)", nBlock: "{n} blocking",
    dParam: "Item", dStatus: "Status", dDetail: "Delta · allowed", dLine: "Line (B)", dUnit: "cannot convert {a} to {b}", dConv: "converted: {v} {u}", dDeltaAllow: "{d} (allowed ±{a} {u})", dDelta: "{d}",
    unitAssumed: "unit on one side only — treated as the same unit", ruleUnit: "rule unit not convertible, allowed 0",
    setNow: "Sample · now (EQ-03 local edit)", setAll8: "Sample · all on baseline v8", reproHint: "Save the tool file state under a name and re-run baseline or rule changes against that same state later.",
    setName: "Reproduction set", setTools: "Tools · blocked", setSaved: "Saved", builtIn: "built-in", setSummary: "{n} tools · {b} blocked", setLoad: "Open", delete: "Delete", setEmpty: "No saved sets.",
    setNameNew: "New set name", setNamePh: "e.g. before the Nov down", setSave: "Save current tool file state", setSavedToast: "Reproduction set saved", setLoadedToast: "Reproduction set opened (tool file state changed)",
    plannedN: "{n} item(s) change from {a} to {b}:", candVer: "Candidate baseline version", tolRules: "Tolerance rules", tolHint: "First matching rule from the top. With both ± and ±%, the wider one applies",
    ruleAdd: "Add rule", ignoreLabel: "Ignored items (one per line, * allowed)", cmpTitle: "Compare on the same tool files", cmpSub: "baseline {a} vs candidate {b}", cmpNow: "Baseline", cmpCand: "Candidate", cmpChanged: "Items whose status changed",
    flip: "result flips", noToolFiles: "No tool files.", flipN: "{n} of {total} tools change result.",
    cmpLive: "A candidate is in progress. Edits here go straight into it, and the pilot count restarts.", cmpDraft: "Draft. Changing the version or rules updates the comparison at once. Press 'Start candidate' to move on to Shadow.",
    candCancel: "Cancel candidate", candCancelConfirm: "Cancel the candidate? The baseline stays as is.", toShadow: "Next: one-tool pilot", candStart: "Start candidate",
    needCand: "No candidate in progress. Start one in the Compare step first.", toCompare: "Go to Compare", toSwitch: "Next: switch conditions",
    pilotHint: "Use candidate {ver} on one tool first. That tool is judged by the candidate; the others are still judged by the baseline. Every check keeps the other result in the Shadow column.",
    pilotTool: "Pilot tool", pilotStart: "Start one-tool pilot", pilotOn: "Pilot tool {tool} is judged by candidate {ver}. Other tools are judged by baseline {base}; the candidate result is shown only alongside.",
    ps1: "Copy the pilot bundle to the tool and confirm it", dlPilot: "Download pilot bundle (zip)", pilotImport: "Import pilot tool file", markApplied: "Record as applied (manual)", appliedYes: "file matches the candidate version", appliedNo: "not the candidate version yet",
    ps2: "Pass {n} pre-run checks on the pilot tool", pilotCheck: "Run pre-run check on pilot tool", passCount: "passed {n} / {need}",
    shadowFleet: "Per-tool result and Shadow", shadowFleetHint: "The 'decides' column decides; the other baseline's result sits alongside", decides: "Decides", shadowCol: "Shadow", clsCol: "Why they differ",
    shadowLog: "Checks since the pilot started", shadowLogHint: "When the two results differ, the reason is classified", time: "Time", noChecks: "No checks yet.",
    cls_updated: "new version file (expected)", cls_looser: "miss risk: passes because rules got looser", cls_needsFile: "needs new file (expected)", cls_tighter: "blocked by stricter rules",
    gateTitle: "Conditions to switch to {ver}", g_pilot: "one-tool pilot started ({tool})", g_applied: "pilot tool file equals the candidate version", g_runs: "pilot checks passed {passes} / {need}", g_noBlock: "pilot blocks: 0 (now {blocks})",
    g_looser: "miss risk 0", g_looserBad: "miss risk: passing only because rules got looser — {tools}", checksN: "{n} check record(s)", ack: "Reviewed — this change is intended",
    switchBtn: "Switch: make {ver} the baseline, build fleet and rollback bundles", gateNotYet: "Enabled once every condition is met", noCandSwitch: "No candidate in progress. Rolling back and verifying bundles are available below.",
    switchConfirm: "Make {ver} the baseline. The previous baseline stays in history and can be restored any time.", switchedToast: "Switched. Download the fleet bundle and the rollback bundle.",
    switched: "Switched baseline to {ver} at {t}", dlFleet: "Fleet bundle (other {n} tools)", dlRollback: "Rollback bundle (previous files of {n} tools)", rolledBack: "Rolled baseline back to {ver} at {t}",
    rollbackConfirm: "Restore baseline {ver}. Tool files go back with the rollback bundle.", rolledBackToast: "Rolled back. Download the rollback bundle and copy it to the tools.",
    baseHistory: "Baseline history", period: "Period", rules: "Rules", now: "current", ruleSummary: "{n} tolerance · {m} ignored", rolledBackTag: "rolled back", rollbackBtn: "Roll back to previous baseline {ver}", rollbackNone: "No previous baseline", rollbackRedo: "Undo rollback: back to {ver}",
    verifyBundle: "Verify bundle", verifyBundleHint: "Check that the files in a received zip are unchanged (SHA-256)", pickZip: "Choose zip",
    vbOk: "Verified — every file matches what was built", vbBad: "Verification failed — do not use the files below", vbMeta: "{kind} · {recipe} · target {ver} · {n} tools", vbMissing: "missing", vbHash: "SHA-256 differs (expected {e}…, got {a}…)",
    bundles: "Bundles built", kind_pilot: "pilot bundle", kind_fleet: "fleet bundle", kind_rollback: "rollback bundle", download: "Download", appliedToast: "Recorded as applied on {n} tool(s) (import the real files to confirm)",
    allTools: "All tools", allKinds: "All types", detail: "Detail", noHistory: "No history.",
    ev_version: "version", ev_snap: "tool file", ev_check: "pre-run check", ev_baseline: "baseline set", ev_cand: "candidate", ev_pilot: "pilot", ev_switch: "switch", ev_rollback: "rollback", ev_bundle: "bundle", ev_set: "reproduction set",
    tooBig: "Files over 5 MB are not treated as recipes", binary: "Not a text file", include: "Import", file: "File", format: "Format", roleTarget: "Version name / tool", readResult: "Read result",
    role: "Role", roleVersion: "Version", roleTool: "Tool current file", labelPh: "v11", readN: "{n} items", errN: "{n} unreadable line(s)", lineN: "line {n}",
    perr_empty: "empty file", perr_dup: "duplicate item (later value used)", perr_json: "JSON syntax error", perr_noeq: "not a 'key=value' line", perr_csvcols: "too few columns (need item and value)", perr_xmlsyntax: "XML syntax error", perr_xmlmismatch: "closing tag does not match", perr_xmlunclosed: "unclosed tag",
    needRecipe: "Recipe name required", verExists: "Version {label} already exists", importedN: "Imported {n} file(s)",
    watchLost: "Folder connection lost (permission or moved)", watchChanged: "Detected and recorded {n} tool file change(s) in the folder", watchState: "Connected folder: {name} · checked every 5 s · last {t} (subfolder name = tool, 'versions' folder = versions)",
    sampleConfirm: "Opening the sample set replaces the data on this device. Export a backup first. Continue?",
    errCount: "{n} local error record(s) · storage: {p}", persistYes: "IndexedDB", persistNo: "memory (lost on reload)", runsErr: "Integer from 1 to 50", notBackup: "Not a backup from this app", backupLoaded: "Backup imported",
    resetConfirm: "Delete all versions, tool files and history stored on this device. This cannot be undone.", updateReady: "A new version is ready. Reload to apply.",
    st_same: "same", st_within: "within tolerance", st_ignored: "ignored", st_out: "out of tolerance", st_changed: "value differs", st_unit: "unit mismatch", st_missing: "missing", st_added: "not in baseline",
  },
};

let cur = "ko";
export const lang = () => cur;
export const setLang = (l) => { cur = S[l] ? l : "en"; document.documentElement.lang = cur; };
export function t(key, vars = {}) {
  const s = S[cur][key] ?? S.ko[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? ""));
}
export function applyI18n(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll("[data-i18n-attr]")) for (const pair of el.dataset.i18nAttr.split(";")) { const [a, k] = pair.split(":"); el.setAttribute(a, t(k)); }
  document.title = t("appName");
}
export const statusName = (s) => t("st_" + s);

// 차단 · 허용 사유 한 줄 (HTML)
export function reasonText(r) {
  const p = `<code>${esc(r.path)}</code>`, line = r.line ? ` <small>(${esc(t("lineN", { n: r.line }))})</small>` : "";
  const u = r.unit ? " " + r.unit : "";
  const ko = cur === "ko";
  const d = r.delta !== undefined ? `${r.delta > 0 ? "+" : ""}${r.delta}${u}` : "";
  switch (r.status) {
    case "out": return `${p}: ${esc(r.act)} — ${ko ? `기준 ${esc(r.base)}, 허용 ±${esc(r.allow)}${esc(u)} 초과 (차이 ${esc(d)})` : `baseline ${esc(r.base)}, exceeds ±${esc(r.allow)}${esc(u)} (delta ${esc(d)})`}${line}`;
    case "within": return `${p}: ${esc(r.act)} — ${ko ? `기준 ${esc(r.base)}, 허용 ±${esc(r.allow)}${esc(u)} 안 (차이 ${esc(d)})` : `baseline ${esc(r.base)}, within ±${esc(r.allow)}${esc(u)} (delta ${esc(d)})`}${line}`;
    case "changed": return `${p}: '${esc(r.act)}' ≠ ${ko ? "기준" : "baseline"} '${esc(r.base)}'${line}`;
    case "unit": return `${p}: ${ko ? `단위 ${esc(r.unitA)} → 기준 단위 ${esc(r.unitB)} 환산 불가` : `unit ${esc(r.unitA)} cannot be converted to baseline unit ${esc(r.unitB)}`} (${esc(r.act)} / ${esc(r.base)})${line}`;
    case "missing": return `${p}: ${ko ? `파일에 없음 (기준 ${esc(r.base)})` : `missing from file (baseline ${esc(r.base)})`}`;
    case "added": return `${p}: ${ko ? `기준에 없는 항목 (${esc(r.act)})` : `not in baseline (${esc(r.act)})`}${line}`;
    default: return `${p}: ${esc(statusName(r.status))}`;
  }
}

// 이력 한 줄
export function evText(h, { vLabel, toolName, snap }) {
  const ko = cur === "ko";
  switch (h.type) {
    case "version": return ko ? `${h.recipe} 버전 ${h.label} 등록` : `${h.recipe} version ${h.label} registered`;
    case "baseline": return ko ? `기준을 ${h.label || vLabel(h.ver)} 로 지정${h.why === "first" ? " (첫 버전)" : ""}` : `baseline set to ${h.label || vLabel(h.ver)}${h.why === "first" ? " (first version)" : ""}`;
    case "snap": { const s = snap(h.snap); return `${s?.fileName || ""} · ${h.changed ? (ko ? "내용 바뀜" : "content changed") : ko ? "가져옴" : "imported"}${h.source === "watch" ? (ko ? " (폴더 감시)" : " (watched)") : h.source === "manual" ? (ko ? " (수동 기록)" : " (manual)") : ""}`; }
    case "check": return `${h.pass ? (ko ? "통과" : "pass") : ko ? `차단 ${h.n}건` : `block ${h.n}`} · ${h.by === "cand" ? (ko ? "후보 기준" : "candidate") : ko ? "현재 기준" : "baseline"}`;
    case "cand": return h.what === "cancel" ? (ko ? `후보 ${vLabel(h.ver)} 취소` : `candidate ${vLabel(h.ver)} cancelled`) : ko ? `후보 ${h.label || vLabel(h.ver)} 시작` : `candidate ${h.label || vLabel(h.ver)} started`;
    case "pilot": return ko ? `${toolName(h.tool)} 에서 ${h.label || vLabel(h.ver)} 1대 시범 시작` : `pilot of ${h.label || vLabel(h.ver)} on ${toolName(h.tool)}`;
    case "switch": return ko ? `기준 ${vLabel(h.from)} → ${h.label || vLabel(h.ver)} 전환` : `baseline ${vLabel(h.from)} → ${h.label || vLabel(h.ver)}`;
    case "rollback": return ko ? `기준 ${vLabel(h.from)} → ${h.label || vLabel(h.ver)} 롤백` : `rolled back ${vLabel(h.from)} → ${h.label || vLabel(h.ver)}`;
    case "bundle": return `${t("kind_" + h.kind)} · ${h.name || ""}`;
    case "set": return `${h.what === "save" ? (ko ? "저장" : "saved") : ko ? "열기" : "opened"} · ${h.name === "sample:now" ? t("setNow") : h.name === "sample:allv8" ? t("setAll8") : h.name}`;
    default: return "";
  }
}

const HELP = {
  ko: `<h3>사용 순서</h3><ol>
<li><b>버전 등록</b>: 기준이 될 수 있는 레시피 파일을 '버전'으로 가져옵니다. 첫 버전이 기준이 됩니다.</li>
<li><b>장비 파일</b>: 장비 PC 에서 복사한 지금 쓰는 파일을 '장비 현재 파일'로 가져옵니다. 폴더를 가져오면 하위 폴더 이름이 장비 이름이 되고, <code>versions</code> 폴더 안 파일은 버전이 됩니다.</li>
<li><b>현황판</b>: 장비마다 어느 버전과 같은지(●), 가장 가까운 버전(◐), 예전에 쓴 버전(○), 기준 대비 판정을 봅니다. 칸을 누르면 Diff 로 갑니다.</li>
<li><b>검사 전 검증</b>: 검사 직전 파일을 기준과 비교해 통과 / 차단과 사유를 냅니다. 결과는 JSON 으로 내려받을 수 있습니다.</li>
<li><b>기준 변경</b>: 현장 검증 → 비교(같은 장비 파일로 판정 비교) → Shadow(1대 시범, 다른 기준 결과는 옆 칸) → 전환(조건을 채우면) · 롤백.</li></ol>
<h3>읽는 형식</h3><ul>
<li><b>JSON</b>: 중첩 객체는 <code>섹션.키</code>. <code>{"value": 1.5, "unit": "ms"}</code> 는 값 + 단위, <code>[{"name": "Gain", "value": 6}]</code> 는 name 을 키로.</li>
<li><b>INI</b>: <code>[섹션]</code> 아래 <code>키=값</code>. <code>;</code> <code>#</code> 주석. <b>key=value</b>: 섹션 없이 <code>Optics.Gain = 6.5 dB</code>.</li>
<li><b>XML</b>: 루트 요소 이름은 경로에 넣지 않습니다. <code>name</code> · <code>value</code> · <code>unit</code> 속성(대소문자 무관)을 알아보고, 없으면 요소 이름과 글자를 씁니다.</li>
<li><b>CSV</b>: 머리글이 <code>name</code>/<code>value</code>(/<code>unit</code>/<code>section</code>)이면 그 열, 아니면 1열 = 항목, 2열 = 값, 3열 = 단위. 구분자 , ; Tab | 자동.</li>
<li>인코딩은 UTF-8 · UTF-16(BOM) · EUC-KR 을 자동으로 고릅니다. 읽지 못한 줄은 줄 번호와 이유를 보여주고, 그 항목은 '빠짐'으로 판정합니다.</li></ul>
<h3>판정</h3><ul>
<li>통과: 같음 · 허용 오차 안 · 무시 항목. 차단: 허용 오차 밖 · 값 다름 · 단위 맞지 않음 · 빠짐 · 기준에 없음.</li>
<li>단위: nm · um · mm, ns · us · ms · s · min, Hz · kHz · MHz, deg · rad, Pa · Torr, V · A, % 를 환산합니다. 목록에 없는 단위는 글자가 같아야 같습니다.</li>
<li>허용 오차 규칙은 위에서부터 처음 맞는 하나를 씁니다. 항목 이름은 대소문자를 가리지 않습니다.</li></ul>
<h3>배포 · 롤백 묶음</h3><p>zip 안에 <code>recipe/</code>(대상 파일), <code>rollback/&lt;장비&gt;/</code>(각 장비의 직전 파일), <code>manifest.json</code>, <code>SHA256SUMS</code> 가 있습니다. 이 앱은 장비에 직접 쓰지 않습니다. 묶음을 장비에 복사한 뒤 장비 파일을 다시 가져오거나(또는 폴더 감시) '적용됨으로 기록'을 누릅니다.</p>
<h3>FAQ</h3><dl>
<dt>데이터는 어디에 있나요?</dt><dd>이 브라우저의 IndexedDB 에만 있습니다. 서버 · LLM · 외부 오류 수집으로 보내지 않습니다. 설정에서 JSON 백업을 내보내고 가져옵니다.</dd>
<dt>장비와 연결하나요?</dt><dd>아니요. SECS/GEM · MES 연동 없이 파일만 씁니다. 폴더 감시(Chrome · Edge)는 장비 PC 의 공유 폴더를 이 PC 에서 연 경우에 씁니다.</dd>
<dt>오프라인에서도 되나요?</dt><dd>한 번 열면 앱 파일을 저장해 두어 오프라인에서도 열립니다. '앱 설치'로 PWA 로 설치할 수 있습니다.</dd>
<dt>예시 세트는 실제 데이터인가요?</dt><dd>아니요. 가상의 레시피 DEMO-SCAN 과 장비 EQ-01~03 입니다.</dd></dl>`,
  en: `<h3>How to use</h3><ol>
<li><b>Register versions</b>: import recipe files that may become the baseline as 'Version'. The first version becomes the baseline.</li>
<li><b>Tool files</b>: import the file each tool PC is using as 'Tool current file'. When you import a folder, subfolder names become tool names and files in a <code>versions</code> folder become versions.</li>
<li><b>Board</b>: per tool, which version it equals (●), the closest one (◐), versions used before (○) and the result against the baseline. Click a cell for the diff.</li>
<li><b>Pre-run check</b>: compare the file about to run with the baseline — pass or block, with reasons. Download the result as JSON.</li>
<li><b>Change the baseline</b>: Field validation → Compare (results on the same tool files) → Shadow (one-tool pilot, other result alongside) → Switch (once conditions are met) · Rollback.</li></ol>
<h3>Formats</h3><ul>
<li><b>JSON</b>: nested objects become <code>section.key</code>. <code>{"value": 1.5, "unit": "ms"}</code> is value + unit; <code>[{"name": "Gain", "value": 6}]</code> uses name as the key.</li>
<li><b>INI</b>: <code>key=value</code> under <code>[section]</code>, <code>;</code> <code>#</code> comments. <b>key=value</b>: no sections, e.g. <code>Optics.Gain = 6.5 dB</code>.</li>
<li><b>XML</b>: the root element name is not part of paths. <code>name</code> / <code>value</code> / <code>unit</code> attributes (any case) are recognised; otherwise element names and text are used.</li>
<li><b>CSV</b>: header <code>name</code>/<code>value</code>(/<code>unit</code>/<code>section</code>) or column 1 = item, 2 = value, 3 = unit. Delimiter , ; Tab | detected.</li>
<li>UTF-8, UTF-16 (BOM) and EUC-KR are detected. Unreadable lines are listed with line number and reason; those items count as missing.</li></ul>
<h3>Results</h3><ul>
<li>Pass: same, within tolerance, ignored. Block: out of tolerance, value differs, unit mismatch, missing, not in baseline.</li>
<li>Units converted: nm · um · mm, ns · us · ms · s · min, Hz · kHz · MHz, deg · rad, Pa · Torr, V · A, %. Other units must match as text.</li>
<li>The first matching tolerance rule from the top applies. Item names are case-insensitive.</li></ul>
<h3>Deploy and rollback bundles</h3><p>The zip holds <code>recipe/</code> (target file), <code>rollback/&lt;tool&gt;/</code> (each tool's previous file), <code>manifest.json</code> and <code>SHA256SUMS</code>. The app never writes to tools. After copying the bundle, import the tool files again (or watch the folder), or press 'Record as applied'.</p>
<h3>FAQ</h3><dl>
<dt>Where is my data?</dt><dd>Only in this browser's IndexedDB. Nothing goes to a server, an LLM or an external error collector. Export and import JSON backups in Settings.</dd>
<dt>Does it connect to tools?</dt><dd>No. No SECS/GEM or MES link, files only. Folder watching (Chrome, Edge) is for tool PC shares opened from this PC.</dd>
<dt>Does it work offline?</dt><dd>After the first visit the app files are cached and it opens offline. Install it as a PWA with 'Install app'.</dd>
<dt>Is the sample real data?</dt><dd>No. DEMO-SCAN and tools EQ-01~03 are fictional.</dd></dl>`,
};
export const helpHtml = () => HELP[cur];
