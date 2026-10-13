// 레벨 난이도 리포트. 밸런스를 바꾼 뒤 숫자로 확인하는 용도.
// 사용법: npm run report -- [시작레벨] [끝레벨]
import { estimateWinRate } from '../src/core/bot';
import { levelFor } from '../src/core/levelgen';
import { minRackNeeded } from '../src/core/solver';

const from = Number(process.argv[2] ?? 1);
const to = Number(process.argv[3] ?? 60);

console.log(
  'level kind      pic       cues packs crates hidden target minRack winTarget genWin botWin200 tries genTime',
);
for (let n = from; n <= to; n++) {
  const t0 = performance.now();
  const g = levelFor(n);
  const ms = performance.now() - t0;
  const { level, params } = g;
  const packs = level.crates.flat();
  const hidden = packs.filter((p) => p.hidden).length;
  const need = minRackNeeded(level, 9, 300_000);
  const win = estimateWinRate(level, 200, n);
  console.log(
    [
      String(n).padStart(5),
      params.kind.padEnd(9),
      level.pictureId.padEnd(9),
      String(level.cues.length).padStart(4),
      String(packs.length).padStart(5),
      String(level.crates.length).padStart(6),
      String(hidden).padStart(6),
      `${params.rackTarget[0]}-${params.rackTarget[1]}`.padStart(6),
      String(need ?? '?').padStart(7),
      `${Math.round(params.botWinTarget[0] * 100)}-${Math.round(params.botWinTarget[1] * 100)}%`.padStart(9),
      `${Math.round(g.botWin * 100)}%`.padStart(6),
      `${Math.round(win * 100)}%`.padStart(9),
      String(g.attempts).padStart(5),
      `${ms.toFixed(0)}ms`.padStart(6),
    ].join(' '),
  );
}
