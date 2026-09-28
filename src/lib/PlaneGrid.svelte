<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title: string;
  export let na: number;
  export let nb: number;
  export let grid: boolean[][]; // grid[i][j]
  /** 两个轴的名称（i = 该面第一轴，j = 第二轴） */
  export let axisI = 'i';
  export let axisJ = 'j';
  /** 需要高亮提示的格（如无解时无支撑的投影格） */
  export let marked: { i: number; j: number } | null = null;

  const dispatch = createEventDispatcher<{ toggle: { i: number; j: number } }>();

  const cell = 38;
  const padL = 34;
  const padT = 12;
  const padR = 12;
  const padB = 34;

  $: w = padL + na * cell + padR;
  $: h = padT + nb * cell + padB;
</script>

<figure class="plane">
  <figcaption>{title} <span class="dims">{na}×{nb}</span></figcaption>
  <svg width={w} {h} viewBox="0 0 {w} {h}">
    {#each Array(na) as _, i}
      {#each Array(nb) as _, j}
        <!-- 视觉上第 j 行从下往上排：屏幕行 = nb-1-j；点击直接派发数据坐标 (i,j) -->
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <g class="cell" on:click={() => dispatch('toggle', { i, j })}>
          <rect
            x={padL + i * cell + 1.5}
            y={padT + (nb - 1 - j) * cell + 1.5}
            width={cell - 3}
            height={cell - 3}
            rx="6"
            class:filled={grid[i][j]}
            class:marked={marked && marked.i === i && marked.j === j}
          />
          <text
            x={padL + i * cell + cell / 2}
            y={padT + (nb - 1 - j) * cell + cell / 2 + 5}
            class:on={grid[i][j]}>{grid[i][j] ? 1 : 0}</text
          >
        </g>
      {/each}
    {/each}

    <!-- 第一轴 i：列下标，标在格下方 -->
    {#each Array(na) as _, i}
      <text x={padL + i * cell + cell / 2} y={padT + nb * cell + 16} class="tick">{i}</text>
    {/each}
    <text x={padL + na * cell + 6} y={padT + nb * cell + 16} class="axis">{axisI}</text>

    <!-- 第二轴 j：行下标，标在格左方（最上方为最大下标） -->
    {#each Array(nb) as _, j}
      <text x={padL - 8} y={padT + (nb - 1 - j) * cell + cell / 2 + 5} class="tick">{j}</text>
    {/each}
    <text x={padL - 8} y={padT - 2} class="axis">{axisJ}</text>
  </svg>
</figure>

<style>
  .plane {
    margin: 0;
    background: #fff;
    border: 1px solid #dbe2ec;
    border-radius: 10px;
    padding: 10px 12px 6px;
  }
  figcaption {
    font-weight: 600;
    font-size: 14px;
    color: #1e293b;
    margin-bottom: 2px;
  }
  .dims {
    font-weight: 400;
    color: #64748b;
    font-size: 12px;
  }
  .cell {
    cursor: pointer;
  }
  .cell rect {
    fill: #f1f5f9;
    stroke: #cbd5e1;
    stroke-width: 1;
    transition: fill 0.1s;
  }
  .cell:hover rect {
    stroke: #3b82f6;
  }
  .cell rect.filled {
    fill: #3b82f6;
    stroke: #1d4ed8;
  }
  .cell rect.marked {
    stroke: #dc2626;
    stroke-width: 2.5;
  }
  .cell text {
    font-size: 13px;
    text-anchor: middle;
    fill: #94a3b8;
    pointer-events: none;
    user-select: none;
  }
  .cell text.on {
    fill: #fff;
    font-weight: 700;
  }
  .tick {
    font-size: 11px;
    fill: #64748b;
    text-anchor: middle;
    user-select: none;
  }
  .axis {
    font-size: 13px;
    font-weight: 700;
    fill: #334155;
    text-anchor: middle;
    user-select: none;
  }
</style>
