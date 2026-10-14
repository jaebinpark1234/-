# 진행 상황

## 테스트 배포

- 공개 주소: https://night-drone-show.pages.dev (Cloudflare Pages 프로젝트 `night-drone-show`, 교시온과 같은 계정)
- 다시 올리기: `cd game && npm run build && npx wrangler pages deploy dist --project-name night-drone-show --branch main --commit-dirty=true`
- 프로젝트는 Cloudflare API로 만들었다. wrangler 4의 `pages project create`는 Workers로 넘기면서 패키지 설치와 설정 파일 생성을 요구한다. 업로드(`pages deploy`)는 그대로 된다.
- 처음 잠깐 올렸던 `night-drone-show.*.workers.dev`는 계정 이름이 주소에 드러나서 지웠다.
- claude.ai 아티팩트(주인 전용): https://claude.ai/artifact/8Wwy5Gc6eYS9hpxHqECfgm

## 검색과 광고 (2026-10-14)

- 교시온과 같은 구글 계정 값을 쓴다: `google-site-verification` 메타(F4jQ90…), 애드센스 `ca-pub-2284248733205499`
- 메인 `index.html`: 설명, canonical, OG/트위터 카드(`og-image.png`), VideoGame 구조화 데이터, noscript 소개, 애드센스 계정 메타. 애드센스 스크립트는 게임 화면을 가리지 않게 메인에는 넣지 않았다.
- `/about`(게임 소개와 방법), `/privacy`(개인정보처리방침)에 애드센스 스크립트. 애드센스 심사에 글 있는 페이지와 개인정보처리방침이 필요해서 만들었다.
- `robots.txt`, `sitemap.xml`(/, /about, /privacy), `ads.txt`
- IndexNow로 Bing·네이버에 3개 주소 제출(202). 키 파일은 `public/d056ffb3….txt`
- 10-14 16:40 Search Console(doglike0428 계정): 속성 `https://night-drone-show.pages.dev/` HTML 태그로 자동 확인, `sitemap.xml` 제출(처음 상태 '가져올 수 없음'은 처리 대기). 홈 실시간 테스트 '등록할 수 있음'. 색인 생성 요청은 두 번째 시도에서 '일일 할당량 초과'가 떠서 첫 요청이 들어갔는지 불확실 → 내일 다시 요청, `/about`도 요청
- 10-14 16:45 애드센스(jaebinphs2009 계정, pub-2284248733205499): 사이트 추가, 메타 태그로 소유권 확인, 검토 요청 완료(상태 '준비 중'). Ads.txt '찾을 수 없음'은 크롤 대기(라이브는 200)
- 게임 안 광고(전면, 보상형)는 애드센스 일반 광고가 아니라 H5 Games Ads(adBreak) 승인이 따로 필요하다. 아직 가짜 광고로 돌아간다.

## beta 1 (2026-10-14)

- 테스트 링크: https://claude.ai/artifact/8Wwy5Gc6eYS9hpxHqECfgm (같은 링크에 다시 올리면 새 버전이 된다)
- 끝낸 일: QA-1(GitHub Actions 검사), UX-3(설정 창), 메뉴에 `beta 1` 표시

## beta 2 (2026-10-14)

예약 실행은 권한 거부로 실패해서 직접 진행했다. 한 일:

- 1레벨 첫 판에 규칙 안내 4장(메뉴의 '게임 방법'으로 다시 볼 수 있음), 1~3레벨 손가락, 4레벨 거치대 힌트
- 코드로 그린 입체 텍스처: 두께와 광택이 있는 팩, 발사대 모양 상자, 파인 거치대 홈, 입체 버튼
- 밤하늘(달, 은하수 빛, 별) + 도시 3겹 + 원근 격자 바닥. 메뉴에는 드론이 하트·별·원을 만드는 쇼
- 효과음 파일이 없을 때 WebAudio 합성음(탭, 거치, 발사, 연쇄, 막힘, 코인, 오답, 승리, 패배)

남은 것: 실제 이미지 에셋(ART-1/2), 데스크톱 화면 맞추기(UX-5), 배경음(AUDIO-2)

### beta 2 계획(원래 적어 둔 것)

주인 피드백: 처음 하는 사람은 규칙을 모른다. 화면이 임시 도형이라 너무 허접하다. 그래픽을 3D 느낌까지 신경 써 달라.

1. 첫 플레이 안내: 1레벨 시작 전에 규칙을 그림으로 보여 주는 짧은 안내(2~3장) + 1~3레벨 손가락 튜토리얼(UX-1). 4레벨 첫 거치대 안내 한 줄.
2. 그래픽: 코드로 그린 임시 도형을 실제 스프라이트로 바꾼다(ART-1). 이미지 생성 도구로 드론 팩, 상자, 거치대, 버튼, 아이콘을 만들고 입체감(그림자, 하이라이트, 원근) 있는 스타일로 통일한다. 밤하늘과 도시 배경(ART-2), 드론 빛 번짐.
3. UI 다듬기: 메뉴 첫 화면, 게임 HUD, 결과 화면 레이아웃과 글자 크기, 버튼 눌림 연출.
4. 효과음(AUDIO-1) 최소 세트.
5. `BUILD_LABEL`을 `beta 2`로 바꾸고 `npm test && npm run build && npm run smoke` 통과 후 같은 아티팩트 링크에 다시 올린다.
