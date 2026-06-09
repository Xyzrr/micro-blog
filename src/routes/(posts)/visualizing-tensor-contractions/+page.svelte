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
	reason about is <em>axes</em>: which axis is the batch, which is the channel, which two are about to
	get contracted together, and what shape falls out the other end. The grid-of-numbers picture hides
	all of that. It also quietly trains you to think "multiplication of two matrices," so the moment you
	hit a batched matmul or an attention score, your mental model has nothing to say.
</p>
<p>
	So here's a different picture, built around axes instead of numbers. The numbers are demoted to
	faint gray dots; the loud, colored, labeled things are the axes, because they're what you care
	about. Here's plain matrix multiplication, written as the einsum <code>ij,jk-&gt;ik</code>:
</p>

<EinsumViz expr="ij,jk->ik" />

<p>Every contraction, this one included, plays out as the same four steps:</p>
<ol>
	<li>
		<strong>Squeeze.</strong> The axis being contracted (the letter that appears in both inputs but not
		the output, here <em>j</em>) gets compressed away. The dots don't vanish; they pile into a little
		gray tick at each surviving position, turning a matrix into a vector-of-vectors.
	</li>
	<li>
		<strong>Arrange.</strong> The surviving axes orient themselves into the output frame: <em>i</em>
		down, <em>k</em> across.
	</li>
	<li><strong>Broadcast.</strong> Each compressed vector is copied out to every cell it feeds.</li>
	<li>
		<strong>Dot product.</strong> At each cell, the two vectors that arrived combine. The zoom on the
		right magnifies cell (0,0): the two vectors reorient to line up, multiply element-wise, and sum
		into a single number.
	</li>
</ol>
<p>
	None of this is new information about matmul. But once the operation is "contract the shared axis,"
	the cases that used to feel like separate spells become the same thing. The clearest payoff is
	attention.
</p>

<h2>Attention scores</h2>
<p>
	In a transformer, every token carries a <em>query</em> vector and a <em>key</em> vector, each of
	length <em>d</em> (the head dimension). The attention score between two tokens is the dot product
	of one token's query with another's key. Do that for every pair and you get a grid of scores: one
	number for each (query, key) combination.
</p>
<p>
	That is exactly a contraction over the head dimension, <code>id,jd-&gt;ij</code>. Watch which axis
	gets squeezed:
</p>

<EinsumViz expr="id,jd->ij" labels={{ i: 'query', j: 'key', d: 'head' }} />

<p>
	The head dimension <em>d</em> is the axis that disappears. It gets summed away, and what's left is a
	query-by-key grid: the attention matrix. This is where I find the picture most useful. The thing
	you actually care about is "a score for every pair of tokens," and the animation shows precisely
	that grid being assembled, with the head dimension collapsing into each dot product. The numbers
	never mattered; the surviving axes are the whole story.
</p>

<h2>From scores to outputs</h2>
<p>
	The second half of attention uses those scores to mix the <em>value</em> vectors. Each output token
	is a weighted blend of all the value vectors, weighted by how much that query attends to each key.
	That's another contraction, this time over the key positions <em>j</em>:
	<code>ij,jd-&gt;id</code>, scores times values.
</p>

<EinsumViz expr="ij,jd->id" labels={{ i: 'query', j: 'key', d: 'value' }} />

<p>
	Now the contracted axis is <em>j</em>, the key positions. For each query <em>i</em> and each value
	dimension <em>d</em>, you take that query's row of scores and dot it against that dimension's column
	of values, a weighted sum over every token. Out comes one fresh vector per query. The squeezed axis
	is the set of tokens you're summing over, which is exactly the right intuition: attention is a
	weighted average across the sequence.
</p>
<p>
	Two contractions, back to back, and that's the whole attention block. Once you see the shared axis
	get squeezed and the surviving axes snap into the output frame, batched matmuls, attention, and
	whatever else stop being separate tricks. They're all the same move: find the shared axis, and
	contract it away.
</p>
