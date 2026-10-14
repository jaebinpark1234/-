import type { Lang } from './save';

// 화면에 나오는 글자는 전부 여기 둔다. 새 키는 ko와 en에 동시에 추가해야 타입 검사를 통과한다.
const ko = {
  'menu.play': '시작',
  'menu.level': '레벨 {n}',
  'menu.daily': '오늘의 쇼',
  'menu.dailyDone': '오늘의 쇼 완료',
  'menu.streak': '{n}일 연속',
  'settings.sound': '효과음',
  'settings.music': '음악',
  'settings.on': '켜짐',
  'settings.off': '꺼짐',
  'settings.title': '설정',
  'settings.haptics': '진동',
  'settings.lang': '언어',
  'settings.close': '닫기',
  'game.level': '레벨 {n}',
  'game.daily': '오늘의 쇼',
  'game.now': '지금',
  'game.chain': '연쇄 x{n}!',
  'game.rackFull': '거치대가 꽉 찼어요',
  'game.guessTitle': '무슨 그림일까요?',
  'game.guessRight': '정답! +{n}',
  'game.guessWrong': '땡!',
  'booster.undo': '되돌리기',
  'booster.slot': '+1칸',
  'booster.free': '무료',
  'result.win': '쇼 성공!',
  'result.perfect': '완벽한 쇼!',
  'result.lose': '꽉 막혔어요',
  'result.next': '다음 레벨',
  'result.retry': '다시 하기',
  'result.continue': '광고 보고 이어하기',
  'result.double': '광고 보고 보상 2배',
  'result.home': '홈',
  'result.coins': '+{n} 코인',
  'common.loading': '불러오는 중',
  'menu.howto': '게임 방법',
  'howto.t1': '맨 위 팩을 눌러요',
  'howto.b1': '상자 맨 위에 있는 드론 팩을 누르면\n드론이 하늘로 날아가 그림의 한 조각을 밝혀요.',
  'howto.t2': '쇼 순서를 지켜요',
  'howto.b2': "위쪽 막대의 '지금' 칸에 나온 색만 하늘로 갈 수 있어요.\n×2는 그 색 팩이 2개 필요하다는 뜻이에요.",
  'howto.t3': '거치대에 잠시 둬요',
  'howto.b3': '지금 색이 아닌 팩은 거치대에 들어가요.\n순서가 오면 저절로 날아가요. 5칸이 다 차면 막혀요!',
  'howto.t4': '그림을 완성해요',
  'howto.b4': "'?' 팩은 맨 위에 오면 색이 보여요.\n하늘의 그림이 다 켜지면 쇼 성공!",
  'howto.next': '다음',
  'howto.start': '시작하기',
  'howto.skip': '건너뛰기',
  'game.rackHint': '필요 없는 색은 거치대에 잠시 둘 수 있어요',
} as const;

export type StringKey = keyof typeof ko;

const en: Record<StringKey, string> = {
  'menu.play': 'Play',
  'menu.level': 'Level {n}',
  'menu.daily': 'Daily Show',
  'menu.dailyDone': 'Daily Show done',
  'menu.streak': '{n}-day streak',
  'settings.sound': 'Sound',
  'settings.music': 'Music',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.title': 'Settings',
  'settings.haptics': 'Vibration',
  'settings.lang': 'Language',
  'settings.close': 'Close',
  'game.level': 'Level {n}',
  'game.daily': 'Daily Show',
  'game.now': 'Now',
  'game.chain': 'Chain x{n}!',
  'game.rackFull': 'Rack is full',
  'game.guessTitle': 'What is it?',
  'game.guessRight': 'Correct! +{n}',
  'game.guessWrong': 'Nope!',
  'booster.undo': 'Undo',
  'booster.slot': '+1 slot',
  'booster.free': 'Free',
  'result.win': 'Showtime!',
  'result.perfect': 'Perfect show!',
  'result.lose': 'Jammed',
  'result.next': 'Next level',
  'result.retry': 'Retry',
  'result.continue': 'Watch ad to continue',
  'result.double': 'Watch ad for 2x',
  'result.home': 'Home',
  'result.coins': '+{n} coins',
  'common.loading': 'Loading',
  'menu.howto': 'How to play',
  'howto.t1': 'Tap the top pack',
  'howto.b1': 'Tap the drone pack on top of a crate.\nIts drones fly up and light part of the picture.',
  'howto.t2': 'Follow the show order',
  'howto.b2': "Only the color in the 'Now' slot can fly.\n×2 means that color needs 2 packs.",
  'howto.t3': 'Park packs on the rack',
  'howto.b3': 'Packs of other colors wait on the rack\nand fly by themselves when their turn comes. 5 full = stuck!',
  'howto.t4': 'Finish the picture',
  'howto.b4': "'?' packs show their color when they reach the top.\nLight up the whole picture to win!",
  'howto.next': 'Next',
  'howto.start': 'Start',
  'howto.skip': 'Skip',
  'game.rackHint': "Park colors you don't need yet on the rack",
};

const tables: Record<Lang, Record<StringKey, string>> = { ko, en };

export function detectLang(navigatorLang: string | undefined): Lang {
  return navigatorLang?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export class I18n {
  constructor(public lang: Lang) {}

  t(key: StringKey, vars: Record<string, string | number> = {}): string {
    const template = tables[this.lang][key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
  }
}
