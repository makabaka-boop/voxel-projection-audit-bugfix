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
        if (xy[x][y] && xz[x][z]) out.push({ x, y, z });
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
  const cells = cellsInOrder(dims).reverse();
  for (const cell of cells) {
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

/** 最低有效位的下标 */
function lowbitIndex(n: number): number {
  return 31 - Math.clz32(n & -n);
}

export function solve(dims: Dims, xy: Grid, xz: Grid, yz: Grid): SolveResult {
  const cand = candidates(dims, xy, xz, yz);
  const unsupported = firstUnsupported(dims, xy, xz, yz, cand);
  if (unsupported) return { ok: false, unsupported };
  return { ok: true, voxels: cand };
}
