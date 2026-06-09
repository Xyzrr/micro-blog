<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { buildModel, sample, VIEW, MAG } from './einsum';

	export let expr = 'ij,jk->ik';
	export let labels: Record<string, string> = {};
	export let vectors = '';

	const DURATION = 15000; // ms for a full play-through

	let progress = 0;
	let playing = false;
	let userPaused = false;
	let raf = 0;
	let last: number | null = null;
	let container: HTMLDivElement;

	$: model = buildModel(expr);
	$: scene = sample(model, progress, labels, vectors);
	$: uid = expr.replace(/[^a-z0-9]/gi, '_');

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
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						if (!userPaused && progress < 1) {
							playing = true;
							last = null;
						}
					} else {
						playing = false;
					}
				}
			},
			{ threshold: 0.35 }
		);
		if (container) io.observe(container);
		return () => io.disconnect();
	});
	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
	});

	function play() {
		userPaused = false;
		if (progress >= 1) progress = 0;
		playing = true;
		last = null;
	}
	function pause() {
		userPaused = true;
		playing = false;
	}
	function restart() {
		userPaused = false;
		progress = 0;
		playing = true;
		last = null;
	}
	function scrub(e: Event) {
		playing = false;
		userPaused = true;
		progress = +(e.target as HTMLInputElement).value;
	}
</script>

<div class="viz" bind:this={container}>
	<div class="stage">
		<svg
			class="main"
			viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
			preserveAspectRatio="xMidYMid meet"
			role="img"
			aria-label={`einsum ${expr}`}
		>
			<defs>
				{#each [...model.colors] as [letter, color]}
					<marker
						id={`arrow-${uid}-${letter}`}
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
					marker-end={`url(#arrow-${uid}-${ax.letter})`}
				/>
				<text
					x={ax.lx}
					y={ax.ly}
					fill={ax.color}
					opacity={ax.opacity}
					font-size={ax.label.length > 2 ? 11 : 13}
					font-style="italic"
					text-anchor="middle"
					dominant-baseline="middle">{ax.label}</text
				>
			{/each}

			{#each scene.vectorLines as v (v.key)}
				<line
					x1={v.x1}
					y1={v.y1}
					x2={v.x2}
					y2={v.y2}
					stroke={v.color}
					stroke-width="6"
					stroke-linecap="round"
					opacity={v.opacity}
				/>
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
			<defs>
				<clipPath id={`lens-${uid}`}>
					<circle cx={MAG.w / 2} cy="95" r="72" />
				</clipPath>
			</defs>
			{#if scene.mag.active}
				<circle cx={MAG.w / 2} cy="95" r="72" fill="rgb(247, 247, 248)" />
				<g clip-path={`url(#lens-${uid})`}>
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
				</g>
				<circle
					cx={MAG.w / 2}
					cy="95"
					r="72"
					fill="none"
					stroke="#403e43"
					stroke-width="1.5"
					opacity="0.5"
				/>
				<text
					x={MAG.w / 2}
					y="188"
					fill="#403e43"
					font-size="12"
					font-style="italic"
					text-anchor="middle">{scene.mag.label}</text
				>
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
				><path d="M12 5V2L7 7l5 5V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z" /></svg
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
		padding: 14px 0;
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
		flex: 0 0 140px;
		width: 140px;
		height: 280px;
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
			flex: 0 0 170px;
			width: 100%;
			height: 170px;
		}
		.main {
			height: 240px;
		}
	}
</style>
