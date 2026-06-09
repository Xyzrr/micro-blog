<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { buildModel, sample, PRESETS, VIEW, MAG } from './einsum';

	const DURATION = 15000; // ms for a full play-through

	let presetIdx = 0;
	let progress = 0;
	let playing = true;
	let raf = 0;
	let last: number | null = null;

	$: model = buildModel(PRESETS[presetIdx].expr);
	$: scene = sample(model, progress);

	function frame(t: number) {
		if (last === null) last = t;
		const dt = t - last;
		last = t;
		if (playing) {
			progress += dt / DURATION;
			if (progress >= 1) {
				progress = 1;
				playing = false;
			}
		}
		raf = requestAnimationFrame(frame);
	}

	onMount(() => {
		raf = requestAnimationFrame(frame);
	});
	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
	});

	function play() {
		if (progress >= 1) progress = 0;
		playing = true;
		last = null;
	}
	function pause() {
		playing = false;
	}
	function restart() {
		progress = 0;
		playing = true;
		last = null;
	}
	function selectPreset(i: number) {
		presetIdx = i;
		progress = 0;
		playing = true;
		last = null;
	}
	function scrub(e: Event) {
		playing = false;
		progress = +(e.target as HTMLInputElement).value;
	}
</script>

<div class="viz">
	<div class="presets">
		{#each PRESETS as p, i}
			<button
				class="preset"
				class:active={i === presetIdx}
				on:click={() => selectPreset(i)}
				title={p.expr}>{p.label}</button
			>
		{/each}
	</div>

	<div class="stage">
		<svg
			class="main"
			viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
			preserveAspectRatio="xMidYMid meet"
			role="img"
			aria-label={`einsum ${model.raw}`}
		>
			<defs>
				{#each [...model.colors] as [letter, color]}
					<marker
						id={`arrow-${letter}`}
						markerWidth="6"
						markerHeight="6"
						refX="4"
						refY="3"
						orient="auto"
					>
						<path d="M0,0 L6,3 L0,6 Z" fill={color} />
					</marker>
				{/each}
			</defs>

			{#each scene.axes as ax (ax.key)}
				<line
					x1={ax.x1}
					y1={ax.y1}
					x2={ax.x2}
					y2={ax.y2}
					stroke={ax.color}
					stroke-width="2"
					stroke-linecap="round"
					opacity={ax.opacity}
					marker-end={`url(#arrow-${ax.label})`}
				/>
				<text
					x={ax.lx}
					y={ax.ly}
					fill={ax.color}
					opacity={ax.opacity}
					font-size="13"
					font-style="italic"
					text-anchor="middle"
					dominant-baseline="middle">{ax.label}</text
				>
			{/each}

			{#if scene.highlight}
				<circle
					cx={scene.highlight.x}
					cy={scene.highlight.y}
					r={scene.highlight.r}
					fill="none"
					stroke="#403e43"
					stroke-width="1.5"
					opacity={scene.highlight.opacity}
				/>
			{/if}

			{#each scene.dots as d (d.key)}
				<circle cx={d.x} cy={d.y} r={d.r} fill={d.fill} opacity={d.opacity} />
			{/each}
		</svg>

		<svg
			class="mag"
			viewBox={`0 0 ${MAG.w} ${MAG.h}`}
			preserveAspectRatio="xMidYMid meet"
			role="img"
			aria-label="dot product detail"
		>
			{#if scene.mag.active}
				<text x={MAG.w / 2} y="20" fill="#86848a" font-size="10" text-anchor="middle"
					>zoom: output cell</text
				>
				<text
					x={MAG.w / 2}
					y="38"
					fill="#403e43"
					font-size="13"
					font-style="italic"
					text-anchor="middle">{scene.mag.label}</text
				>
				{#each scene.mag.aDots as d (d.key)}
					<circle cx={d.x} cy={d.y} r={d.r} fill={d.fill} opacity={d.opacity} />
				{/each}
				{#each scene.mag.bDots as d (d.key)}
					<circle cx={d.x} cy={d.y} r={d.r} fill={d.fill} opacity={d.opacity} />
				{/each}
				{#each scene.mag.prodDots as d (d.key)}
					<circle cx={d.x} cy={d.y} r={d.r} fill={d.fill} opacity={d.opacity} />
				{/each}
				{#if scene.mag.sumDot}
					<circle
						cx={scene.mag.sumDot.x}
						cy={scene.mag.sumDot.y}
						r={scene.mag.sumDot.r}
						fill={scene.mag.sumDot.fill}
						opacity={scene.mag.sumDot.opacity}
					/>
				{/if}
			{/if}
		</svg>
	</div>

	<div class="caption">{scene.caption}</div>

	<div class="controls">
		{#if playing}
			<button class="ctrl" on:click={pause} aria-label="Pause">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"
					><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg
				>
			</button>
		{:else}
			<button class="ctrl" on:click={play} aria-label="Play">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"
					><path d="M7 5v14l12-7z" /></svg
				>
			</button>
		{/if}
		<button class="ctrl" on:click={restart} aria-label="Restart">
			<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"
				><path
					d="M12 5V2L7 7l5 5V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"
				/></svg
			>
		</button>
		<input
			class="scrub"
			type="range"
			min="0"
			max="1"
			step="0.001"
			value={progress}
			on:input={scrub}
			aria-label="Timeline"
		/>
	</div>
</div>

<style>
	.viz {
		margin: 24px 0;
		padding: 14px;
		background: rgb(238, 238, 240);
		border-radius: 8px;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}
	.preset {
		font-size: 12px;
		padding: 3px 9px;
		border-radius: 999px;
		border: 1px solid rgb(210, 208, 213);
		background: rgb(248, 248, 249);
		color: rgb(100, 98, 103);
		cursor: pointer;
		transition: all 0.15s;
	}
	.preset:hover {
		border-color: rgb(150, 148, 153);
	}
	.preset.active {
		background: rgb(64, 62, 67);
		border-color: rgb(64, 62, 67);
		color: rgb(246, 246, 247);
	}
	.stage {
		display: flex;
		align-items: stretch;
		gap: 8px;
	}
	.main {
		flex: 1 1 auto;
		min-width: 0;
		height: 280px;
	}
	.mag {
		flex: 0 0 130px;
		width: 130px;
		height: 280px;
		border-left: 1px solid rgb(220, 218, 223);
	}
	.caption {
		margin-top: 8px;
		font-size: 13px;
		color: rgb(100, 98, 103);
		min-height: 20px;
		text-align: center;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
	}
	.ctrl {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 999px;
		border: 1px solid rgb(210, 208, 213);
		background: rgb(248, 248, 249);
		color: rgb(80, 78, 83);
		cursor: pointer;
	}
	.ctrl:hover {
		border-color: rgb(150, 148, 153);
	}
	.scrub {
		flex: 1;
		accent-color: rgb(99, 102, 241);
	}
	@media (max-width: 520px) {
		.stage {
			flex-direction: column;
		}
		.mag {
			flex: 0 0 150px;
			width: 100%;
			height: 150px;
			border-left: none;
			border-top: 1px solid rgb(220, 218, 223);
		}
		.main {
			height: 240px;
		}
	}
</style>
