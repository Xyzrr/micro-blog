<script>
	import EinsumViz from './EinsumViz.svelte';
</script>

<svelte:head>
	<title>Visualizing tensor contractions</title>
</svelte:head>
<h1>Visualizing tensor contractions</h1>
<div class="opacity-60 mb-8">June 2026</div>
<p>
	<a target="_blank" href="http://matrixmultiplication.xyz/">This visualization</a> is how I've always
	visualized matrix multiplication. I only recently realized how harmful it is when writing ML code.
</p>
<!-- TODO: explain why the standard visualization breaks down for ML code -->
<h2>A better visualization</h2>
<p>
	Here's how I visualize tensor contractions now. It takes an einsum (two inputs, up to rank 3) and
	plays the contraction out:
</p>
<EinsumViz />
<aside class="context">
	<p>
		Try the presets, or type your own einsum. You can scrub the timeline or click a step to jump to
		it. Diagonals (repeated indices within one tensor, like <code>ii</code>) aren't supported, and
		everything is capped at rank 3 — we only have so many dimensions to draw with.
	</p>
</aside>
<!-- TODO: walk through what each step means, and why axes-first beats numbers-first -->
