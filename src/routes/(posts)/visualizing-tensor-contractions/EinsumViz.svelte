<script lang="ts">
	import { onMount } from 'svelte';
	import { parseEinsum, type EinsumSpec } from './einsum';
	import { buildScene, sampleTrack, letterColors, type El, type Scene } from './timeline';

	export let initial = 'ij,jk->ik';

	const PRESETS = [
		{ label: 'matrix × matrix', src: 'ij,jk->ik' },
		{ label: 'matrix × vector', src: 'ij,j->i' },
		{ label: 'dot product', src: 'i,i->' },
		{ label: 'outer product', src: 'i,j->ij' },
		{ label: 'elementwise product', src: 'i,i->i' },
		{ label: 'batched matmul', src: 'bij,bjk->bik' },
		{ label: 'matmul, B transposed', src: 'ij,kj->ik' },
		{ label: 'sum of all products', src: 'ij,ij->' }
	];

	let src = initial;
	let error = '';
	let spec: EinsumSpec = parseEinsum(initial);
	let scene: Scene = buildScene(spec);
	let time = 0;
	let playing = false;

	$: cols = letterColors(spec);
	$: phase =
		scene.phases.find((p) => time >= p.t0 && time < p.t1) ??
		scene.phases[scene.phases.length - 1];

	// time is passed explicitly so Svelte sees the template's dependency on it
	function g(el: El, ch: string, t: number): number {
		const tr = el.tracks[ch];
		return tr && tr.length ? sampleTrack(tr, t) : 0;
	}

	function apply(s: string) {
		try {
			spec = parseEinsum(s);
			scene = buildScene(spec);
			src = s;
			error = '';
			time = 0;
			playing = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	function onInput(e: Event) {
		src = (e.currentTarget as HTMLInputElement).value;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') apply(src);
	}

	function onPreset(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		if (v) apply(v);
		(e.currentTarget as HTMLSelectElement).value = '';
	}

	function onScrub(e: Event) {
		time = +(e.currentTarget as HTMLInputElement).value;
		playing = false;
	}

	function togglePlay() {
		if (!playing && time >= scene.duration - 0.01) time = 0;
		playing = !playing;
	}

	function jumpTo(t0: number) {
		time = t0 + 0.001;
		playing = true;
	}

	onMount(() => {
		let raf = 0;
		let lastTs = 0;
		const tick = (ts: number) => {
			if (playing) {
				if (lastTs) time = Math.min(time + Math.min(0.05, (ts - lastTs) / 1000), scene.duration);
				if (time >= scene.duration) playing = false;
			}
			lastTs = ts;
			raf = requestAnimationFrame(tick);
		};
		playing = true;
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="my-6 rounded-lg border border-[#dcdce0] bg-white p-3 sm:p-4">
	<div class="flex flex-wrap items-center gap-2 text-sm">
		<input
			class="w-32 rounded border border-[#c9c9ce] bg-[#fafafa] px-2 py-1 font-mono text-[14px] focus:outline-none focus:border-[#8a8a92]"
			value={src}
			spellcheck="false"
			on:input={onInput}
			on:keydown={onKeydown}
		/>
		<button
			class="rounded border border-[#c9c9ce] px-2 py-1 hover:bg-[#f1f1f3]"
			on:click={() => apply(src)}>go</button
		>
		<select
			class="rounded border border-[#c9c9ce] bg-white px-1 py-1 text-sm"
			on:change={onPreset}
		>
			<option value="">presets…</option>
			{#each PRESETS as p}
				<option value={p.src}>{p.label} — {p.src}</option>
			{/each}
		</select>
		<button
			class="ml-auto rounded border border-[#c9c9ce] px-2 py-1 hover:bg-[#f1f1f3]"
			on:click={togglePlay}>{playing ? 'pause' : time >= scene.duration - 0.01 ? 'replay' : 'play'}</button
		>
	</div>
	{#if error}
		<div class="mt-1 text-sm text-[#b4452e]">{error}</div>
	{/if}

	<div class="mt-2 text-center font-mono text-[16px] tracking-wide">
		{#each spec.inputs[0] as L}<span style="color:{cols[L]}">{L}</span>{/each}<span
			class="opacity-40">,</span
		>{#each spec.inputs[1] as L}<span style="color:{cols[L]}">{L}</span>{/each}<span
			class="opacity-40"
		>
			→
		</span>{#each spec.output as L}<span style="color:{cols[L]}">{L}</span>{/each}{#if !spec.output.length}<span
			class="text-sm italic opacity-40">scalar</span
		>{/if}
	</div>

	<svg viewBox="0 0 690 340" class="w-full select-none">
		{#each scene.els as el}
			{#if el.kind === 'dot'}
				<circle cx={g(el, 'x', time)} cy={g(el, 'y', time)} r={g(el, 'r', time)} fill={el.color} opacity={g(el, 'o', time)} />
			{:else if el.kind === 'line'}
				<line
					x1={g(el, 'x1', time)}
					y1={g(el, 'y1', time)}
					x2={g(el, 'x2', time)}
					y2={g(el, 'y2', time)}
					stroke={el.color}
					stroke-width={el.w ?? 2.5}
					stroke-linecap="round"
					stroke-dasharray={el.dash ?? 'none'}
					opacity={g(el, 'o', time)}
				/>
			{:else if el.kind === 'label'}
				<text
					x={g(el, 'x', time)}
					y={g(el, 'y', time)}
					fill={el.color}
					font-size={el.fs ?? 13}
					font-weight="600"
					text-anchor="middle"
					dominant-baseline="middle"
					opacity={g(el, 'o', time)}>{el.text}</text
				>
			{:else if el.kind === 'rect'}
				<rect
					x={el.x}
					y={el.y}
					width={el.wd}
					height={el.ht}
					rx={el.rx ?? 6}
					fill={el.fill ?? 'none'}
					stroke={el.color}
					opacity={g(el, 'o', time)}
				/>
			{/if}
		{/each}
	</svg>

	<input
		type="range"
		min="0"
		max={scene.duration}
		step="0.01"
		value={time}
		on:input={onScrub}
		class="w-full accent-[#6b7280]"
	/>
	<div class="mt-1 flex flex-wrap items-center gap-1">
		{#each scene.phases as p}
			<button
				class="rounded px-2 py-0.5 text-xs {p === phase
					? 'bg-[#403e43] text-white'
					: 'bg-[#eeeef0] text-[#646267] hover:bg-[#e2e2e6]'}"
				on:click={() => jumpTo(p.t0)}>{p.label}</button
			>
		{/each}
	</div>
	<div class="mt-2 min-h-[40px] text-sm opacity-70">{phase.desc}</div>
</div>
