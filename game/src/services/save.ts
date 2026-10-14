import type { KeyValueStore } from './storage';

export type Lang = 'ko' | 'en';

export interface SaveData {
  version: 1;
  /** 다음에 플레이할 레벨(1부터). */
  level: number;
  coins: number;
  removeAds: boolean;
  /** 처음 하는 사람용 규칙 안내를 봤는지. */
  howToSeen: boolean;
  settings: {
    sound: boolean;
    music: boolean;
    haptics: boolean;
    lang: Lang | null;
  };
  daily: {
    /** 마지막으로 데일리를 깬 날 'YYYY-MM-DD'. */
    lastCompleted: string | null;
    streak: number;
    best: number;
  };
  cosmetics: {
    owned: string[];
    selected: string;
  };
  stats: {
    rounds: number;
    wins: number;
  };
}

export const SAVE_KEY = 'game.save';

export function defaultSave(): SaveData {
  return {
    version: 1,
    level: 1,
    coins: 0,
    removeAds: false,
    howToSeen: false,
    settings: { sound: true, music: true, haptics: true, lang: null },
    daily: { lastCompleted: null, streak: 0, best: 0 },
    cosmetics: { owned: ['default'], selected: 'default' },
    stats: { rounds: 0, wins: 0 },
  };
}

/**
 * 저장 형식을 바꿀 땐 version을 올리고 여기에 변환 단계를 추가한다.
 * 기존 유저의 진행이 날아가면 리뷰 폭탄을 맞는다.
 */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<SaveData>;
  return {
    ...base,
    ...data,
    version: 1,
    settings: { ...base.settings, ...(data.settings ?? {}) },
    daily: { ...base.daily, ...(data.daily ?? {}) },
    cosmetics: { ...base.cosmetics, ...(data.cosmetics ?? {}) },
    stats: { ...base.stats, ...(data.stats ?? {}) },
  };
}

export class SaveService {
  private data: SaveData;

  constructor(private readonly store: KeyValueStore) {
    this.data = this.load();
  }

  get(): Readonly<SaveData> {
    return this.data;
  }

  /** 값을 바꾸고 바로 저장한다. 예: save.update(d => { d.coins += 10; }) */
  update(fn: (draft: SaveData) => void): void {
    fn(this.data);
    this.persist();
  }

  reset(): void {
    this.data = defaultSave();
    this.persist();
  }

  private load(): SaveData {
    const text = this.store.get(SAVE_KEY);
    if (!text) return defaultSave();
    try {
      return migrate(JSON.parse(text));
    } catch {
      return defaultSave();
    }
  }

  private persist(): void {
    this.store.set(SAVE_KEY, JSON.stringify(this.data));
  }
}
