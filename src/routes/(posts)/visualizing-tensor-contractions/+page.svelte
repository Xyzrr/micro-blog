<script>
	import EinsumViz from './EinsumViz.svelte';
</script>

<svelte:head>
	<title>Visualizing tensor contractions</title>
</svelte:head>
<h1>Visualizing tensor contractions</h1>
<div class="opacity-60 mb-8">June 2026</div>
<p>
	I tend to think in animations. It's served me well for most of math and physics, but when I started
	writing PyTorch code, I noticed myself struggling to visualize things.
</p>
<p>
	I realized there was one particular visualization holding me back. Since high school, I've had <a href="http://matrixmultiplication.xyz/" target="_blank">this
	visual</a> of matrix multiplication in my head, with one matrix rotating and sliding through the
	other. I gravitated towards it because it felt like it let me reuse my physical intuition for rotating
	and moving objects. I now realize this has been net harmful; it's made visualizing matmuls more mentally taxing than it needs to be, and it suggests physical metaphors that don't really
	apply.
</p>
<p>
	I now have a new animation in my head for matrix multiplication, and I thought it might be helpful
	to share it with you. It focuses not on the numbers, which you generally don't think about when
	writing ML code, and instead on the axes. In particular, it illustrates axes
	contracting away.
</p>

<EinsumViz expr="ij,jk->ik" />

<p>
	The way to read it: the shared axis <em>j</em> (the one that appears in both inputs but not the
	output) gets squeezed away. Its dots don't disappear; they compress into a little tick at each
	surviving position, turning each matrix into a vector-of-vectors. The remaining axes settle into the
	output grid, each compressed vector is copied out to the cells it feeds, and at every cell the two
	vectors that arrive line up and collapse into a single dot product, magnified on the right.
</p>

<p>
	A strength of this visualization is that it generalizes to other types of tensor contractions and maps naturally to einsum. For
	example, here's an outer product, <code>i,j-&gt;ij</code>, which takes two vectors and fans them out
	into a full grid:
</p>

<EinsumViz expr="i,j->ij" />

<p>
	This is the degenerate case where there's no shared axis to squeeze at all. Nothing gets contracted;
	each value of one vector is simply broadcast against each value of the other, so the "dot product" at
	every cell is just a product of two single numbers. (At the opposite extreme, a plain dot product is
	the case where every axis gets squeezed away.)
</p>

<p>
	Here's a playground if you want to poke at other contractions yourself. Type any einsum with two
	inputs of up to rank 3 each, or pick a preset, and click a step to jump to it:
</p>

<EinsumViz interactive expr="bij,bjk->bik" />

<h2>Attention</h2>
<p>
	Now here are some examples of the visualization applied to the attention mechanism in transformers,
	where I find it particularly illuminating.
</p>
<p>
	In a transformer, every token carries a <em>query</em> vector and a <em>key</em> vector, each of
	length <em>d</em> (the head dimension). The attention score between two tokens is the dot product of
	one token's query with another's key. Do that for every pair and you get a grid of scores, which is
	exactly a contraction over the head dimension, <code>id,jd-&gt;ij</code>:
</p>

<EinsumViz expr="id,jd->ij" labels={{ i: 'query', j: 'key', d: 'head' }} vectors="d" />

<p>
	The colored lines trace the actual query and key vectors. The head dimension <em>d</em> is the axis
	that disappears: each query vector dots against each key vector, the head dimension collapses, and
	what survives is a query-by-key grid, the attention matrix. The thing you actually care about is "a
	score for every pair of tokens," and the animation builds precisely that grid.
</p>
<p>
	In code you'd usually write this as <code>Q @ K.T</code>, a transpose and then a matmul. But thinking
	of it as two operations is misleading. The transpose exists because matmul wants the summed axis in a particular
	place, but that rule isn't really relevant here. It's more natural to think of this as one operation, just contracting an axis.
</p>
<p>
	The second half of attention uses those scores to mix the <em>value</em> vectors. Each output token
	is a weighted blend of all the value vectors, weighted by how much that query attends to each key.
	That's another contraction, this time over the key positions <em>j</em>, <code>ij,jd-&gt;id</code>:
</p>

<EinsumViz expr="ij,jd->id" labels={{ i: 'query', j: 'key', d: 'value' }} vectors="d" />

<p>
	Here the lines trace the value vectors, and the axis getting squeezed is <em>j</em>, the key
	positions. For each query you end up with a weighted average of all the value vectors, where the
	weights are that query's attention scores. The part I like is that the axis being squeezed is
	literally the set of tokens you're averaging over.
</p>
<p>
	I'm frankly not sure whether this animation is helpful for many people, it might be only for unusually animation-driven brains.
	But I find that it leads to much more correct intuitions on the ways you manipulate tensors. The rotate-and-slide matmul visual
	makes me think that matrices are things that you often want to rotate. But in fact, you almost never rotate matrices. Tranposing
	is a much more common operation, and I think transposing feels more natural in this axis-centric representation of tensors.
	I hope some other person out there also finds that this visual reduces mental load when dealing with tensors.
</p>
