<script>
	import EinsumViz from './EinsumViz.svelte';
</script>

<svelte:head>
	<title>Visualizing tensor contractions</title>
</svelte:head>
<h1>Visualizing tensor contractions</h1>
<div class="opacity-60 mb-8">June 2026</div>
<p>
	They say that at some point in your mathematical maturity, you need to stop relying entirely on visualizations and start thinking symbolically.
	I never figured out how to do that, so here we are.
</p>
<p>
	Thinking in animations became a real liability when I started writing PyTorch code. I probably should have tried harder to switch to symbols,
	but ML code sits right at the edge of visualizability: the tensors are low-rank enough that you <em>could</em> picture everything with enough effort.
</p>
<p>
	So instead I thought about how I could improve my visuals, and I realized that one particular animation ingrained deep in my brain was holding me back. 
	Since high school, I've had <a href="http://matrixmultiplication.xyz/" target="_blank">this
	visual</a> of matrix multiplication in my head, with one matrix rotating and sliding through the
	other. I gravitated towards it because it felt like it let me reuse my physical intuition for rotating
	and moving objects. I now realize this has been net harmful; it's made visualizing matmuls more mentally taxing than it needs to be, and it suggests physical metaphors that don't really
	apply.
</p>
<p>
	I now have a new animation in my head for matrix multiplication, and I thought it might be helpful
	to share it with you. It focuses not on the numbers, which you generally don't think about when
	writing ML code, but instead on the axes. In particular, it illustrates axes
	contracting away.
</p>

<EinsumViz expr="ij,jk->ik" />

<p>
	The one non-obvious move: when the shared axis <em>j</em> (the one that appears in both inputs but
	not the output) gets squeezed away, its dots don't disappear — they compress into a little pile at
	each surviving position. Those piles then meet in the output grid, where each pair lines up and
	collapses into a dot product, magnified on the right.
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
	inputs of up to rank 3 each, or pick a preset.
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
	This is also the heart of my complaint with the rotate-and-slide visual: it puts rotating at the
	center of the story, and physically rotating an array is not something you ever do to a tensor.
	Transposing is — and in the axis-centric picture, a transpose stops being a motion at all.
	<code>id</code> versus <code>di</code> is just a relabeling of which axis is which; nothing has to
	move.
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
	I'm frankly not sure whether this animation is helpful for many people; it might be only for
	unusually animation-driven brains. But it has given me noticeably more correct instincts for
	manipulating tensors, and I hope some other person out there finds that it reduces their mental
	load too.
</p>
