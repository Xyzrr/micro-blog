<script>
	import EinsumViz from './EinsumViz.svelte';
</script>

<svelte:head>
	<title>Visualizing tensor contractions</title>
</svelte:head>
<h1>Visualizing tensor contractions</h1>
<div class="opacity-60 mb-8">June 2026</div>
<p>
	There's a <a href="http://matrixmultiplication.xyz/" target="_blank">lovely little site</a> that animates
	matrix multiplication: two grids of numbers slide past each other, rows sweep across columns, and the
	products drop neatly into place. This is how I've always visualized matrix multiplication.
</p>
<p>
	I only recently realized how harmful this picture is when writing ML code. It puts the numbers
	front and center, when the numbers are exactly the part you never think about. What you actually
	reason about when wiring up a model is <em>axes</em>: which axis is the batch, which axis is the
	channel, which two axes are about to get contracted together, and what shape falls out the other
	end. The grid-of-numbers picture hides all of that. It also quietly trains you to think
	"multiplication of two matrices," so the moment you hit a batched matmul, an attention score, or
	anything rank-3, your mental model has nothing to say.
</p>
<p>
	The operation that actually matters is the <em>tensor contraction</em>, and the cleanest way to
	talk about contractions is einsum notation. So I want a visualization built around axes instead of
	numbers. Here's my attempt. Pick an einsum and watch:
</p>

<EinsumViz />

<p>
	The numbers are demoted to faint gray dots. The loud, colored, labeled things are the axes,
	because they're what you care about. Every example, from a plain matmul to a batched rank-3
	contraction, plays out as the same four steps:
</p>
<ol>
	<li>
		<strong>Squeeze.</strong> The axis being contracted (the letter that appears in both inputs but not
		the output) gets literally compressed. The dots don't disappear; they pile up into a little gray
		tick at each surviving position, so a matrix turns into a vector-of-vectors.
	</li>
	<li>
		<strong>Arrange.</strong> The axes that survive get oriented the way the output spec asks for. For
		<code>ij,jk-&gt;ik</code>, the <em>i</em> axis and the <em>k</em> axis line up into the final grid.
	</li>
	<li>
		<strong>Broadcast.</strong> Each compressed vector is copied out to every cell it needs to land in.
	</li>
	<li>
		<strong>Dot product.</strong> At each output cell, the two vectors that arrived combine. The
		panel on the side magnifies a single cell: the two vectors align, multiply element-wise, and
		sum into one number.
	</li>
</ol>
<p>
	Once you see contraction this way, the awkward cases stop being special. A batched matmul is just a
	matmul with an axis that rides along untouched. An outer product is the degenerate case where
	nothing gets contracted at all. A dot product is the case where everything does.
</p>
