import type { Lang } from './save';

// 화면에 나오는 글자는 전부 여기 둔다. 새 키는 ko와 en에 동시에 추가해야 타입 검사를 통과한다.
const ko = {
  'menu.play': '시작',
  'menu.level': '레벨 {n}',
  'menu.daily': '오늘의 도전',
  'menu.dailyDone': '오늘 도전 완료',
  'menu.streak': '{n}일 연속',
  'settings.sound': '효과음',
  'settings.music': '음악',
  'settings.on': '켜짐',
  'settings.off': '꺼짐',
  'game.level': '레벨 {n}',
  'result.win': '클리어!',
  'result.lose': '아쉬워요',
  'result.next': '다음 레벨',
  'result.retry': '다시 하기',
  'result.continue': '광고 보고 이어하기',
  'result.double': '광고 보고 보상 2배',
  'result.home': '홈',
  'result.coins': '+{n} 코인',
  'common.loading': '불러오는 중',
} as const;

export type StringKey = keyof typeof ko;

const en: Record<StringKey, string> = {
  'menu.play': 'Play',
  'menu.level': 'Level {n}',
  'menu.daily': 'Daily Challenge',
  'menu.dailyDone': 'Daily done',
  'menu.streak': '{n}-day streak',
  'settings.sound': 'Sound',
  'settings.music': 'Music',
  'settings.on': 'On',
  'settings.off': 'Off',
  'game.level': 'Level {n}',
  'result.win': 'Cleared!',
  'result.lose': 'So close',
  'result.next': 'Next level',
  'result.retry': 'Retry',
  'result.continue': 'Watch ad to continue',
  'result.double': 'Watch ad for 2x',
  'result.home': 'Home',
  'result.coins': '+{n} coins',
  'common.loading': 'Loading',
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
