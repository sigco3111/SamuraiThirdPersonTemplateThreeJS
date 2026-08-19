# 사무라이 3인칭 템플릿 (Three.js)

[![라이브 데모](https://img.shields.io/badge/🎮%20라이브%20데모-GitHub%20Pages-8fcfff?style=for-the-badge)](https://sigco3111.github.io/SamuraiThirdPersonTemplateThreeJS/)
[![원본 저장소](https://img.shields.io/badge/원본-achrefelouafi%2FSamuraiThirdPersonTemplateThreeJS-blue?style=for-the-badge&logo=github)](https://github.com/achrefelouafi/SamuraiThirdPersonTemplateThreeJS)
[![라이선스](https://img.shields.io/github/license/achrefelouafi/SamuraiThirdPersonTemplateThreeJS?style=for-the-badge)](LICENSE)
[![한글화](https://img.shields.io/badge/한글화-700%2B%20문자열-crimson?style=for-the-badge)](#한글화-세부-사항)

> **무장 사무라이가 등장하는 야간 무한 절차적 풍경의 3인칭 템플릿** —
> 모션 워프된 근접전, 소환, 비행, 래그돌 사망까지 모두 포함된,
> 학습과 확장에 열려 있는 Three.js 기반 캐릭터 무대입니다.
>
> 이 저장소는 원본 **[achrefelouafi/SamuraiThirdPersonTemplateThreeJS](https://github.com/achrefelouafi/SamuraiThirdPersonTemplateThreeJS)** 의 **UI/문서 한글화 포크**입니다.

---

## 🎮 바로 실행해보기

가장 빠르게 확인할 방법은 **GitHub Pages로 배포된 라이브 데모**를 여는 것입니다:

| 항목 | URL |
|------|-----|
| 🌐 **라이브 데모** | <https://sigco3111.github.io/SamuraiThirdPersonTemplateThreeJS/> |
| 📦 **원본 저장소** | <https://github.com/achrefelouafi/SamuraiThirdPersonTemplateThreeJS> |
| 🍴 **이 포크 저장소** | <https://github.com/sigco3111/SamuraiThirdPersonTemplateThreeJS> |

> 첫 로딩 시 캐릭터 FBX, HDR 환경맵, 글러브 텍스처 등을 한 번에 불러오므로
> 인터넷 환경에서 **약 5~10초** 정도 걸릴 수 있습니다 (진행 막대가 표시됩니다).

---

## 🎮 조작법

| 키 | 동작 |
|----|------|
| 마우스 드래그 | 카메라 궤도 회전 |
| 마우스 휠 | 줌 인/아웃 |
| `WASD` | 이동 |
| `Space` | 도약 (달리며 누르면 멀리뛰기) |
| `Tab` | 캐릭터 화면 (장비 스튜디오) |
| `G` | 스테이지 에디터 (GUI 패널) |
| `F` | 통계 표시 (FPS, 프레임, 드로우 콜 등) |
| `P` | 시간 일시정지 |
| `E` | 킥 (가까운 적에게 발차기) |
| `R` | 참격 (허리 높이 베기) |
| `T` | 슬라이드 베기 (달려가며 베기) |
| `V` | 그림자 분신 소환 (적 2명을 표시하면 분신이 추격) |
| `C` | 심판 (적 1명 위에 인을 그리고 주먹 소환) |
| `X` | 비행 (지면 이탈, 적을 클릭해 칼날 생성) |

---

## ✨ 무엇이 들어 있나

### 1) 캐릭터 & 리그

- **완전 본 애니메이션 사무라이** — 걸음, 달리기, 점프, 도약, 그리고 전투 모션까지
- **리지큘레이트 애니메이션** — 동작 중 다른 동작으로 부드럽게 전환 (`CharacterController`)
- **3인칭 카메라 리그** — 회전, 줌, 자동 회전, 시네마틱 흔들림까지 (`CameraRig`)

### 2) 모션 워프 근접전

- **공격의 모션 워프** — 출력이 의도된 궤적에 정확히 맞물리도록 애니메이션을 절차적으로 변형
- **타겟 표시 시스템** — 적의 머리 위에 마커가 떠다니며, 클릭 한 번으로 표시
- **타겟 링 & 워프** — 공격이 적에게 도달할 위치를 미리 보여주는 시각 피드백

### 3) 절차적 야간 풍경

- **무한히 펼쳐지는 야간 풍경** — 지형 그리드가 카메라를 따라가고 끝이 보이지 않음
- **달과 헤이즈** — 거리 헤이즈, 지상 안개, 달빛 산란, 달 본체의 시네마틱 라이팅
- **환경광 / IBL** — HDR 환경맵을 활용한 사실적인 반사

### 4) 풀 이펙트 스택

- **칼날 불꽃 (VolumetricFire)** — 절차적 볼류메트릭 화염 + 흑체 발광 + 안개 산란
- **먼지, 흙, 불씨** — 바닥 충격, 베기, 발자국에서 발생하는 마이크로 입자
- **소환 인, 주먹 낙하, 광배** — 각 술법마다 고유한 시네마틱 VFX
- **절단 및 출혈** — 두 동강 난 시체, 반쪽끼리 충돌, 출혈 파티클

### 5) 장비 스튜디오

- **캐릭터 화면** (`Tab`) — 무기 / 장식 두 카테고리, 부위 선택, 관절 부착, 오프셋/회전/크기/미러
- **프리셋 관리** — 현재 무대 설정을 이름 붙여 저장하고, JSON으로 내보내기/가져오기
- **즉시 적용** — 모든 컨트롤은 `settings.js` 한 객체의 필드를 읽고, 변경 즉시 반영 (재빌드 불필요)

### 6) 시네마틱 카메라 + 후처리

- **Bokeh DoF** — 초점 평면 시각화까지 포함된 시네마틱 심도
- **블룸, 필름 그레인, 비네트, 색수차, 대비, 채도** — 영화 룩의 모든 요소
- **레터박스** — 자막 영화 비율의 검은 띠 토글

### 7) 라이브 에디터 (스테이지 에디터)

- **G** 키로 여는 lil-gui 기반 패널 — 14개 카테고리, 600+ 슬라이더/컬러 토글
- 모든 컨트롤이 즉시 반영 (재빌드 없음)
- **프리셋** — 현재 설정을 JSON으로 저장하고 다른 세션에서 그대로 복원
- 폴더별 접기/펴기, 검색

---

## 📁 디렉터리 구조

```
SamuraiThirdPersonTemplateThreeJS/
├── index.html               # 진입점 (캐노니컬 title, hint, 로더 마크업)
├── package.json             # vite 8 + three 0.185 + lil-gui 0.21
├── vite.config.js           # base: './' (gh-pages 서브경로 호환)
├── wrangler.toml            # Cloudflare 배포용 설정 (선택)
├── public/                  # 빌드 시 그대로 복사되는 정적 자산
│   ├── animations/          # FBX 애니메이션 클립 (Idle, Walk, Run, Kick, Slash 등)
│   ├── hdri/                # HDR 환경맵
│   ├── models/              # GLB / FBX 메시 (캐릭터, 무기, 장식, 환경)
│   ├── textures/            # PBR 텍스처 (돌, 흙, 달, 낙엽, 지형)
│   └── _headers             # GitHub Pages 캐시 헤더
├── src/
│   ├── animation/           # 캐릭터 컨트롤러, 전투 모션, 비행, 점프
│   ├── combat/              # 적 AI, 래그돌, 타겟 표시
│   ├── config/              # abilities.js (액션 정의), settings.js (라이브 편집 대상)
│   ├── core/                # App, CameraRig, FrameUniforms, Input, Renderer, Time
│   ├── equipment/           # 장비 카탈로그와 매니저
│   ├── loaders/             # FBX/GLB 로더와 머티리얼 라이브러리
│   ├── postprocessing/      # Bokeh DoF, 블룸, 필름 그레인 등
│   ├── screens/             # 캐릭터 화면 / 스튜디오 카메라 컨트롤러
│   ├── shaders/             # GLSL 라이브러리 (노이즈, 흑체, 지형)
│   ├── ui/                  # ActionHUD, CharacterScreenUI, Editor, LoadingScreen, Stats, Toast, TargetHotkeys
│   ├── utils/               # 색공간, 수학, 셰이더 패치 유틸
│   ├── vfx/                 # BladeHeat, BladeStorm, BloodBurst, SummonSeal, ShadowCharacter 등
│   └── world/               # Sky, Moon, Terrain, Leaves, GroundFog, Atmosphere, StudioStage
├── docs/
│   └── media/               # 스크린샷, 동영상 썸네일
└── dist/                    # vite build 산출물 (gh-pages 브랜치로 배포)
```

---

## 🛠️ 로컬에서 빌드 / 실행

```bash
# 1) 의존성 설치
npm install

# 2) 개발 서버 (HMR, 기본 포트 5173)
npm run dev

# 3) 프로덕션 빌드 (dist/ 폴더로 출력)
npm run build

# 4) 빌드 결과 미리보기
npm run preview
```

> Vite 설정에 `base: './'`가 박혀 있어 빌드 결과는 **`dist/` 폴더를
> 어떤 서브경로에 배포해도 그대로 동작**합니다 (로컬, gh-pages, S3, 정적 호스팅 어디든).

---

## 🌍 한글화 세부 사항

### 변경한 것

- **UI 라벨 700+개** — lil-gui 폴더명, 슬라이더 라벨, 버튼 캡션, 카테고리 탭, 토스트 메시지
- **`abilities.js`** — 액션 카테고리(예: `Movement` → `이동`, `Techniques` → `기술`, `Abilities` → `술법`)와 액션 라벨·툴팁
- **`EquipmentCatalog.js`** — 장비 카테고리(`Weapons` → `무기`, `Attachments` → `장식`)와 아이템 이름·설명
- **`CharacterScreenUI.js`** — 캐릭터 화면의 그룹 라벨, 슬라이더 캡션, 상태 칩(`equipped` → `장착됨`, `locked` → `잠김` 등)
- **`Stats.js`** — 통계 패널 단위(`프레임`, `최대`, `드로우`, `삼각형`)
- **`index.html`** — 페이지 타이틀, 로더 텍스트, 키 힌트
- **스테이지 에디터의 461개 R(...) 슬라이더 라벨** — `roughness`, `ambient`, `key intensity`, `moon glare` 등

### 변경하지 않은 것

- **JS 식별자** (`Movement`가 CATEGORIES의 key이므로, `movement: { id: 'movement', label: '이동' }` 처럼 `id`/`code`/`key`/`bone` 등은 그대로 두고 `label`만 한글화)
- **CSS 클래스명** (`stats__row`, `cs__card`, `hud__key` 등) — 다국어 호환 유지
- **3D 모델/FBX/HDR 자산**
- **시각적 디자인 (색상, 폰트, 레이아웃)** — UI 구조는 동일, 텍스트만 교체
- **데이터 파일 (`settings.js`의 슬라이더 키)** — `keyIntensity`, `sunAzimuth` 등 식별자는 보존

> 일관성 정책: **모든 UI 섹션/폴더/버튼은 한글로 통일**했습니다.
> 한/영 혼합은 발견 즉시 수정했습니다.

---

## 📋 라이선스 & 크레딧

- **원작**: [achrefelouafi/SamuraiThirdPersonTemplateThreeJS](https://github.com/achrefelouafi/SamuraiThirdPersonTemplateThreeJS) — 라이선스는 원본 저장소의 [LICENSE](LICENSE) 참조
- **포크/한글화**: [sigco3111/SamuraiThirdPersonTemplateThreeJS](https://github.com/sigco3111/SamuraiThirdPersonTemplateThreeJS)
- **기술 스택**: Three.js, lil-gui, Vite, WebGL, GLSL
- **아이콘**: SVG 인라인 (외부 의존성 없음)
- **모델/애니메이션**: Mixamo 자산 (원본 저장소 라이선스 준수)

---

## 🐞 알려진 한계 / 팁

- **첫 로딩이 느린 이유** — 캐릭터 FBX 1.4MB + HDR 환경맵 6MB + PBR 텍스처들을 한 번에 가져옵니다. 진행 막대가 채워질 때까지 잠시 기다려 주세요.
- **GitHub Pages 캐시** — 일부 브라우저는 옛 빌드를 잡고 있을 수 있습니다. 강제 새로고침(`Cmd+Shift+R` 또는 `Ctrl+Shift+R`)을 권장합니다.
- **FBX 글리치** — 드물게 첫 액션 호출에서 한 프레임 동결이 발생할 수 있습니다. 이후로 안정적입니다.
- **빌드 사이즈** — `dist/assets/index-*.js`가 약 1.4MB(gzip 440KB)로 큽니다. 이는 Three.js + 모든 셰이더/VFX/월드 모듈이 한 번에 들어 있기 때문이며, 의도된 단일-번들 구조입니다.