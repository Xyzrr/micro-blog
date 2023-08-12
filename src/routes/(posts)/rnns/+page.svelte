<h1>Why RNNs work</h1>
<div class="opacity-60 mb-8">January 2023</div>
<p>Most people, even the <a href="http://karpathy.github.io/2015/05/21/rnn-effectiveness/">best</a>, say recurrent neural nets (RNNs) exist because feedforward neural nets (FNNs) are constrained to fixed-size I/O, making them unable to handle sequences. However, this explanation is misleading. FNNs can handle sequences via the sliding window algorithm: take the N most recent tokens as input, output the next token. That is in fact exactly what Transformers do, though they’re seldom described that way.</p>
<p>So if FNNs handle sequences just fine, why were RNNs invented? The reason is simply that before Transformers, RNNs handled sequences much better any FNN we had. The intuition lies in how awkwardly formed existing FNNs were for the job.</p>
<p>Consider how you would hand-write an autocompleter function that finishes your sentence. No matter what approach you take, it probably involves starting with a for loop that iterates over every token in the input, building up some state as it iterates. At each token, maybe you’d check whether it’s a noun/verb/etc, and route your logic from there.</p>
<p>You certainly wouldn’t first route your logic based on i, the index of the current token. While a token’s location inside the sentence matters, it isn’t the principal axis from which you’d decide how to handle the token. Yet when you use the sliding window algorithm with an MLP, you’re essentially forcing i to be the routing key. Each token enters a different entry point, with a different set of weights, based solely on i .</p>
<p>With an RNN, every token is given the same entry point, with the same set of weights. This allows the RNN to “reuse code” however it wants.</p>
<p>More specifically, an RNN’s job is this: given the latest token and a note you’ve written to yourself about the previous tokens you’ve seen, output the next token, and write a note to your future self to help with future tokens.</p>
<p>You can see how this enables the RNN to handle tokens in a sentence more naturally than MLPs can. The RNN can say, “I just received a noun, and my notes say I last received an adjective, so the adjective is probably describing the noun, so let me modify my note about the noun for future reference”. No matter what the index is inside the sentence, the RNN can reuse its “adjective followed by noun” codepath. The MLP would have to bend over backwards to accomplish the same thing.</p>
<h2 id="better-note-taking-with-lstms-and-grus-">Better note-taking with LSTMs and GRUs</h2>
<p>It turns out that vanilla RNNs are ill-equipped to write lasting notes to itself. They tend to forget what they read a few tokens ago, making it impossible to handle sequences with long-term dependencies. The standard explanation is “exploding/vanishing gradients”: the note keeps getting multiplied by the same weights, so adjusting an early note has either zero or massive downstream effects on later notes and outputs. We can assuage this problem by giving the RNN more controls. We can make it optional to multiply its notes by its weights, and also allow it to do addition if it wants. These tools make gradients more stable.</p>
<p>The actual way these abilities are enabled is rather involved in practice. This <a href="https://colah.github.io/posts/2015-08-Understanding-LSTMs/">blog post</a> explores how it’s done in LSTMs. But note that the specifics don’t actually matter much. Unlike Transformers, you can modify the LSTM’s internals quite a bit and get similar results. The same blog post discusses GRUs, a popular simplification of the LSTM that sometimes works better.</p>
<h2 id="sequence-to-sequence">Sequence to sequence</h2>
<p>A single RNN <em>can</em> do language translation. You’d have a special input token that means “now translate everything you’ve seen to Chinese”, and when the model sees that in its notes, it’ll remember to switch to Chinese mode. But this probably doesn’t work very well, given that no one’s ever published a paper on it.</p>
<p>It feels a little wasteful to use the same set of weights for processing the English and for writing the Chinese. Your model would be twice as big and only use half its abilities at any moment. So what you can do is have two different RNNs, an encoder for comprehending the input, and decoder for synthesizing the output. When the encoder finishes reading the input, it simply hands its note off to the decoder.</p>
<p>This has the added benefit of modularity; you can to swap out the decoder while reusing the encoder to translate to a different language, and vice versa.</p>
<p>The approach I described is studied <a href="https://arxiv.org/pdf/1406.1078.pdf">here</a> and illustrated <a href="https://lena-voita.github.io/nlp_course/seq2seq_and_attention.html">here</a>. However, the paper most associated with “seq2seq” is <a href="https://arxiv.org/pdf/1409.3215.pdf">this one</a>, whose most interesting discovery is that it helps a lot to reverse the input.</p>