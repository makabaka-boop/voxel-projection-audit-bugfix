<script lang="ts">
  import type { Dims, Voxel } from './solver';

  export let voxels: Voxel[] | null; // null = 结论已清除
  export let dims: Dims;

  const u = 34;
  const COS = 0.86602540378;
  const SIN = 0.5;

  // 等轴投影：x 向右下、y 向左下、z 向上
  function P(a: number, b: number, c: number): [number, number] {
    return [(a - b) * COS * u, (a + b) * SIN * u - c * u];
  }

  interface Line {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    cls: string;
  }
  interface Face {
    pts: string;
    cls: string;
    depth: number;
  }

  let lines: Line[] = [];
  let faces: Face[] = [];
  let vb = '-100 -120 220 250';

  $: {
    const { nx, ny, nz } = dims;
    const cp = (a: number, b: number, c: number): [number, number] => P(a, b, c);
    const poly = (vs: [number, number][]): string =>
      vs.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const seg = (
      a: [number, number, number],
      b: [number, number, number],
      cls: string,
    ): Line => {
      const p = cp(a[0], a[1], a[2]);
      const q = cp(b[0], b[1], b[2]);
      return { x1: p[0], y1: p[1], x2: q[0], y2: q[1], cls };
    };

    // 包围盒 12 条棱
    const corners: [number, number, number][] = [];
    for (let a = 0; a <= 1; a++)
      for (let b = 0; b <= 1; b++)
        for (let c = 0; c <= 1; c++)
          corners.push([a * nx, b * ny, c * nz]);
    const ls: Line[] = [];
    for (let s = 0; s < corners.length; s++) {
      for (let t = s + 1; t < corners.length; t++) {
        const da = corners[s][0] !== corners[t][0] ? 1 : 0;
        const db = corners[s][1] !== corners[t][1] ? 1 : 0;
        const dc = corners[s][2] !== corners[t][2] ? 1 : 0;
        if (da + db + dc === 1) ls.push(seg(corners[s], corners[t], 'wire'));
      }
    }

    // 三条坐标轴（自原点出发的棱，彩色覆盖在虚线棱上）
    ls.push(seg([0, 0, 0], [nx, 0, 0], 'axis-x'));
    ls.push(seg([0, 0, 0], [0, ny, 0], 'axis-y'));
    ls.push(seg([0, 0, 0], [0, 0, nz], 'axis-z'));
    lines = ls;

    // 体素预览：从 (+x,+y,+z) 方向观察，仅画朝外且无相邻体素遮挡的面
    const fs: Face[] = [];
    if (voxels) {
      const occupied = new Set(voxels.map((v) => `${v.x},${v.y},${v.z}`));
      const has = (x: number, y: number, z: number): boolean =>
        occupied.has(`${x},${y},${z}`);
      // 画家算法：x+y+z 小（离观察者远）的先画
      const ordered = [...voxels].sort(
        (a, b) => a.x + a.y + a.z - (b.x + b.y + b.z),
      );
      for (const { x, y, z } of ordered) {
        const depth = x + y + z;
        if (!has(x, y + 1, z)) {
          // +y 面（左下侧面）
          fs.push({
            pts: poly([cp(x, y + 1, z), cp(x + 1, y + 1, z), cp(x + 1, y + 1, z + 1), cp(x, y + 1, z + 1)]),
            cls: 'left',
            depth,
          });
        }
        if (!has(x + 1, y, z)) {
          // +x 面（右下侧面）
          fs.push({
            pts: poly([cp(x + 1, y, z), cp(x + 1, y + 1, z), cp(x + 1, y + 1, z + 1), cp(x + 1, y, z + 1)]),
            cls: 'right',
            depth,
          });
        }
        if (!has(x, y, z + 1)) {
          // +z 面（顶面）
          fs.push({
            pts: poly([cp(x, y, z + 1), cp(x + 1, y, z + 1), cp(x + 1, y + 1, z + 1), cp(x, y + 1, z + 1)]),
            cls: 'top',
            depth,
          });
        }
      }
    }
    faces = fs;

    // 动态包围盒（含轴标签留白）
    const minX = -ny * COS * u - 22;
    const maxX = nx * COS * u + 24;
    const minY = -nz * u - 26;
    const maxY = (nx + ny) * SIN * u + 24;
    vb = `${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`;
  };
</script>

<div class="iso">
  {#if voxels}
    {#if voxels.length === 0}
      <p class="note">空模型（0 个体素）</p>
    {/if}
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="arrow-x" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#dc2626" />
        </marker>
        <marker id="arrow-y" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#16a34a" />
        </marker>
        <marker id="arrow-z" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#2563eb" />
        </marker>
      </defs>
      {#each lines as l}
        <line
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          class={l.cls}
          marker-end={l.cls === 'axis-x' ? 'url(#arrow-x)' : l.cls === 'axis-y' ? 'url(#arrow-y)' : l.cls === 'axis-z' ? 'url(#arrow-z)' : null}
        />
      {/each}
      {#each faces as f}
        <polygon points={f.pts} class={f.cls} />
      {/each}
      <text x={dims.nx * COS * u + 10} y={dims.nx * SIN * u + 4} class="lbl lbl-x">X</text>
      <text x={-dims.ny * COS * u - 10} y={dims.ny * SIN * u + 4} class="lbl lbl-y">Y</text>
      <text x={8} y={-dims.nz * u - 8} class="lbl lbl-z">Z</text>
    </svg>
  {:else}
    <div class="placeholder">结论已清除<br />点击「重建」生成模型</div>
  {/if}
</div>

<style>
  .iso {
    position: relative;
    width: 100%;
    min-height: 320px;
    background: #fff;
    border: 1px solid #dbe2ec;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: 100%;
    min-height: 320px;
  }
  .wire {
    stroke: #cbd5e1;
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .axis-x {
    stroke: #dc2626;
    stroke-width: 2;
  }
  .axis-y {
    stroke: #16a34a;
    stroke-width: 2;
  }
  .axis-z {
    stroke: #2563eb;
    stroke-width: 2;
  }
  polygon {
    stroke: #1e3a8a;
    stroke-width: 0.8;
    stroke-linejoin: round;
  }
  .top {
    fill: #93c5fd;
  }
  .left {
    fill: #3b82f6;
  }
  .right {
    fill: #2563eb;
  }
  .lbl {
    font-size: 14px;
    font-weight: 700;
    text-anchor: middle;
    user-select: none;
  }
  .lbl-x {
    fill: #dc2626;
  }
  .lbl-y {
    fill: #16a34a;
  }
  .lbl-z {
    fill: #2563eb;
  }
  .placeholder {
    color: #94a3b8;
    text-align: center;
    line-height: 1.8;
    font-size: 14px;
  }
  .note {
    position: absolute;
    top: 10px;
    left: 12px;
    margin: 0;
    color: #64748b;
    font-size: 13px;
  }
</style>
