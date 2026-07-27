/**
 * Sanity check for the recursive family-tree layout engine.
 * Run: npx tsx scripts/verify-layout.ts
 */
import { configToGraph, layoutGraph } from '../src/app/components/familyGraph';
import { DEFAULT_CONFIG } from '../src/app/components/treeTypes';
import type { Members, TreeConfig } from '../src/app/components/treeTypes';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

const run = (label: string, config: TreeConfig, members: Members) => {
  const g = configToGraph(config, members, 'Aku');
  const { nodes } = layoutGraph(g);

  // 1. No duplicate node ids.
  const ids = nodes.map((n) => n.id);
  check(`${label}: no duplicate nodes`, new Set(ids).size === ids.length);

  // 2. Every graph member that should be visible is placed.
  const missing = Object.keys(g).filter((id) => !ids.includes(id));
  check(`${label}: all graph members placed`, missing.length === 0, missing.join(','));

  // 3. Self is centred at x = 0.
  const self = nodes.find((n) => n.id === 'self');
  check(`${label}: self centred`, !!self && Math.abs(self.x) < 0.01, `x=${self?.x}`);

  // 4. No two circles overlap on the same row (min 120px apart).
  const byRow = new Map<number, { id: string; x: number }[]>();
  for (const n of nodes) {
    const row = byRow.get(n.y) ?? [];
    row.push({ id: n.id, x: n.x });
    byRow.set(n.y, row);
  }
  let clash = '';
  for (const [y, row] of byRow) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - row[i - 1].x;
      if (gap < 120) clash = `y=${y} ${row[i - 1].id}<->${row[i].id} gap=${gap.toFixed(0)}`;
    }
  }
  check(`${label}: no overlapping circles`, clash === '', clash);
  return { nodes, g };
};

// ── Case 1: default config, untouched ──
run('default', { ...DEFAULT_CONFIG, configured: true }, {});

// ── Case 2: deep recursion — child → grandchild → great-grandchild ──
const deep: Members = {
  'x-child-1': { name: 'Cucu A', gender: 'L', alive: true, photo: null, group: 'child', parentId: 'child-0' },
  'x-child-2': { name: 'Cicit A', gender: 'P', alive: true, photo: null, group: 'child', parentId: 'x-child-1' },
  'x-child-3': { name: 'Canggah A', gender: 'L', alive: true, photo: null, group: 'child', parentId: 'x-child-2' },
};
const deepRes = run('deep-descendants', { ...DEFAULT_CONFIG, configured: true }, deep);
const depths = deepRes.nodes.filter((n) => n.id.startsWith('x-child')).map((n) => n.y);
check('deep-descendants: 3 extra generations below children', new Set(depths).size === 3, depths.join(','));

// ── Case 3: siblings added onto a sibling (left/right) ──
const sibs: Members = {
  'x-kakak-10': { name: 'Kakak Baru', gender: 'L', alive: true, photo: null, group: 'kakak', parentId: 'parent-0' },
  'x-adik-11': { name: 'Adik Baru', gender: 'P', alive: true, photo: null, group: 'adik', parentId: 'parent-0' },
  'x-child-20': { name: 'Keponakan', gender: 'L', alive: true, photo: null, group: 'child', parentId: 'older-0' },
};
const sibRes = run('siblings+nephew', { ...DEFAULT_CONFIG, configured: true }, sibs);
const kakakBaru = sibRes.nodes.find((n) => n.id === 'x-kakak-10')!;
const adikBaru = sibRes.nodes.find((n) => n.id === 'x-adik-11')!;
check('siblings: new kakak is left of self', kakakBaru.x < 0, `x=${kakakBaru.x}`);
check('siblings: new adik is right of self', adikBaru.x > 0, `x=${adikBaru.x}`);
const nephew = sibRes.nodes.find((n) => n.id === 'x-child-20')!;
check('nephew sits one row below its parent', nephew.y === 210, `y=${nephew.y}`);

// ── Case 4: uncles with their own recursive descendants (cousins) ──
const unclesCfg: TreeConfig = { ...DEFAULT_CONFIG, configured: true };
const uncleMembers: Members = {
  'parent-0': { name: 'Ayah', gender: 'L', alive: false, photo: null, familyConfig: { olderCount: 2, youngerCount: 1 } },
  'x-child-30': { name: 'Sepupu 1', gender: 'L', alive: true, photo: null, group: 'child', parentId: 'unclePo-0' },
  'x-child-31': { name: 'Sepupu 2', gender: 'P', alive: true, photo: null, group: 'child', parentId: 'unclePo-0' },
  'x-child-32': { name: 'Anak Sepupu', gender: 'L', alive: true, photo: null, group: 'child', parentId: 'x-child-30' },
};
const uncleRes = run('uncles+cousins', unclesCfg, uncleMembers);
const cousins = uncleRes.nodes.filter((n) => n.id.startsWith('x-child-3'));
check('uncles: all cousins + their children placed', cousins.length === 3, `${cousins.length}`);

console.log(failures === 0 ? '\nAll layout checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
