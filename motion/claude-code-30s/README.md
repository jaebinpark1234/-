# 새벽 2시의 동료 (Claude Code 30초 모션그래픽)

새벽 2시에 테스트 47개가 깨진 개발자가 터미널에 `claude`를 치고 잠든다. Claude는 코드 속으로 들어가 `if (token = null)`의 `=` 하나를 찾아 고치고, 7분 뒤 50개 테스트가 모두 통과한다. 개발자는 하이파이브를 하고 진짜 자러 간다.

| 구간 | 내용 |
|---|---|
| 0–4.5초 | 시계가 01:59에서 02:00으로 넘어간다. 빨간 터미널, 지친 개발자 |
| 4.5–8.8초 | 모니터 클로즈업. `claude` 입력, 부탁하는 메시지 |
| 8.8–12초 | 스파크 캐릭터 등장. "맡겨!" / "부탁해…" 후 개발자는 졸고 스파크는 화면 속으로 |
| 12–20.8초 | 코드 세계. 파일을 훑고, 버그를 찾고, `=`를 `===`로 고치고, 테스트 카운터가 47에서 0으로 |
| 20.8–26초 | 02:07. 개발자가 깨어나 환호, 하이파이브, 모니터 끄기, "잘 자!" |
| 26–30초 | 엔딩 카드: Claude Code / 버그는 맡기고, 잠은 자자. / `$ claude` / 구독 |

## 다시 렌더하기

Node 22, Playwright(Chromium), ffmpeg, Python 3(numpy, scipy)가 필요하다.

```bash
export NODE_PATH=$(npm root -g)
node render.js video 1920 1080 60 silent_16x9.mp4 4      # 가로
node render.js video 1080 1920 60 silent_shorts.mp4 8    # 세로(쇼츠)
node render.js cues cues.json                            # 효과음 타이밍
python3 audio.py cues.json audio.wav                     # 음악 + 효과음 합성
ffmpeg -i silent_16x9.mp4 -i audio.wav -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 256k -movflags +faststart out.mp4
node render.js thumb 1280 720 thumbnail.png
```

특정 시각의 프레임만 확인하려면 `node render.js frames 1920 1080 frames/ 3.0,15.5,22.3`을 쓴다. 브라우저에서 `scene.html`을 로컬 서버로 열면 실시간 미리보기가 돈다(클릭하면 일시정지, `?t=15.5`로 특정 시각 고정).

## 구조

- `scene.js`: 모든 장면. `renderAt(t)`는 같은 `t`에 항상 같은 그림을 그린다. 타이밍은 파일 위쪽 `T`, `CAPS`(자막), `BUBBLES`(말풍선), `TODOS`에 모여 있다.
- `render.js`: 로컬 서버를 띄워 Chromium으로 프레임을 찍고 ffmpeg로 묶는다.
- `audio.py`: `cues.json`의 효과음 타이밍과 같은 박자(120 BPM)로 음악을 합성한다. 외부 음원을 쓰지 않는다.
- `fonts/`: Pretendard, JetBrains Mono (둘 다 SIL Open Font License).

자막을 고치려면 `CAPS`, 엔딩 문구는 `drawEnd()`의 태그라인을 바꾸면 된다.
