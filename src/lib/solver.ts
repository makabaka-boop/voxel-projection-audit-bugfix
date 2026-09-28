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

function cellKey(c: CellRef): string {
  return c.plane + ':' + c.i + ',' + c.j;
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
  dims: Dims,
  xy: Grid,
  xz: Grid,
  yz: Grid,
  cand: Voxel[] = candidates(dims, xy, xz, yz),
): CellRef | null {
  for (const cell of cellsInOrder(dims)) {
    if (
      getCell(cell.plane, xy, xz, yz, cell.i, cell.j) &&
      !cand.some((v) => coversCell(cell.plane, cell.i, cell.j, v))
    ) {
      return cell;
    }
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

/** 最低有效位的下标 */
function lowbitIndex(n: number): number {
  return 31 - Math.clz32(n & -n);
}

/**
 * 集合覆盖搜索：候选体素按 (x,y,z) 字典序编号 0..n-1，每个体素覆盖其
 * XY/XZ/YZ 三个为 1 投影格（位掩码）。求覆盖全部所需投影格的最少候选数，
 * 再逐位构造字典序最小的等长列表。
 *
 * 可行性判定 DFS 带：
 *  - 最小覆盖者分支（选剩余可用候选数最少的所需格，枚举由谁覆盖它）；
 *  - “不相容需求格”打包下界剪枝（可采纳，不会误剪可行解）；
 *  - 失败状态记忆化。
 *
 * 状态中的“剩余可用候选”用位掩码显式表示（n <= 3^3 = 27，uint32 足够）：
 * 分支只是强制“某个候选必须入选”，其余候选下标不受它限制。
 */
export function solve(dims: Dims, xy: Grid, xz: Grid, yz: Grid): SolveResult {
  const cand = candidates(dims, xy, xz, yz);
  const unsupported = firstUnsupported(dims, xy, xz, yz, cand);
  if (unsupported) return { ok: false, unsupported };

  // 所需投影格（三张面中所有为 1 的格）→ 位编号
  const required: CellRef[] = cellsInOrder(dims).filter((c) =>
    getCell(c.plane, xy, xz, yz, c.i, c.j),
  );
  if (required.length === 0) return { ok: true, voxels: [] };

  const bitIndex = new Map<string, number>();
  required.forEach((c, idx) => bitIndex.set(cellKey(c), idx));
  const M = required.length; // <= 27，位掩码放得进 uint32
  const full = (1 << M) - 1;

  // 候选体素的覆盖掩码（每个候选恰好覆盖三个所需格）
  const cov: number[] = cand.map((v) => {
    const kx = bitIndex.get('xy:' + v.x + ',' + v.y)!;
    const kz = bitIndex.get('xz:' + v.x + ',' + v.z)!;
    const ky = bitIndex.get('yz:' + v.y + ',' + v.z)!;
    return (1 << kx) | (1 << kz) | (1 << ky);
  });
  const n = cov.length;
  const allAvail = (1 << n) - 1;

  // 每个所需格的覆盖候选编号（升序）
  const bitCoverers: number[][] = Array.from({ length: M }, () => []);
  cov.forEach((m, ci) => {
    let t = m;
    while (t) {
      bitCoverers[lowbitIndex(t)].push(ci);
      t &= t - 1;
    }
  });

  // need -> avail -> 已证伪的 slots 位掩码
  const failed = new Map<number, Map<number, number>>();
  const markFailed = (need: number, avail: number, slots: number) => {
    let inner = failed.get(need);
    if (!inner) {
      inner = new Map();
      failed.set(need, inner);
    }
    inner.set(avail, (inner.get(avail) ?? 0) | (1 << slots));
  };

  const feasible = (need0: number, avail0: number, slots0: number): boolean => {
    const dfs = (need: number, avail: number, slots: number): boolean => {
      if (need === 0) return true;
      if (slots === 0 || avail === 0) return false;

      // 丢弃覆盖不到任何剩余所需格的候选
      let useful = 0;
      let a = avail;
      while (a) {
        const ci = lowbitIndex(a);
        if (cov[ci] & need) useful |= 1 << ci;
        a &= a - 1;
      }
      avail = useful;
      if (avail === 0) return false;

      if ((failed.get(need)?.get(avail) ?? 0) & (1 << slots)) return false;

      // 并集剪枝 + 打包下界：挑所需格 b 计 1，剔除“任意可覆盖 b 的可用候选”
      // 能触及的全部格——它们都可能与 b 共用同一个体素；留下的格与 b 不可能
      // 共用候选，每计一个都需要不同的体素。该下界可采纳。
      let lb = 0;
      let union = 0;
      let t = need;
      while (t) {
        const b = lowbitIndex(t);
        let group = 0;
        let count = 0;
        for (const ci of bitCoverers[b]) {
          const bit = 1 << ci;
          if (avail & bit) {
            count++;
            group |= cov[ci];
          }
        }
        if (count === 0) {
          markFailed(need, avail, slots);
          return false;
        }
        union |= group;
        lb++;
        t &= ~group;
      }
      if ((need & ~union) !== 0 || lb > slots) {
        markFailed(need, avail, slots);
        return false;
      }

      // 选“可用覆盖者最少”的所需格分支
      let bestB = -1;
      let bestCount = Infinity;
      let q = need;
      while (q) {
        const b = lowbitIndex(q);
        let count = 0;
        for (const ci of bitCoverers[b]) if (avail & (1 << ci)) count++;
        if (count < bestCount) {
          bestCount = count;
          bestB = b;
          if (count <= 1) break;
        }
        q &= q - 1;
      }

      // 枚举由哪个候选覆盖该格，按新增覆盖格数降序尝试（先求可行，不影响正确性）
      const branch: number[] = [];
      for (const ci of bitCoverers[bestB]) {
        if (avail & (1 << ci)) branch.push(ci);
      }
      branch.sort((p, r) => popcount(cov[r] & need) - popcount(cov[p] & need));

      for (const ci of branch) {
        const bit = 1 << ci;
        if (dfs(need & ~cov[ci], avail & ~bit, slots - 1)) return true;
      }
      markFailed(need, avail, slots);
      return false;
    };
    return dfs(need0, avail0, slots0);
  };

  // 第一阶段：从小到大试 k，找最少体素数。
  // 每个体素至多覆盖 3 格，故 k >= ceil(M/3)；每格各选一个覆盖它的候选即可
  // 覆盖全部格（任意候选子集都满足投影不超界），故 k <= M 时必有可行解。
  let minK = 0;
  for (let k = Math.ceil(M / 3); k <= Math.min(n, M); k++) {
    if (feasible(full, allAvail, k)) {
      minK = k;
      break;
    }
  }

  // 第二阶段：从编号 0 起逐位试探下一个入选下标 ci（剩余候选只能取 ci 之后
  // 的），能与前缀拼成 minK 个覆盖就选，得到字典序最小的有序体素列表。
  const chosen: number[] = [];
  let need = full;
  let start = 0;
  let slots = minK;
  while (need !== 0) {
    // 剩余候选只能取编号 >= start 的
    const suffixMask = allAvail ^ ((1 << start) - 1);
    let picked = -1;
    for (let ci = start; ci < n; ci++) {
      if ((cov[ci] & need) === 0) continue;
      const restAvail = suffixMask & ~(1 << ci);
      if (feasible(need & ~cov[ci], restAvail, slots - 1)) {
        picked = ci;
        break;
      }
    }
    // minK 已证可行，此处必能选中；失败说明搜索内部有误
    if (picked < 0) throw new Error('内部错误：无法构造字典序最小解');
    chosen.push(picked);
    need &= ~cov[picked];
    start = picked + 1;
    slots--;
  }

  return { ok: true, voxels: chosen.map((ci) => cand[ci]) };
}
