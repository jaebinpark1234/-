# World 1-1 (Claude Code 60초 픽셀 게임 패러디, 영어권용)

8비트 플랫포머처럼 만든 60초 이야기다. 손그림 버전(`../claude-code-60s-en`)과 그림체, 배경, 음악, 구성을 모두 다르게 했다.

| 구간 | 장면 |
|---|---|
| 0–6초 | 터미널에 `> claude`, 로고, `> fix the login bug`, `WORLD 1-1 / auth.ts` 카드 |
| 6–18초 | 터미널 모양 파이프에서 나와 달린다. 파일 블록 6개를 머리로 쳐서 42개 파일을 모으고, 벌레 둘을 밟는다 |
| 18–27초 | 보스전. 간판 `token = null`. `=` 블록을 두 번 쳐서 `===`로 만들면 보스가 터지고, 작은 벌레 하나가 도망간다 |
| 28–37초 | 빨간 테스트 다리. 밟으면 초록. 9번째 타일만 다시 빨개져서 엉덩이 찍기로 고친다. 불꽃놀이 |
| 41–49초 | MERGE 깃발을 타고 내려와 `main` 성으로 들어가서 잔다 |
| 50–55초 | 도망친 벌레가 와서 "THANK YOU CLAUDE! BUT THE BUG IS IN ANOTHER FILE." 성에 불이 켜지고 다시 출동 |
| 55–60초 | 엔딩 로고와 `> claude` |

화면 글씨는 게임 UI(파일 카운터, 작업 칸 5개, 보스 간판, 마지막 대사)뿐이고 자막은 없다.

## 다시 렌더하기

원본 해상도(가로 240×135, 세로 180×320)로 찍고 ffmpeg가 nearest-neighbor로 8배·6배 키운다. 그래서 1080p 렌더보다 훨씬 빠르다.

```bash
export NODE_PATH=$(npm root -g)
node render.js video L 60 silent_16x9.mp4 4
node render.js video V 60 silent_shorts.mp4 4
node render.js cues cues.json
python3 audio.py cues.json audio.wav
ffmpeg -i silent_16x9.mp4 -i audio.wav -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 256k -movflags +faststart out.mp4
node render.js thumb thumbnail.png
```

## 구조

- `scene.js`: 모든 장면. 타이밍은 `T`, 캐릭터 이동은 `CX`(x 키프레임)와 `JUMPS`(점프 궤적)에 있다. 스프라이트는 이미지 파일 없이 코드로 픽셀을 찍는다.
- `audio.py`: 사각파·삼각파·노이즈 채널로 만든 칩튠과 효과음. 150 BPM.
- `fonts/`: Press Start 2P (SIL OFL)
