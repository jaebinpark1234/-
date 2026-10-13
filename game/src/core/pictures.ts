import { PICTURE_CHARS, type ColorId } from './palette';

/**
 * 드론쇼로 완성할 그림. 지금은 손으로 그린 12칸 폭 ASCII 그림이고,
 * 나중에는 tools/img2level(TASKS.md의 CONTENT-1)이 AI 이미지를 이 형식으로 바꿔 넣는다.
 *
 * 글자: r 빨강, o 주황, y 노랑, g 초록, c 하늘, b 파랑, p 보라, k 분홍, . 빈칸
 * 초반 레벨용 그림은 윤곽만 봐도 알 수 있는 것으로 고른다(하트, 별, 달...).
 */
export interface PictureDef {
  id: string;
  album: string;
  name: { ko: string; en: string };
  rows: string[];
}

export interface Picture {
  id: string;
  album: string;
  name: { ko: string; en: string };
  width: number;
  height: number;
  /** 칸별 색 번호, 빈칸은 -1. 길이 width * height. */
  cells: ColorId[];
}

export const PICTURE_DEFS: PictureDef[] = [
  {
    id: 'heart',
    album: 'basics',
    name: { ko: '하트', en: 'Heart' },
    rows: [
      '.rrr....rrr.',
      'rkkrr..rrrrr',
      'rkrrrrrrrrrp',
      'rrrrrrrrrrpp',
      'rrrrrrrrrrpp',
      '.rrrrrrrrpp.',
      '..rrrrrrpp..',
      '...rrrrpp...',
      '....rrpp....',
      '.....rp.....',
    ],
  },
  {
    id: 'star',
    album: 'basics',
    name: { ko: '별', en: 'Star' },
    rows: [
      '.....yo.....',
      '.....yo.....',
      '....yyoo....',
      '....yyoo....',
      'yyyyyyoooooo',
      '.yyyyyooooo.',
      '..yyyyoooo..',
      '...yyyooo...',
      '..yyyyoooo..',
      '..yyy..ooo..',
      '.yy......oo.',
    ],
  },
  {
    id: 'moon',
    album: 'basics',
    name: { ko: '초승달', en: 'Crescent moon' },
    rows: [
      '...yyyy.....',
      '.yyyo.......',
      '.yyo.....k..',
      'yyo.....kkk.',
      'yyo......k..',
      'yyo.........',
      'yyo.........',
      'yyyo........',
      '.yyyo.....yy',
      '.yyyyooooyy.',
      '...yyyyyy...',
    ],
  },
  {
    id: 'sun',
    album: 'basics',
    name: { ko: '해', en: 'Sun' },
    rows: [
      '.....oo.....',
      '.o...oo...o.',
      '..o......o..',
      '....yyyy....',
      '...yyyyyy...',
      'oo.yyyyyy.oo',
      'oo.yyyyyy.oo',
      '...yyyyyy...',
      '....yyyy....',
      '..o......o..',
      '.o...oo...o.',
      '.....oo.....',
    ],
  },
  {
    id: 'tree',
    album: 'basics',
    name: { ko: '나무', en: 'Tree' },
    rows: [
      '.....gg.....',
      '....gggg....',
      '...gggggg...',
      '....gggg....',
      '...gggggg...',
      '..gggggggg..',
      '...gggggg...',
      '..gggggggg..',
      '.gggggggggg.',
      '.....oo.....',
      '.....oo.....',
      '....oooo....',
    ],
  },
  {
    id: 'fish',
    album: 'basics',
    name: { ko: '물고기', en: 'Fish' },
    rows: [
      '....bbb.....',
      '...bbbbbb...',
      '.bbbbbbbbb.c',
      'bbcbbbbbbbcc',
      'bbbbbbbbbccc',
      'bbbbbbbbbbcc',
      '.bbbbbbbbb.c',
      '...bbbbbb...',
      '....bbb.....',
    ],
  },
  {
    id: 'flower',
    album: 'garden',
    name: { ko: '꽃', en: 'Flower' },
    rows: [
      '....kkkk....',
      '..kkkkkkkk..',
      '.kkkyyyykkk.',
      '.kkyyyyyykk.',
      '.kkkyyyykkk.',
      '..kkkkkkkk..',
      '....kkkk....',
      '.....gg.....',
      '.gg..gg.....',
      '..gggggg..g.',
      '.....gggggg.',
      '.....gg.....',
    ],
  },
  {
    id: 'mushroom',
    album: 'garden',
    name: { ko: '버섯', en: 'Mushroom' },
    rows: [
      '....rrrr....',
      '..rryrrrrr..',
      '.rryyrrryrr.',
      '.rrrrrrryyr.',
      'rryrrrrrrrrr',
      'ryyrrryyrrrr',
      'rrrrrryyrrrr',
      '...oooooo...',
      '...oooooo...',
      '...oooooo...',
      '....oooo....',
    ],
  },
  {
    id: 'house',
    album: 'garden',
    name: { ko: '집', en: 'House' },
    rows: [
      '.....rr.....',
      '....rrrr....',
      '...rrrrrr...',
      '..rrrrrrrr..',
      '.rrrrrrrrrr.',
      '..oooooooo..',
      '..occooooo..',
      '..occoobbo..',
      '..oooobbbo..',
      '..oooobbbo..',
      'gggggggggggg',
    ],
  },
  {
    id: 'rocket',
    album: 'garden',
    name: { ko: '로켓', en: 'Rocket' },
    rows: [
      '.....bb.....',
      '....bbbb....',
      '....bbbb....',
      '...bbccbb...',
      '...bbccbb...',
      '...bbbbbb...',
      '...bbbbbb...',
      '..rbbbbbbr..',
      '.rrbbbbbbrr.',
      '.rr.oooo.rr.',
      '.....yy.....',
      '.....yy.....',
    ],
  },
  {
    id: 'icecream',
    album: 'garden',
    name: { ko: '아이스크림', en: 'Ice cream' },
    rows: [
      '....kkkk....',
      '...kkkkkk...',
      '..kkkkpkkk..',
      '..kkpkkkkk..',
      '..kkkkkkkk..',
      '..oooooooo..',
      '...oooooo...',
      '...oooooo...',
      '....oooo....',
      '....oooo....',
      '.....oo.....',
    ],
  },
  {
    id: 'cat',
    album: 'garden',
    name: { ko: '고양이', en: 'Cat' },
    rows: [
      '.o........o.',
      '.oo......oo.',
      '.ooo....ooo.',
      '.oooooooooo.',
      'oooooooooooo',
      'oogggoogggoo',
      'oogggoogggoo',
      'oooooooooooo',
      'ooooookooooo',
      '.oooooooooo.',
      '..oooooooo..',
    ],
  },
];

export function parsePicture(def: PictureDef): Picture {
  const height = def.rows.length;
  const width = def.rows[0]?.length ?? 0;
  const cells: ColorId[] = [];
  for (const [y, row] of def.rows.entries()) {
    if (row.length !== width) throw new Error(`picture ${def.id}: row ${y} has width ${row.length}, expected ${width}`);
    for (const ch of row) {
      if (ch === '.') cells.push(-1);
      else {
        const color = PICTURE_CHARS[ch];
        if (color === undefined) throw new Error(`picture ${def.id}: unknown char '${ch}'`);
        cells.push(color);
      }
    }
  }
  return { id: def.id, album: def.album, name: def.name, width, height, cells };
}

export const PICTURES: Picture[] = PICTURE_DEFS.map(parsePicture);

/** 6칸 이상 쓰인 색의 수. 색이 적은 그림은 어렵게 만들 수가 없어서 초반 레벨에만 쓴다. */
export function effectiveColors(pic: Picture, minCells = 6): number {
  const counts = new Map<number, number>();
  for (const c of pic.cells) if (c >= 0) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.values()].filter((n) => n >= minCells).length;
}

export function getPicture(id: string): Picture {
  const p = PICTURES.find((x) => x.id === id);
  if (!p) throw new Error(`unknown picture ${id}`);
  return p;
}
