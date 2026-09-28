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
  }
  interface Face {
    pts: string;
    cls: string;
  }

  let lines: Line[] = [];
  let faces: Face[] = [];
  let vb = '0 0 100 100';

  $: {
    const { nx, ny, nz } = dims;
    const pts: [number, number][] = [];
    const cache = new Map<string, [number, number]>();
    const cp = (a: number, b: number, c: number): [number, number] => {
      const key = a + ',' + b + ',' + c;
      let p = cache.get(key);
      if (!p) {
        p = P(a, b, c);
        cache.set(key, p);
        pts.push(p);
      }
      return p;
    };
    const poly = (vs: [number, number][]): string =>
      vs.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

    // 包围盒线框
    const edges: [[number, number, number], [number, number, number]][] = [
      [[0, 0, 0], [nx, 0, 0]],
      [[0, 0, 0], [0, ny, 0]],
      [[0, 0, 0], [0, 0, nz]],
    ];
    lines = edges.map(([a, b]) => {
      const p = cp(a[0], a[1], a[2]);
      const q = cp(b[0], b[1], b[2]);
      return { x1: p[0], y1: p[1], x2: q[0], y2: q[1] };
    });

    // 体素预览
    const fs: Face[] = [];
    if (voxels) {
      for (const { x, y, z } of voxels) {
        fs.push({
          pts: poly([cp(x, y, z + 1), cp(x + 1, y, z + 1), cp(x + 1, y + 1, z + 1), cp(x, y + 1, z + 1)]),
          cls: 'top',
        });
      }
    }
    faces = fs;

    vb = '-110 -130 220 260';
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
