# 레시피 기준 관리 (recipe-golden)

장비 레시피 파일만으로 **기준 버전**을 정하고, 허용 오차 · 단위를 반영해 **장비별 차이**를 보고, 바꿀 때는 **1대 시범 → 전체 배포 묶음과 롤백 묶음**을 한 화면에서 만드는 웹 앱(PWA)입니다. 서버가 없고, 파일은 브라우저 밖으로 나가지 않습니다.

**바로 열기: https://mhbae-semi-lab.github.io/recipe-golden/** (설치 없음, 예시 세트가 열려 있음)

로컬 실행: `python -m http.server 8734 --bind 127.0.0.1` → `http://127.0.0.1:8734/`

[English summary](#english)

## 1. 관점

장비 쪽 엔지니어가 보는 기준 관리입니다. SECS/GEM · MES 연동 없이 **레시피 파일만으로** "어느 장비가 기준과 다른가, 무엇이 언제 바뀌었나"를 봅니다. 범용 Diff 도구는 파일을 줄로 보지만, 이 앱은 **레시피 · 파라미터 · 단위 · 허용 오차 · 장비 · 버전 · 기준**을 기본 개념으로 다룹니다.

## 2. 해결

- **형식 가져오기**: JSON · INI · XML · CSV · key=value 를 같은 파라미터 트리(`섹션.키`)로 읽습니다. 인코딩(UTF-8 · UTF-16 · EUC-KR) 자동, 읽지 못한 줄은 줄 번호와 이유를 보여줍니다. 폴더를 가져오면 하위 폴더 이름이 장비가 됩니다 (Chrome · Edge 는 폴더 변경 감시).
- **기준 등록 · Diff**: 허용 오차(±값, ±%), 단위 환산(1.5 ms = 1500 us), 무시 항목을 반영해 항목마다 같음 · 허용 오차 안 · 허용 오차 밖 · 값 다름 · 단위 맞지 않음 · 빠짐 · 기준에 없음으로 나눕니다.
- **장비 × 버전 현황판**: 장비마다 어느 등록 버전과 같은지(형식이 달라도), 가장 가까운 버전과 차이 수, 예전에 쓴 버전, 기준 대비 판정을 한 표로 봅니다.
- **검사 전 검증**: 검사 직전 파일을 기준과 비교해 통과 / 차단과 사유(항목 · 값 · 허용 · 줄 번호)를 내고 결과를 JSON 으로 남깁니다.
- **배포 묶음 · 롤백**: 대상 레시피 + 각 장비의 직전 파일 + `manifest.json` + `SHA256SUMS` 를 zip 하나로. 받은 묶음은 앱에서 다시 검증합니다.
- **현장 검증 절차**: 재현(장비 파일 상태를 세트로 저장) → 비교(같은 장비 파일로 현재 기준 vs 후보) → Shadow(1대 시범, 다른 기준의 결과는 옆 칸) → 전환(조건 충족 시) · 롤백. 모든 변경은 이력에 남습니다.

## 3. 상용 비교 · 차별점 (조사 2026-11-21 ~ 22)

| 제품 | 형태 | 이 앱과 관련된 기능 |
|---|---|---|
| Critical Manufacturing MES — Recipe Management | MES 별도 라이선스 모듈 | 두 버전 비교, 변경 이력, 접근 · 변경 통제, golden recipe 사용 보장, SEMI E139 모델 |
| camLine (Elisa IndustrIQ) LineWorks RM | 팹 RMS | 업로드 후 비교(golden recipe 강제 · drift 방지), 비교 · 승인 · 통제된 배포. SECS 가 없는 장비는 단순 방식 |
| BISTel eRMS (Synopsys) | 팹 RMS | 장비 안 · 장비 사이 버전 비교, 업/다운로드, 이력 |
| Sepasoft Settings & Changeover (Ignition) | MES 모듈 | 레시피 값과 PLC 실제 값의 차이 기록, 값마다 허용 범위(%, 고정값), 변경 기록 |
| AUVESY-MDT octoplant | 자동화 변경 관리 | 장비(PLC 등) 백업 · 버전 비교 · 복원, 변경 감지 알림 |
| Nautobot Golden Config | 오픈소스 (네트워크 장비) | 의도한 설정 vs 백업 설정 준수 검사, 수정안 생성 (Nautobot 서버 · 장비 접속 필요) |
| OIPT RecipeViewer | 오픈소스 (특정 장비사) | Oxford Instruments 레시피 묶음의 차이 보기 |
| Cimetrix (PDF Solutions) | GEM 툴킷 | 장비 쪽 레시피 서비스 구현용 (RMS 앱 아님) |

출처: [Critical Manufacturing 11.2 데이터시트](https://www.criticalmanufacturing.com/wp-content/uploads/2025/10/Pag_23-24.pdf) · [Critical Manufacturing 레시피 관리 안내서](https://help.criticalmanufacturing.com/tutorials/modules/recipe-management/recipemanagement/recipemanagement.pdf) · [camLine LineWorks RM](https://www.camline.com/products/lineworks/lineworks-rm-recipe-management-system) · [Elisa IndustrIQ RMS 블로그](https://www.elisaindustriq.com/resources/blog/recipe-management-system-semiconductor-manufacturing) · [BISTel eRMS](https://origin-www.synopsys.com/content/dam/synopsys/silicon/datasheets/bistel-erms.pdf) · [Sepasoft variance logging](https://docs.sepasoft.com/articles/user-manual/variance-logging/) · [octoplant](https://auvesy-mdt.com/en/octoplant/safeguarding-assets) · [Nautobot Golden Config](https://docs.nautobot.com/projects/golden-config/) · [OIPT RecipeViewer](https://github.com/VincentVandalon/OIPT-RecipeViewerPublic) · [Cimetrix RaP](https://www.cimetrix.com/rap-rri) · [SEMI E42](https://store-us.semi.org/products/e04200-semi-e42-recipe-management-standard-concepts-behavior-and-message-services) · [Grafana Fleet canary](https://grafana.com/docs/grafana-cloud/send-data/fleet-management/manage-fleet/guides/minimize-risk/) · [Slack Chef 단계 배포](https://www.infoq.com/news/2026/01/slack-chef-deployments)

**이 앱이 다른 점** (조사한 제품 중에서 찾지 못함, 2026-11 기준)

1. **파일만으로 동작**합니다. SECS/GEM · MES · 서버 · 에이전트 없이 브라우저에서 레시피 파일로 기준 · 장비별 판정 · 이력 · 묶음까지 처리하고, 5가지 형식을 같은 파라미터 트리로 읽어 형식이 달라도 같은 버전으로 식별합니다. 로컬 우선, 무료(MIT). 조사한 상용 RMS 는 MES · 서버 · SECS 또는 PLC 연결이 전제이고, 무료 파일 기반 도구(OIPT RecipeViewer)는 한 장비사 형식의 차이 보기입니다.
2. **장비 × 버전 현황판, 단계적 배포 묶음(1대 시범을 Shadow 로 확인 → 전체), 롤백 묶음을 한 화면**에서 다룹니다. 시범 장비 파일이 후보 버전과 같은지, 시범 검증 통과 횟수, 규칙이 느슨해져 통과하는 장비(놓침 위험)가 전환 조건이 되고, 전환할 때 모든 장비의 직전 파일로 롤백 묶음을 같이 만듭니다. 단계적 배포(canary) 자체는 IT 배포 도구의 일반 관행이며, 조사한 레시피 관리 제품에서는 승인 · 통제된 배포까지만 확인했습니다.

SEMI E42 는 비활성 표준이라 준수를 주장하지 않습니다.

## 4. 설치 · 사용

- 웹 주소(https://mhbae-semi-lab.github.io/recipe-golden/)에서 바로 열거나, 브라우저의 "앱 설치"로 PWA 를 설치합니다. 한 번 열면 오프라인에서도 열립니다.
- 정적 파일만 있고 빌드 단계가 없습니다. 내 PC 에서는 위 명령으로 로컬 서버를 엽니다.
- 사용 순서: 예시 세트(합성)가 처음부터 열려 있습니다 → 현황판에서 EQ-03 의 "차단 3" 을 누르면 Diff → 검사 전 검증 → 현장 검증에서 비교 → 1대 시범 → 전환 · 롤백.
- 내 데이터: 레시피 파일을 "버전"으로, 장비 PC 에서 가져온 파일을 "장비 현재 파일"로 가져옵니다. 폴더는 `<폴더>/<장비>/<파일>`, `<폴더>/versions/<파일>` 구조를 알아봅니다.
- 저장: 이 브라우저의 IndexedDB. 설정에서 JSON 백업 · 가져오기 · 전체 삭제. LLM 을 쓰지 않고, 외부로 보내는 요청이 없습니다.
- 사용자 매뉴얼: [docs/manual/Recipe-Golden-User-Manual-ko.pdf](docs/manual/Recipe-Golden-User-Manual-ko.pdf)

### 개발

```
node --test                                   # 단위 · 흐름 테스트 (의존성 없음, Node 20+)
node tools/measure.mjs                        # 허용 오차 판정 · 차단 사유 · 버전 식별 정확도
node tools/scenario.mjs                       # 1대 시범 → 전환 → 롤백 시나리오 측정
node docs/manual/capture.mjs                  # 매뉴얼 화면 캡처 (로컬 서버 실행 중, Chrome 필요)
python docs/manual/build_manual.py --pdf      # 매뉴얼 PPTX · PDF 생성 (python-pptx, PowerPoint)
```

`vendor/pretendard/` 는 `pretendard@1.3.9` 의 `dist/web/static/woff2-subset` 중 쓰는 굵기 4종입니다. 외부 CDN 을 쓰지 않습니다.

## 5. 측정값 (Node 24, 2026-11-22)

| 항목 | 결과 |
|---|---|
| 허용 오차 판정 (합성 세트 항목 40, 기준 v8 에 변경 1개씩 넣은 사례 162 × 형식 5) | 810회 중 810회 정답. 기대 차단 485 → 차단 485, 기대 통과 325 → 통과 325 ([결과](docs/measurements/accuracy.json)) |
| 차단 사유 | 차단 485건 모두 사유가 정확히 그 항목 · 상태 하나 |
| 버전 식별 (버전 10 × 형식 5) | 50 / 50 |
| 판정 속도 | 1회 평균 0.43 ms (파싱 포함), 항목 5,000개 INI ↔ XML 비교 75 ms |
| 현황판 계산 (항목 500 × 버전 10 × 장비 20) | 처음 0.5초, 다시 그릴 때 0.04초 (버전 식별 결과를 파일 · 규칙별로 기억). 항목 2,000 이면 처음 약 2.5초 |
| 브라우저 첫 화면 (Chrome, 로컬 서버) | load 195 ms, 요청 14개 · 32 KB, 외부 주소 요청 0, 오프라인(서버 중지)에서도 열림 |
| 1대 시범 → 전환 → 롤백 ([결과](docs/measurements/scenario.json)) | 시범 검증 3회 통과 뒤 전환 조건 충족, 롤백 묶음의 파일이 장비 3대의 변경 전 파일과 SHA-256 3 / 3 일치, 묶음 안 파일 1바이트 변조 탐지 |

## 6. 한계

- 장비에 직접 쓰지 않습니다. 묶음 복사는 사람이 하고, 적용 확인은 장비 파일을 다시 가져오거나 폴더 감시로 합니다 ("적용됨으로 기록"은 확인되지 않은 수동 기록으로 표시).
- 텍스트 형식만 읽습니다. 바이너리 · 암호화된 장비 고유 형식, 5MB 를 넘는 파일은 받지 않습니다.
- 한 사람 · 한 브라우저용입니다. 여러 사람의 승인 흐름 · 권한은 없고, 공유는 백업 JSON 으로 합니다.
- 검사 전 검증은 이 앱에서 실행합니다. 장비 SW 와 자동으로 주고받는 연동은 없습니다.
- 단위 환산은 길이 · 시간 · 주파수 · 각도 · 압력 · 전압 · 전류 · % 만, 그 밖의 단위는 글자가 같아야 같습니다.
- 폴더 감시는 Chrome · Edge 에서 페이지가 열려 있을 때만 5초마다 확인하고, 새로고침하면 다시 연결해야 합니다.

## 7. 만든 방법

배민혁이 설계하고, 구현 · 테스트 · 문서 작성에 AI 코딩 도구(Claude Code)를 썼습니다. 예시 레시피 · 장비 · 값은 모두 합성 데이터이며 실제 장비 · 레시피와 관련이 없습니다.

라이선스: MIT. 포함한 서드파티: Pretendard (SIL OFL 1.1).

---

## English

**Recipe Baseline Manager** sets baseline versions from equipment recipe files alone, shows per-tool differences with tolerances and unit conversion applied, and builds the **one-tool pilot → fleet deploy bundle and the rollback bundle** on one screen. No server; files never leave the browser.

- Formats: JSON, INI, XML, CSV and key=value read into one parameter tree; UTF-8 / UTF-16 / EUC-KR detection; unreadable lines listed with line number and reason. Folder import maps subfolders to tools (folder watching in Chrome and Edge).
- Diff statuses: same, within tolerance, ignored (pass); out of tolerance, value differs, unit mismatch, missing, not in baseline (block).
- Field validation flow: reproduce (saved tool-file sets) → compare (baseline vs candidate on the same tool files) → shadow (one-tool pilot, other result alongside) → switch (when conditions are met) and rollback. Bundles carry the target file, each tool's previous file, `manifest.json` and `SHA256SUMS`, and can be verified back in the app.
- Not found among the products surveyed (Nov 2026): working from files alone with no SECS/GEM, MES or server; and a tool × version board with staged pilot-to-fleet bundles and rollback bundles on one screen. Staged (canary) rollout itself is common in IT deployment tools.
- Measured: 810 / 810 correct pass/block judgments with the exact blocking reason on the synthetic set; 50 / 50 version identifications across five formats; rollback bundle restores 3 / 3 tools to their pre-change files (SHA-256).
- Live: https://mhbae-semi-lab.github.io/recipe-golden/
- Run locally: `python -m http.server 8734 --bind 127.0.0.1`; tests: `node --test`.
- Built by 배민혁 with an AI coding assistant (Claude Code). All sample data is synthetic. MIT License.
