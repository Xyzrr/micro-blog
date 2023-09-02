<svelte:head>
	<title>Why RNNs work</title>
</svelte:head>
<h1>Why RNNs work</h1>
<div class="opacity-60 mb-8">January 2023</div>
<p>
	RNN = <a href="https://en.wikipedia.org/wiki/Recurrent_neural_network">Recurrent neural net</a>
</p>
<p>
	FNN = <a href="https://en.wikipedia.org/wiki/Feedforward_neural_network">Feedforward neural net</a
	>
</p>
<p />
<p>
	Most RNN explainers, even the <a href="http://karpathy.github.io/2015/05/21/rnn-effectiveness/"
		>best</a
	>, state that RNNs exist because FNNs are constrained to fixed-size I/O, making them unable to
	handle sequences. However, this explanation is misleading. FNNs can handle sequences via the
	sliding window algorithm: take the N most recent tokens as input, output the next token. That is
	in fact exactly what Transformers do, though for some reason they’re seldom described that way.
</p>
<p>
	So if FNNs handle sequences just fine, why were RNNs invented? The reason is simply that before
	Transformers, RNNs handled sequences much better any FNN we had. I believe the intuition lies in
	how awkwardly formed existing FNNs were for the job.
</p>
<p>
	Consider how you would hand-write a function that suggests the next token of your sentence. No
	matter what approach you take, it'd probably look something like this:
</p>
<pre><code
		>state = initial_state
for token in sentence:
	state = process_token(state, token)
return generate_next_token(state)</code
	></pre>
<p>
	Inside <code>process_token</code>, you may handle the token differently based on whether it's a
	noun/verb/etc. <code>state</code> can contain arbitrary notes about what you've already seen.
</p>
<p>Your code certainly wouldn't look like this:</p>
<pre><code
		>intermediate_0 = process_index_0(sentence[0])
intermediate_1 = process_index_1(sentence[1])
intermediate_2 = process_index_2(sentence[2])
...
		
return generate_next_token(intermediate_0, intermediate_1, ...)</code
	></pre>
<p>
	This code is senseless; why would you have a different handler for each index of the sentence? Yet
	when you use the sliding window algorithm with an MLP, that's essentially what you're doing. Each
	token enters a different entry point, with a different set of weights, based solely on its
	location in the sentence.
</p>
<p>
	With an RNN, every token is given the same entry point, with the same set of weights. It's much
	more like the first function we wrote. This allows the RNN to “reuse code” however it wants.
</p>
<h2 id="better-note-taking-with-lstms-and-grus-">Better note-taking with LSTMs and GRUs</h2>
<p>
	I like to think of an RNN's job like this: given the latest token and a note you’ve written to
	yourself about the previous tokens you’ve seen, output the next token, and write a note to your
	future self to help with future tokens.
</p>
<p>
	It turns out that vanilla RNNs are ill-equipped to write lasting notes to itself. They tend to
	forget what they read a few tokens ago, making it impossible to handle sequences with long-term
	dependencies. The standard explanation is “exploding/vanishing gradients”: the note keeps getting
	multiplied by the same weights, so adjusting an early note has either zero or massive downstream
	effects on later notes and outputs. We can assuage this problem by giving the RNN more controls.
	We can make it optional to multiply its notes by its weights, and also allow it to do addition if
	it wants. These tools make gradients more stable.
</p>
<p>
	The actual way these abilities are enabled is rather involved in practice. This <a
		href="https://colah.github.io/posts/2015-08-Understanding-LSTMs/">blog post</a
	> explores how it’s done in LSTMs. But note that the specifics don’t actually matter much. Unlike Transformers,
	you can modify the LSTM’s internals quite a bit and get similar results. The same blog post discusses
	GRUs, a popular simplification of the LSTM that sometimes works better.
</p>
<h2 id="sequence-to-sequence">Sequence to sequence</h2>
<p>
	You can technically frame a sequence-to-sequence problem, like language translation, as a
	continue-the-sequence problem and solve it the same way as anything else. You could have a special
	input token that means “from here on out should be the Chinese translation", and when the model
	sees that mentioned in its notes, it’ll remember to switch to Chinese mode. But this probably
	doesn’t work very well with RNNs, given that no one’s ever published a paper on it.
</p>
<p>
	Some intuition on why that might be: it feels a little wasteful to use the same set of weights for
	processing the English and for writing the Chinese. Your model would be twice as big and only use
	half its abilities at any moment. So what you can do is have two different RNNs, an encoder for
	comprehending the input, and decoder for synthesizing the output. When the encoder finishes
	reading the input, it simply hands its note off to the decoder.
</p>
<p>
	This has the added benefit of modularity; you can to swap out the decoder while reusing the
	encoder to translate to a different language, and vice versa.
</p>
<p>
	The approach I described is studied <a href="https://arxiv.org/pdf/1406.1078.pdf">here</a> and
	illustrated <a href="https://lena-voita.github.io/nlp_course/seq2seq_and_attention.html">here</a>.
	However, the paper most associated with “seq2seq” is
	<a href="https://arxiv.org/pdf/1409.3215.pdf">this one</a>, whose most interesting discovery is
	that it helps a lot to reverse the input.
</p>
<p>
	Interestingly, with Transformers, it becomes practical to discard the encoder-decoder separation
	and treat everything, including translation, as a continue-the-sequence problem, with one giant
	model understanding all languages.
</p>
