# 업로드 메모 (영어권 타깃)

## 파일

| 파일 | 용도 |
|---|---|
| `out/bug-hunt_16x9.mp4` | 일반 영상 (1920×1080, 30fps, 60초) |
| `out/bug-hunt_shorts.mp4` | 쇼츠 (1080×1920, 30fps, 60초) |
| `out/thumbnail.png` | 썸네일 (1280×720) |

화면 속 글씨는 체크리스트, 왼쪽 아래 도구 라벨, 마지막 타이틀뿐이다. 영어 자막을 따로 넣지 않아도 이야기가 이어진다.

## 제목 후보 (영어)

1. Claude Code goes bug hunting
2. I asked Claude Code to fix one bug
3. Bug Hunt — a tiny Claude Code animation

쇼츠: `Claude Code vs. one bug 🐛`

## 설명란

```
"login is broken. fix it."

Claude Code reads the codebase, finds the bug, fixes it, runs the tests and ships a PR.
The bug did not take it well.

Fan-made animation. Not affiliated with Anthropic.

#ClaudeCode #Claude #AI #coding #programming #devlife #animation
```

## 태그

claude code, claude, anthropic, ai coding, ai agent, coding animation, programmer humor, developer, debugging, bug fix, terminal, cli, motion graphics, hand drawn animation

## 올릴 때 챙길 것

- 고정 댓글 예시: `What's the dumbest bug you've ever shipped? Mine was a single "="`
- 쇼츠는 마지막에 종이 배경으로 페이드아웃되고 첫 장면도 빈 종이에서 시작해서, 반복 재생돼도 끊김이 없다.
- 캐릭터는 Claude Code 마스코트를 손그림 스타일로 다시 그린 팬아트다. 공식 영상처럼 보이는 표현은 쓰지 않는다.
- 음악과 효과음은 `audio.py`로 직접 합성했다. 폰트는 IBM Plex Mono(OFL), 손그림 렌더링은 rough.js(MIT)다.
