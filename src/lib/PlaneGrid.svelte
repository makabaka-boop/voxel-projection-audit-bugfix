<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title: string;
  export let nameI: string; // 横轴（第一轴 i）名称
  export let nameJ: string; // 纵轴（第二轴 j）名称
  export let na: number;
  export let nb: number;
  export let grid: boolean[][]; // grid[i][j]

  const dispatch = createEventDispatcher<{ toggle: { i: number; j: number } }>();

  const cell = 38;
  const padL = 34;
  const padT = 16;
  const padR = 14;
  const padB = 36;

  $: w = padL + na * cell + padR;
  $: h = padT + nb * cell + padB;

  // 第 j 行在画面上自下而上排列
  const rowY = (j: number) => padT + (nb - 1 - j) * cell;
  const colX = (i: number) => padL + i * cell;
</script>

<figure class="plane">
  <figcaption>{title} <span class="dims">{na}×{nb}</span></figcaption>
  <svg width={w} height={h} viewBox="0 0 {w} {h}">
    <!-- 纵轴（第二轴 j）标记 -->
    <text class="axis-name" x={4} y={padT + 2}>{nameJ}</text>
    {#each Array(nb) as _, j}
      <text class="tick" x={padL - 8} y={rowY(j) + cell / 2 + 4.5}>{j}</text>
    {/each}

    <!-- 横轴（第一轴 i）标记 -->
    <text class="axis-name" x={padL + na * cell + 4} y={padT + nb * cell + 20}>{nameI}</text>
    {#each Array(na) as _, i}
      <text class="tick" x={colX(i) + cell / 2} y={padT + nb * cell + 20}>{i}</text>
    {/each}

    {#each Array(na) as _, i}
      {#each Array(nb) as _, j}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <g class="cell" on:click={() => dispatch('toggle', { i, j })}>
          <rect
            x={colX(i) + 1.5}
            y={rowY(j) + 1.5}
            width={cell - 3}
            height={cell - 3}
            rx="6"
            class:filled={grid[i][j]}
          />
          <text
            x={colX(i) + cell / 2}
            y={rowY(j) + cell / 2 + 5}
            class:on={grid[i][j]}>{grid[i][j] ? 1 : 0}</text
          >
        </g>
      {/each}
    {/each}
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
  .axis-name {
    font-size: 13px;
    font-weight: 700;
    fill: #475569;
  }
  .tick {
    font-size: 12px;
    text-anchor: middle;
    fill: #64748b;
    user-select: none;
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
</style>
