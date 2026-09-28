<script lang="ts">
  import type { Dims, Voxel } from './solver';

  export let voxels: Voxel[] | null; // null = 结论已清除
  export let dims: Dims;

  const u = 34;
  const COS = 0.86602540378;
  const SIN = 0.5;

  type P2 = [number, number];

  // 等轴投影：x 向右下、y 向左下、z 向上
  function P(a: number, b: number, c: number): P2 {
    return [(a - b) * COS * u, (a + b) * SIN * u - c * u];
  }

  interface Line {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  interface Face {
    pts: string;
    cls: string;
    depth: number;
  }

  let lines: Line[] = [];
  let faces: Face[] = [];
  let vb = '0 0 100 100';
  let axisTips: { p: P2; label: string }[] = [];

  $: {
    const { nx, ny, nz } = dims;
    const pts: P2[] = [];
    const cache = new Map<string, P2>();
    const cp = (a: number, b: number, c: number): P2 => {
      const key = a + ',' + b + ',' + c;
      let p = cache.get(key);
      if (!p) {
        p = P(a, b, c);
        cache.set(key, p);
        pts.push(p);
      }
      return p;
    };
    const poly = (vs: P2[]): string =>
      vs.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

    // 包围盒 12 条棱
    const edges: [[number, number, number], [number, number, number]][] = [];
    for (let b = 0; b <= ny; b++)
      for (let c = 0; c <= nz; c++) edges.push([[0, b, c], [nx, b, c]]);
    for (let a = 0; a <= nx; a++)
      for (let c = 0; c <= nz; c++) edges.push([[a, 0, c], [a, ny, c]]);
    for (let a = 0; a <= nx; a++)
      for (let b = 0; b <= ny; b++) edges.push([[a, b, 0], [a, b, nz]]);
    lines = edges.map(([s, t]) => {
      const p = cp(s[0], s[1], s[2]);
      const q = cp(t[0], t[1], t[2]);
      return { x1: p[0], y1: p[1], x2: q[0], y2: q[1] };
    });

    axisTips = [
      { p: cp(nx, 0, 0), label: 'x' },
      { p: cp(0, ny, 0), label: 'y' },
      { p: cp(0, 0, nz), label: 'z' },
    ];

    // 体素预览：只画朝外且不被相邻体素遮挡的面；按深度自后向前绘制
    const fs: Face[] = [];
    if (voxels) {
      const set = new Set(voxels.map((v) => v.x + ',' + v.y + ',' + v.z));
      const has = (x: number, y: number, z: number) => set.has(x + ',' + y + ',' + z);
      for (const { x, y, z } of voxels) {
        // 深度：c 分量权重最高（相机在 +z 侧），同层时 x+y 大的更近
        const d = x + y + 2 * z;
        if (!has(x, y, z + 1)) {
          fs.push({
            pts: poly([cp(x, y, z + 1), cp(x + 1, y, z + 1), cp(x + 1, y + 1, z + 1), cp(x, y + 1, z + 1)]),
            cls: 'top',
            depth: d + 2,
          });
        }
        if (!has(x + 1, y, z)) {
          fs.push({
            pts: poly([cp(x + 1, y, z), cp(x + 1, y + 1, z), cp(x + 1, y + 1, z + 1), cp(x + 1, y, z + 1)]),
            cls: 'right',
            depth: d,
          });
        }
        if (!has(x, y + 1, z)) {
          fs.push({
            pts: poly([cp(x, y + 1, z), cp(x, y + 1, z + 1), cp(x + 1, y + 1, z + 1), cp(x + 1, y + 1, z)]),
            cls: 'left',
            depth: d,
          });
        }
      }
      // 画家算法：深度小（远）的先画
      fs.sort((a, b) => a.depth - b.depth);
    }
    faces = fs;

    // 自适应 viewBox（含轴标签留白）
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    vb = `${minX - 18} ${minY - 18} ${maxX - minX + 36} ${maxY - minY + 36}`;
  }
</script>

<div class="iso">
  {#if voxels}
    {#if voxels.length === 0}
      <p class="note">空模型（0 个体素）</p>
    {/if}
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet">
      {#each lines as l}
        <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} class="wire" />
      {/each}
      {#each faces as f}
        <polygon points={f.pts} class={f.cls} />
      {/each}
      {#each axisTips as t}
        <text x={t.p[0]} y={t.p[1]} class="axis" dy="-3">{t.label}</text>
      {/each}
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
  .axis {
    font-size: 13px;
    font-weight: 700;
    fill: #475569;
    text-anchor: middle;
    user-select: none;
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
