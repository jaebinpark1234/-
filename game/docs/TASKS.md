# 할 일 목록

다른 AI(또는 사람)에게 하나씩 맡기는 단위다. 맡길 때는 이 파일의 항목 하나와 `AGENTS.md`, `docs/GDD.md`를 같이 준다.
끝나면 항목 앞의 `[ ]`를 `[x]`로 바꾸고 커밋 메시지에 ID를 적는다.

담당 표시: 🧑 주인이 직접 / 💻 코딩 AI / 🎨 이미지 AI / 🔊 사운드 AI

우선순위: **P0** 웹 출시 전에 꼭 / **P1** 웹 출시 직후 / **P2** 안드로이드 단계

---

## 이름과 출시 준비

- [ ] **NAME-1 🧑 P0 최종 이름 정하기**
  후보를 3~5개 정해서 KIPRIS(kipris.or.kr), USPTO, Google Play·App Store·Poki·CrazyGames 검색으로 겹치는 이름이 없는지 본다. 정한 뒤 `src/scenes/MenuScene.ts`의 `GAME_TITLE`과 `index.html`의 `<title>`을 바꾼다. "Swarm", 군사 느낌 단어, "SkyShow"(SkyShowtime과 겹침)는 피한다.

- [ ] **QA-1 💻 P0 GitHub Actions로 자동 검사**
  `game/`에서 `npm ci && npm test && npm run build && npm run smoke`를 PR마다 돌린다. 크로미움은 `npx playwright-core install --with-deps chromium`로 설치한다. `CHROMIUM_PATH`를 주지 않으면 smoke 스크립트가 Playwright 기본 경로의 브라우저를 쓴다.
  완료 기준: PR에 초록 체크가 뜬다.

## 콘텐츠(그림)

- [ ] **CONTENT-1 💻 P0 이미지 → 그림 데이터 변환 도구 `tools/img2level.ts`**
  AI가 만든 PNG(단색 배경, 가운데 대상 하나)를 받아 `PictureDef` 형식으로 바꾼다.
  - 배경 제거 → 격자(12×12부터 최대 24×30)로 축소 → 8색 팔레트(`core/palette.ts`)에 OKLab 거리로 맞춤 → 외톨이 칸 제거
  - 채움 비율이 35~75% 밖이거나 조각이 너무 잘면 거절
  - 결과를 한 장에 모은 미리보기 PNG(contact sheet)를 만들어 주인이 승인할 수 있게 한다
  - 승인된 것만 `src/core/pictures.ts`(또는 `src/content/pictures/*.json`로 옮겨서)에 추가
  완료 기준: 샘플 PNG 5장 변환, 테스트 통과, 미리보기 PNG 생성.

- [ ] **CONTENT-2 🎨🧑 P0 그림 40개(앨범 2개)**
  CONTENT-1 도구용 원본 이미지를 만든다. 프롬프트 방향: "flat icon, single centered subject, plain background, bold silhouette, 3-5 colors, no text, no brand, no character".
  초반용은 윤곽만 봐도 아는 것(하트, 달, 물고기, 나무, 로켓, 우산, 사과...). 3색 이상인 그림이 절반 이상이어야 후반 레벨이 반복되지 않는다(`effectiveColors` 참고).
  읽기 검사: 변환된 격자를 60%만 칠한 상태로 다른 사람(또는 비전 모델)에게 보여 주고 이름을 맞히면 통과.

- [ ] **CONTENT-3 💻 P1 그림 맞히기 오답 보기 개선**
  지금은 아무 그림에서나 2개를 고른다(`GameScene.maybeShowGuess`). 같은 앨범, 비슷한 색 구성에서 고르게 바꾼다. `PictureDef`에 `decoys?: string[]`를 두고 없으면 자동 선택.

## 아트

- [ ] **ART-1 🎨 P0 게임 스프라이트**
  규격은 `AGENTS.md`의 에셋 규격(PNG, 투명, 2배 해상도). 키는 `src/ui/textures.ts`의 `TextureKeys`와 같게 하고 `src/config/assets.ts`에 등록한다.
  - 드론 팩 8색(기호 포함) 192×112, `?` 팩, 상자 바탕, 거치대 칸(보통/경고), 쇼 프로그램 칸
  - 드론 빛 1장(흰색, 코드에서 색을 입힘) 128×128
  - 부스터 아이콘 2개, 코인 아이콘, 버튼 바탕
  완료 기준: `npm run smoke` 스크린샷에서 코드로 그린 임시 도형이 모두 바뀌어 있다.

- [ ] **ART-2 🎨 P1 도시 실루엣 배경**
  도시 2곳 × 시차 레이어 3장. 가로로 이어 붙일 수 있게. 실존 랜드마크와 간판 글자 금지. 지금은 `GameScene.drawSky()`가 사각형으로 그린다.

- [ ] **ART-3 🎨🧑 P0 대표 이미지와 스토어 그림**
  앱 아이콘 512×512, Poki/CrazyGames 표지(가로 16:9, 세로 800×1200), Google Play 그래픽 이미지 1024×500, 스크린샷 8장.

## 사운드

- [ ] **AUDIO-1 🔊 P0 효과음**
  `src/config/assets.ts`의 `SFX` 키 + 아래 목록. `.ogg`와 `.mp3` 두 벌, 1초 이내.
  탭, 팩 거치, 드론 도착(작은 틱), 순서 완료, 연쇄, 거치대 경고, 막힘, 승리 팡파르, 코인, 버튼, 정답, 오답.

- [ ] **AUDIO-2 🔊 P1 배경음 2곡**
  홈 1곡, 플레이 1곡. 60~120초 루프, 차분하고 축제 느낌. 음악 설정 토글(UX-3)과 같이 붙인다.

- [ ] **AUDIO-3 💻 P1 팩마다 멜로디 한 음**
  팩이 도착할 때 저작권이 끝난 곡의 다음 음을 재생한다(WebAudio로 합성하면 파일이 필요 없다). 그림이 완성되면 소절이 끝나도록 레벨의 전체 팩 수에 맞춰 곡 길이를 자른다. 곡 후보: 아리랑, 환희의 송가, 캐논.

## 광고와 플랫폼

- [ ] **ADS-1 💻 P0 Poki SDK 어댑터**
  `AdProvider`를 구현한다(`src/services/ads.ts`). `gameplayStart/Stop`, `commercialBreak`(전면), `rewardedBreak`(보상형). 첫 입력 때 `gameplayStart`와 오디오 잠금 해제를 같이 한다. `src/services/index.ts`의 `createAdProvider`에서 `platform === 'poki'`일 때 쓴다.
  구현 전에 Poki SDK 문서(sdk.poki.com)의 현재 요구 사항을 확인한다.

- [ ] **ADS-2 💻 P0 CrazyGames SDK 어댑터**
  ADS-1과 같은 방식. midgame(전면), rewarded. CrazyGames 광고 요구 사항 문서(docs.crazygames.com/requirements/ads)를 먼저 읽는다.

- [ ] **ADS-3 💻 P0 플랫폼별 광고 정책**
  `AdPolicy`를 플랫폼마다 따로 둔다(`src/config/ads.ts` 신설). Poki는 빈도를 Poki가 정하므로 자연스러운 쉬는 지점마다 부르기만 하면 되는지 문서로 확인하고 값을 정한다.

- [ ] **ADS-4 💻 P1 광고가 준비 안 됐으면 보상형 버튼 숨기기**
  `AdProvider`에 `isRewardedReady()`를 추가하고, 결과 화면과 부스터 버튼에서 준비 안 됐으면 버튼을 숨기거나 코인 가격만 보여 준다.

- [ ] **PLAT-1 💻 P2 안드로이드(Capacitor)**
  `npx cap add android`, AdMob(또는 AppLovin MAX) 어댑터, Google Play 결제(광고 제거, 코인 묶음), Haptics 플러그인. 저장은 지금 localStorage 그대로 써도 되지만 앱 삭제 시 사라진다는 점을 확인한다. 등록 절차는 `LAUNCH.md`.

## 화면과 사용성

- [ ] **UX-1 💻 P0 튜토리얼 손가락**
  1~3레벨에서 지금 눌러야 할 상자를 손가락 그림으로 가리킨다. 지금은 흰 테두리만 깜빡인다(`renderBoard`의 tutorial 분기). 4레벨에서 처음 거치대를 쓸 때 짧은 안내 한 줄.

- [ ] **UX-2 💻 P1 앨범 화면**
  완성한 그림 모음. 안 깬 그림은 `???` 실루엣. 그림을 누르면 드론쇼를 다시 재생. 저장 데이터에 완성 목록 추가(`save.ts`의 `migrate` 같이 수정).

- [ ] **UX-3 💻 P0 설정 화면**
  효과음, 음악, 진동, 언어(ko/en). 지금 메뉴에는 효과음 토글만 있다.

- [ ] **UX-4 💻 P1 상점**
  코인 구매(안드로이드), 광고 제거, 하루 3번까지 광고 보고 코인 받기.

- [ ] **UX-5 💻 P0 데스크톱 화면 맞추기**
  Poki는 16:9 틀 안에서 돌린다. 지금은 세로 화면 양옆이 빈 색이다. `Scale.EXPAND`로 바꾸고 하늘과 도시 배경이 옆으로 넓어지게 한다. 버튼과 판은 가운데 세로 영역에 둔다.

- [ ] **UX-6 💻 P1 데일리 공유**
  결과 화면에 "공유" 버튼. 한 줄 문구 + `?daily=YYYY-MM-DD` 링크를 클립보드에 복사. 링크로 들어오면 그 날짜 데일리를 바로 연다.

- [ ] **UX-7 💻 P1 거치대 4/5 경고 연출**
  테두리가 빨갛게 바뀌는 것 외에 짧은 경고음과 약한 진동.

## 게임 규칙 확장

- [ ] **GAME-1 💻 P1 블로커 2종**
  잠긴 상자 + 열쇠 팩(25레벨 도입), 묶인 두 팩(45레벨 도입). `core/rules.ts`, `core/solver.ts`, `core/bot.ts`를 같이 고치고 테스트를 추가한다. 해법 탐색기의 "높이만으로 상태를 기억한다"는 전제가 깨지면 기억 키를 바꿔야 한다.

- [ ] **GAME-2 💻 P1 '?' 공정성 검사**
  지금 색을 가진 팩이 '?' 뒤에만 있고 거치대가 4/5 이상인 상황이 생기면 운에 맡기는 판이 된다. 레벨 생성 단계에서 이런 상황이 해법 경로에 생기면 다시 만든다.

- [ ] **GAME-3 💻 P2 두 번째 이어하기를 코인으로**
  실패 화면에서 첫 번째는 광고, 두 번째는 코인(가격은 `balance.ts`).

- [ ] **GAME-4 💻 P1 데일리 연속 기록 보호권**
  광고를 보거나 플레이로 얻고 최대 1개 보관. 하루 빠져도 기록이 유지된다.

## 성능

- [ ] **PERF-1 💻 P1 레벨 미리 굽기**
  `scripts/bake-levels.ts`로 레벨 1~500과 1년치 데일리를 JSON으로 만들고 게임은 그걸 읽는다. 없으면 지금처럼 기기에서 만든다. 저가 폰에서 레벨 시작이 0.3초 넘게 걸리면 우선순위를 올린다.

- [ ] **PERF-2 💻 P0 저가 안드로이드 성능 확인**
  드론 400개 이상 그림으로 크롬에서 30fps 이상인지. 부족하면 자리 잡은 드론을 RenderTexture 한 장에 구워 넣고 날아가는 드론만 스프라이트로 둔다. 품질 토글(빛 효과 끄기).

## 홍보 도구

- [ ] **GROWTH-1 💻 P0 크리에이터 모드 `?creator=1`**
  HUD와 부스터를 숨기고 1080×1920 기준으로 그린다. 봇이 사람 속도(0.4~0.7초 간격, 약간의 흔들림)로 둔다. `?seed=`로 레벨 지정, 여러 레벨을 연달아. 피날레 직전에 잠깐 멈춰서 "무슨 그림일까?" 자막 넣을 시간을 준다.
  자동 플레이는 이미 있다: `GameScene.exposeSmokeHooks()`.

- [ ] **GROWTH-2 💻 P1 레벨 미리보기 페이지**
  시드를 넣으면 그 레벨 판을 그리고 PNG로 저장. "상자 하나만 안전하다, 어느 것?" 같은 정지 화면 퀴즈 게시물용.

## 데이터

- [ ] **DATA-1 💻 P1 분석 도구 연결**
  `AnalyticsSink`를 하나 구현한다(GameAnalytics 무료 플랜 등). 이벤트는 GDD 11장 표. 개인 정보는 보내지 않는다.

- [ ] **DATA-2 💻 P1 난이도 재조정**
  레벨별 실패율이 쌓이면 `difficulty.ts` 표를 다시 맞춘다. `npm run report`로 바꾼 결과를 확인하고, 이미 깬 레벨이 바뀌지 않도록 레벨 시드는 그대로 둔다.
