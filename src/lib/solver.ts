/**
 * 三向正交投影 → 最少体素重建。
 *
 * 规则：
 *  - 体素 (x,y,z) 可占用的必要条件：XY[x][y]、XZ[x][z]、YZ[y][z] 三格都为 1；
 *  - 每个为 1 的投影格必须至少被一个选中体素覆盖；
 *  - 求占用体素数最少的模型；并列时取“按 (x,y,z) 排序后的体素列表”字典序最小者；
 *  - 无解时报告首个没有任何候选体素支撑的投影格
 *    （判定顺序：XY → XZ → YZ 面；面内第二轴 j 升序、同行内第一轴 i 升序）。
 */

export interface Dims {
  nx: number;
  ny: number;
  nz: number;
}

export type PlaneId = 'xy' | 'xz' | 'yz';

export interface CellRef {
  plane: PlaneId;
  /** 该面第一轴坐标（xy/xz 为 x，yz 为 y） */
  i: number;
  /** 该面第二轴坐标（xy 为 y，xz/yz 为 z） */
  j: number;
}

export interface Voxel {
  x: number;
  y: number;
  z: number;
}

/** grid[i][j]，i 为该面第一轴、j 为第二轴 */
export type Grid = boolean[][];

export type SolveResult =
  | { ok: true; voxels: Voxel[] }
  | { ok: false; unsupported: CellRef };

export const PLANES: PlaneId[] = ['xy', 'xz', 'yz'];

export function planeDims(dims: Dims, plane: PlaneId): [number, number] {
  if (plane === 'xy') return [dims.nx, dims.ny];
  if (plane === 'xz') return [dims.nx, dims.nz];
  return [dims.ny, dims.nz];
}

export function getCell(
  plane: PlaneId,
  xy: Grid,
  xz: Grid,
  yz: Grid,
  i: number,
  j: number,
): boolean {
  if (plane === 'xy') return xy[i][j];
  if (plane === 'xz') return xz[i][j];
  return yz[i][j];
}

/** 全部投影格按“首个无支撑”判定顺序排列 */
export function cellsInOrder(dims: Dims): CellRef[] {
  const out: CellRef[] = [];
  for (const plane of PLANES) {
    const [na, nb] = planeDims(dims, plane);
    for (let j = 0; j < nb; j++) {
      for (let i = 0; i < na; i++) out.push({ plane, i, j });
    }
  }
  return out;
}

export function coversCell(plane: PlaneId, i: number, j: number, v: Voxel): boolean {
  if (plane === 'xy') return v.x === i && v.y === j;
  if (plane === 'xz') return v.x === i && v.z === j;
  return v.y === i && v.z === j;
}

/** 全部候选体素（三向投影对应格均为 1），按 (x,y,z) 字典序返回 */
export function candidates(dims: Dims, xy: Grid, xz: Grid, yz: Grid): Voxel[] {
  const out: Voxel[] = [];
  for (let x = 0; x < dims.nx; x++) {
    for (let y = 0; y < dims.ny; y++) {
      for (let z = 0; z < dims.nz; z++) {
        if (xy[x][y] && xz[x][z] && yz[y][z]) out.push({ x, y, z });
      }
    }
  }
  return out;
}

/** 首个没有任何候选体素支撑的为 1 的投影格；全部有支撑则返回 null */
export function firstUnsupported(
  dims: Dims, xy: Grid, xz: Grid, yz: Grid,
  cand: Voxel[] = candidates(dims, xy, xz, yz),
): CellRef | null {
  for (const cell of cellsInOrder(dims)) {
    if (getCell(cell.plane, xy, xz, yz, cell.i, cell.j) &&
        !cand.some((v) => coversCell(cell.plane, cell.i, cell.j, v))) return cell;
  }
  return null;
}

/** 由体素集合计算三向投影 */
export function projectionsOf(dims: Dims, voxels: Voxel[]): { xy: Grid; xz: Grid; yz: Grid } {
  const xy: Grid = Array.from({ length: dims.nx }, () => Array(dims.ny).fill(false));
  const xz: Grid = Array.from({ length: dims.nx }, () => Array(dims.nz).fill(false));
  const yz: Grid = Array.from({ length: dims.ny }, () => Array(dims.nz).fill(false));
  for (const v of voxels) {
    xy[v.x][v.y] = true;
    xz[v.x][v.z] = true;
    yz[v.y][v.z] = true;
  }
  return { xy, xz, yz };
}

function popcount(n: number): number {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/* ---------- 最少集合覆盖（带下界剪枝的搜索） ---------- */

/**
 * 把每个为 1 的投影格映射到一个比特位，返回：
 *  - req：需要覆盖的位掩码
 *  - masks：各候选体素覆盖的投影格位掩码（顺序与 cand 一致）
 * 每个体素至多覆盖三张面上的各一格，故一个掩码至多 3 位。
 */
function buildCoverage(dims: Dims, xy: Grid, xz: Grid, yz: Grid, cand: Voxel[]) {
  const index = new Map<string, number>();
  let bit = 0;
  for (const cell of cellsInOrder(dims)) {
    if (getCell(cell.plane, xy, xz, yz, cell.i, cell.j)) {
      index.set(`${cell.plane}:${cell.i}:${cell.j}`, bit++);
    }
  }
  const req = bit === 32 ? ~0 : (1 << bit) - 1;
  const masks: number[] = [];
  for (const v of cand) {
    let m = 0;
    const k1 = index.get(`xy:${v.x}:${v.y}`);
    const k2 = index.get(`xz:${v.x}:${v.z}`);
    const k3 = index.get(`yz:${v.y}:${v.z}`);
    if (k1 !== undefined) m |= 1 << k1;
    if (k2 !== undefined) m |= 1 << k2;
    if (k3 !== undefined) m |= 1 << k3;
    masks.push(m);
  }
  return { req, masks };
}

/**
 * 是否存在用至多 budget 个候选（cm，按固定顺序排列）覆盖 uncovered 的方案。
 * 剪枝：后缀并集可行性、每步至多覆盖 3 格的位数下界、最稀有格强制分支。
 *
 * 分支模型（保证互斥且穷尽）：每步固定一个未覆盖格 target，把可用候选分成
 *   - 覆盖者 c_0<c_1<...：第 r 个分支选 c_r，并仅在“覆盖 target”这一意义下排除
 *     c_0..c_{r-1}（excl 掩码）；
 *   - 不覆盖 target 的候选：不属于排除集合，后续步骤仍可使用（所以递归起点
 *     固定为 0，可用性由 excl 控制）。
 */
function coverExists(cm: number[], uncovered0: number, budget: number): boolean {
  if (uncovered0 === 0) return true;
  if (budget === 0) return false;
  const allMask = cm.length >= 32 ? ~0 : (1 << cm.length) - 1;

  const dfs = (excl: number, uncovered: number, budget: number): boolean => {
    if (uncovered === 0) return true;
    if (budget === 0) return false;
    // 后缀并集（带排除）可行性
    let union = 0;
    let avail = allMask & ~excl;
    while (avail) {
      const b = avail & -avail;
      avail ^= b;
      union |= cm[31 - Math.clz32(b)];
    }
    if ((union & uncovered) !== uncovered) return false;
    // 每个体素至多覆盖 3 个为 1 的投影格
    if (popcount(uncovered) > budget * 3) return false;

    // 找一个当前可选候选覆盖得最少的未覆盖格（最稀有格）
    let targetBit = 0;
    let rarest = Infinity;
    let bits = uncovered;
    while (bits) {
      const b = bits & -bits;
      bits ^= b;
      let cnt = 0;
      let av = allMask & ~excl;
      while (av) {
        const t = av & -av;
        av ^= t;
        if (cm[31 - Math.clz32(t)] & b) cnt++;
      }
      if (cnt === 0) return false;
      if (cnt < rarest) {
        rarest = cnt;
        targetBit = b;
        if (cnt === 1) break;
      }
    }

    // 覆盖 target 的候选（按候选下标顺序）；归一化掩码相同的去重保留最早者
    const coverers: number[] = [];
    const seen = new Set<number>();
    let av2 = allMask & ~excl;
    while (av2) {
      const t = av2 & -av2;
      av2 ^= t;
      const k = 31 - Math.clz32(t);
      const m = cm[k] & uncovered;
      if ((m & targetBit) && !seen.has(m)) {
        seen.add(m);
        coverers.push(k);
      }
    }

    for (let r = 0; r < coverers.length; r++) {
      const k = coverers[r];
      let nextExcl = excl;
      for (let s = 0; s < r; s++) nextExcl |= 1 << coverers[s];
      if (dfs(nextExcl | (1 << k), uncovered & ~cm[k], budget - 1)) return true;
    }
    return false;
  };

  return dfs(0, uncovered0, budget);
}

/** 贪心集合覆盖：返回最少覆盖数的一个上界（每步选覆盖最多未覆盖格的候选） */
function greedyUpper(cm: number[], uncovered: number): number {
  let used = 0;
  while (uncovered) {
    let best = 0;
    let bestCnt = -1;
    for (const m0 of cm) {
      const m = m0 & uncovered;
      const c = popcount(m);
      if (c > bestCnt) {
        bestCnt = c;
        best = m;
      }
    }
    if (best === 0) return cm.length + 1; // 调用前已保证每格有候选支撑，不会走到
    uncovered &= ~best;
    used++;
  }
  return used;
}

/**
 * 求最少体素覆盖；并列时取候选（按 (x,y,z) 字典序）列表字典序最小者。
 * 两阶段：先二分最少体素数 K，再逐位贪心构造字典序最小的 K 元列表。
 */
function minimumCover(cand: Voxel[], masks: number[], req: number): Voxel[] {
  if (req === 0) return [];

  // 阶段一：二分最少体素数 K
  const upper = greedyUpper(masks, req);
  let lo = 1;
  let hi = upper;
  let k = upper;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (coverExists(masks, req, mid)) {
      k = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  // 阶段二：按候选顺序逐位决定——能取靠前候选且剩余仍可在名额内完成就取
  const chosen: Voxel[] = [];
  let start = 0;
  let uncovered = req;
  for (let remain = k; remain > 0; remain--) {
    for (let idx = start; idx < masks.length; idx++) {
      const m = masks[idx] & uncovered;
      if (m === 0) continue;
      const rest = masks.slice(idx + 1);
      if (coverExists(rest, uncovered & ~m, remain - 1)) {
        chosen.push(cand[idx]);
        uncovered &= ~m;
        start = idx + 1;
        break;
      }
    }
  }
  return chosen;
}

/**
 * 剔除重复掩码与被支配候选：
 * 若候选 a（位置更早）的覆盖位包含候选 b，则任何含 b 的最优解把 b 换成 a
 * 覆盖不减少、体素数不增加且字典序不变大，故 b 永不会出现在答案中。
 * 入参按 (x,y,z) 字典序排列。
 */
function pruneMasks(cand: Voxel[], masks: number[]): { cand: Voxel[]; masks: number[] } {
  const keepCand: Voxel[] = [];
  const keepMasks: number[] = [];
  outer: for (let i = 0; i < masks.length; i++) {
    for (let j = 0; j < keepMasks.length; j++) {
      if ((keepMasks[j] & masks[i]) === masks[i]) continue outer;
    }
    keepCand.push(cand[i]);
    keepMasks.push(masks[i]);
  }
  return { cand: keepCand, masks: keepMasks };
}

export function solve(dims: Dims, xy: Grid, xz: Grid, yz: Grid): SolveResult {
  const cand0 = candidates(dims, xy, xz, yz);
  const unsupported = firstUnsupported(dims, xy, xz, yz, cand0);
  if (unsupported) return { ok: false, unsupported };
  const { req, masks: masks0 } = buildCoverage(dims, xy, xz, yz, cand0);
  const { cand, masks } = pruneMasks(cand0, masks0);
  return { ok: true, voxels: minimumCover(cand, masks, req) };
}
