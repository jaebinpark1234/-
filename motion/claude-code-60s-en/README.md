# Bug Hunt (Claude Code 60초 손그림 애니메이션, 영어권용)

종이 질감 위에 손그림 선으로 그린 60초짜리 이야기다. 주인공은 주황색 블록 캐릭터이고, 화면 글씨는 왼쪽 위 체크리스트와 왼쪽 아래 도구 라벨, 마지막 타이틀만 둔다.

| 구간 | 체크리스트 | 라벨 | 장면 |
|---|---|---|---|
| 0–5초 | | `> login is broken. fix it.` | 벌레가 잠깐 지나가고, 블록이 걸어 들어온다 |
| 5–15초 | read the codebase | `✦ Read 42 files` | 종이 파일이 날아와 쌓이고, 머릿속 지도에서 빨간 노드를 찾는다 |
| 15–27초 | find the bug | `✦ Grep "token"` | 돋보기로 발자국을 따라가는데 벌레는 뒤에 있다. 추격 끝에 병에 가둔다 |
| 27.5–37초 | fix it | `✦ Edit auth.ts` | 망치로 `(token = null)`의 `=`를 두 번 때려 `===`로 만든다 |
| 37.5–47초 | run the tests | `✦ Bash npm test` | 전구 12개가 차례로 초록불, 하나가 빨간불이었다가 째려보니 초록 |
| 47.5–55초 | ship it | `✦ gh pr create` | 종이를 접어 비행기로 날린다 |
| 55–60초 | | | 블록과 벌레가 같이 잠들고 타이틀 `Claude Code` |

음악은 96 BPM이고 한 마디가 2.5초다. 장면 전환이 마디에 맞춰져 있다.

## 다시 렌더하기

```bash
export NODE_PATH=$(npm root -g)
node render.js video 1920 1080 30 silent_16x9.mp4 4
node render.js video 1080 1920 30 silent_shorts.mp4 4
node render.js cues cues.json
python3 audio.py cues.json audio.wav
ffmpeg -i silent_16x9.mp4 -i audio.wav -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 256k -movflags +faststart out.mp4
node render.js thumb 1280 720 thumbnail.png
```

특정 프레임만 보려면 `node render.js frames 1920 1080 frames/ 22.2,31.3`을 쓴다.

## 구조

- `scene.js`: 모든 장면. 타이밍은 위쪽 `T`, `TASKS`, 아래쪽 `LABELS`에 있다. 선은 rough.js로 그리고 초당 8번 다시 흔들어 손그림처럼 보이게 한다.
- `audio.py`: 음악과 효과음 합성. 효과음 타이밍은 `scene.js`의 `cues()`가 만든다.
- `vendor/rough.js`: rough.js 4.6.6 (MIT)
- `fonts/`: IBM Plex Mono (SIL OFL)
