# 이 게임 코드에서 일하는 AI를 위한 안내

이 문서는 Claude, Codex, Cursor, Gemini 등 이 폴더에서 작업하는 모든 에이전트가 먼저 읽는다.
기획은 `docs/GDD.md`, 할 일 목록은 `docs/TASKS.md`, 출시 절차는 `docs/LAUNCH.md`에 있다.

## 스택

- Phaser 4 + TypeScript + Vite. 세로 720x1280 기준 해상도에 `Scale.FIT`.
- 테스트는 Vitest(`tests/`), 브라우저 확인은 `scripts/smoke.mjs`(playwright-core).
- 모바일 앱은 나중에 Capacitor로 감싼다. 웹 코드가 그대로 앱이 된다.
- Phaser 4 API가 헷갈리면 `node_modules/phaser/skills/`의 공식 가이드를 먼저 본다. v3 예제를 그대로 베끼면 안 되는 부분은 `v3-to-v4-migration/SKILL.md`에 정리돼 있다.

## 이 게임

드론 팩을 쇼 순서대로 하늘에 띄워 숨은 그림을 완성하는 정렬 퍼즐이다. 규칙과 설계 이유는 `docs/GDD.md`.

| 파일 | 하는 일 |
|---|---|
| `src/core/rules.ts` | 게임 규칙의 기준. 탭 한 번 → 상태 변경 + 연출용 이벤트 목록 |
| `src/core/levelgen.ts` | 그림 → 쇼 순서 → 상자 배치 → 난이도 맞추기 |
| `src/core/solver.ts` | 모든 팩을 아는 상태의 정확한 해법 탐색. 레벨이 풀리는지 보장 |
| `src/core/bot.ts` | '?'를 모르는 봇. 난이도 측정, 스모크 테스트, 자동 플레이 |
| `src/core/difficulty.ts` | 레벨 번호 → 생성 파라미터와 목표치 |
| `src/core/pictures.ts` | 그림 데이터(ASCII) |
| `src/config/balance.ts` | 코인, 부스터 가격, 보너스 |
| `src/scenes/GameScene.ts` | 판 그리기, 드론 연출, 입력, 그림 맞히기, 결과 연결 |

규칙을 바꾸면 `rules.ts`, `solver.ts`, `bot.ts`를 같이 봐야 한다. 해법 탐색기는 "상자별 남은 높이가 같으면 나머지 상태도 같다"는 전제로 기억을 줄인다. 이 전제를 깨는 규칙(예: 블로커)을 넣으면 기억 키도 바꾼다.

## 명령어

```bash
npm install
npm run dev        # 개발 서버
npm test           # 단위 테스트
npm run typecheck  # 타입 검사
npm run build      # 타입 검사 + 배포 빌드(dist/)
npm run smoke      # build 후 실행. 실제 브라우저로 메뉴→게임(봇 자동 플레이)→결과 확인, artifacts/에 스크린샷
npm run report -- 1 100   # 레벨별 난이도 수치(필요 거치대 칸, 봇 승률, 생성 시간)
npm run format     # prettier
```

작업을 끝냈다고 말하기 전에 `npm test && npm run build && npm run smoke`가 모두 통과해야 한다.

## 폴더 구조

```
src/
  main.ts            Phaser 설정, 서비스 초기화
  config/            해상도, 색, 에셋 목록, 밸런스 수치
  core/              게임 규칙. Phaser를 import하지 않는 순수 TS. 전부 단위 테스트 대상
  services/          저장, 광고, 분석, 다국어, 플랫폼 감지, 소리
  scenes/            Boot → Preload → Menu → Game → Result
  ui/                버튼 같은 공용 UI
public/assets/       이미지, 소리 파일
tests/               Vitest
docs/                기획서, 할 일, 출시 체크리스트
```

## 지켜야 할 규칙

1. **규칙은 `core/`, 그리기는 `scenes/`.** 판정, 점수, 레벨 생성은 `core/`에 순수 함수로 쓰고 테스트를 붙인다. 씬은 core를 호출해서 결과를 그리기만 한다.
2. **난수는 `core/rng.ts`의 `Rng`만 쓴다.** 레벨과 데일리 챌린지는 시드로 재현돼야 한다. `Math.random()`은 연출(파티클 흔들림 등)에만 허용한다.
3. **광고는 `getServices().ads`로만 부른다.** 빈도 규칙(`AdPolicy`)은 `services/ads.ts` 한 곳에서 정한다. 씬에서 광고 SDK를 직접 부르지 않는다.
4. **화면 글자는 `services/i18n.ts`에 키로 추가한다.** ko와 en 둘 다 채워야 타입 검사를 통과한다.
5. **저장 형식을 바꾸면 `services/save.ts`의 `migrate()`를 같이 고친다.** 기존 유저 진행이 날아가면 안 된다.
6. **에셋은 `src/config/assets.ts`에 등록한다.** 파일이 없어도 게임이 돌아가게 돼 있으니 코드가 에셋보다 먼저 들어가도 된다.
7. **색과 글꼴은 `config/game.ts`의 `THEME`에서만 바꾼다.**
8. 새 의존성은 꼭 필요할 때만 추가한다. 번들 크기가 포털 심사 항목이다.

## 에셋 규격(아트/사운드 담당)

- 이미지: PNG, 투명 배경, 2배 해상도로 제작(예: 화면에 96px로 보이면 192px). 파일명은 `kebab-case`.
- 소리: `.ogg`와 `.mp3` 두 벌. 효과음은 1초 이내, 음악은 루프 가능하게.
- 저작권이 불분명한 이미지나 소리, 실존 브랜드와 캐릭터는 쓰지 않는다.

## 커밋

- 한 작업 = 한 커밋. 메시지는 한국어로, 무엇을 왜 바꿨는지 쓴다.
- 문서와 커밋 메시지는 저장소 루트 `CLAUDE.md`의 글쓰기 규칙을 따른다.
