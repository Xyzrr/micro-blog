<svelte:head>
	<title>Why we folded Matrices</title>
</svelte:head>
<h1>Why we folded Matrices</h1>
<div class="opacity-60 mb-8">February 2026</div>
<p>
	We had seven figures in revenue from the top two AI labs, smooth inroads into the next three, and
	clear signals of more demand, but we decided to wind the operation down. Since many people are
	starting RL env startups now, I wanted to share our rationale.
</p>
<aside class="context">
	<p>
		Some context: the first year of Matrices, we were building something completely different—a
		spreadsheet product. Then we pivoted into RL environments for computer use. So what I'm
		describing here is our second year, and our second major direction.
	</p>
	<p>
		Our product was a suite of training environments to help labs train their models to use
		software, both by clicking/typing like humans, and also via API. It involved creating realistic
		simulations of popular websites like Google Calendar and Slack, creating tasks for AI agents to
		solve on those simulations, and building infra to run+monitor agents solving those tasks to
		ensure they fail for the right reasons. Here are a <a
			target="_blank"
			href="https://www.theinformation.com/articles/ai-agenda-startups-hoping-unseat-scale-ai"
			>couple</a
		>
		<a
			target="_blank"
			href="https://www.nytimes.com/2025/12/02/technology/artificial-intelligence-amazon-gmail.html"
			>articles</a
		>
		about it. And here's a low quality
		<a target="_blank" href="https://www.loom.com/share/9051d397217d4dccb29701fa55e2ff63">video</a> for
		some visuals of our product. At the end, we had 10 engineers building sims, and ~40 data annotators
		creating tasks.
	</p>
</aside>
<p>
	The main reason is that we think the market is small and temporary. But there's also a story here
	about how we approached the problem wrong from the start, which might be useful for others in the
	space.
</p>
<h2>Why the market is small</h2>
<p>
	Investors told us from the beginning that computer use didn't seem very deep. Software is designed
	to be easy to use, clicking and typing isn't that hard. And I think they were more correct than we
	gave them credit for.
</p>
<p>
	We thought we had the right response. Sure, the individual actions are simple, but you can make
	the tasks arbitrarily hard. "Do my taxes" is a hard problem; it involves using many different
	pieces of software, emailing people to chase down missing information, and looking up the current
	tax law. We figured that if you want 99.999% reliability on tasks like this, you need the
	environments to closely resemble how it's done in practice, simulating everything end-to-end.
</p>
<p>
	We no longer believe this. We're now pretty sure you can just train the specialized skills like
	taxes in isolation via text/code environments, and trust that at inference time the models can
	combine those skills with general computer use skills they learned separately. That's far easier
	than creating end-to-end computer use environments.
</p>
<p>
	I went into this space thinking cross-domain generalization was mostly a myth. Several researchers
	I spoke to said that knowledge transfer is so limited, they're skeptical that training on a CRM
	would transfer learnings even to another CRM. But over twelve months, the vibe shifted to "models
	are getting shockingly good at generalization".
</p>
<p>
	Maybe I was just talking to the wrong people at first. Which points to another problem we had: our
	understanding of the domain was largely bottlenecked by how many friends I could make at the labs
	that were willing to share useful insights. I tried my hand at this networking, but it felt wrong
	because I had little to offer the researchers in return; the asymmetric neediness wasn't a good
	foundation for friendship. I think I did more here than most others in the space, but we still had
	only sparse information on important questions like "how well does generalization actually work?",
	forcing us to make big bets on thin information.
</p>
<p>
	There's also another issue I believe makes the market even smaller: complex UIs are going away.
	Figma, Retool, Airtable—I think these elaborate editor interfaces are on their way out. Humans
	will create complex artifacts almost entirely via conversational AI software, and besides the
	chatbot the GUIs will be mostly read-only, to show the user the current state of their artifact.
	The only complex interfaces left will be video games, which is a very different market.
</p>
<p>I know that's controversial. I'll write about it separately.</p>
<p>
	But if I'm right, I believe the total addressable market for computer use environments is only a
	few hundred million dollars, maybe a couple billion. That isn't enough for the type of company we
	wanted to build.
</p>
<h2>How we got the problem wrong</h2>
<p>This part might be useful if you're in the space and I haven't scared you off.</p>
<p>
	We got started because a lab told us they needed sandboxed versions of real websites. So we framed
	the problem as, "how do we simulate the internet with as much fidelity as possible?".
</p>
<p>This was the completely wrong framing.</p>
<p>When you think about it as a simulation problem, you get questions that nobody can answer:</p>
<ul>
	<li>
		Should we build from scratch, or just use open source repos? Or beg actual companies like
		Salesforce to give us their dev sandboxes?
	</li>
	<li>How visually similar to the real sites do our sims need to be?</li>
	<li>Do we need to get all the edge cases and failure modes right?</li>
	<li>Should our infra support datasets larger than can fit in memory?</li>
	<li>
		If API requests and GUI requests are made on the same site concurrently, does the site need to
		behave like the real one would?
	</li>
	<li>
		How should cross-site interactions work—is it important that if you book a flight in Expedia you
		receive an email about it in Gmail?
	</li>
	<li>Do network requests need to look realistic?</li>
</ul>
<p>
	We'd ask researchers these questions and they'd shrug; "we don't know till we try". But this is a
	real problem, because each of these questions could steer us in totally different directions.
	Answers to these questions could multiply our delivery timelines by 10-100x, and require hiring
	entirely different personas of engineers and task creators. We essentially took random guesses,
	and it gradually dawned on us how crippling that was, because these decisions are fairly committal
	and migrating later is much harder than starting from scratch.
</p>
<p>
	The right way to frame the problem is task-first. What economically valuable tasks do models fail
	at right now? How do you create tasks that scale in difficulty as models improve?
</p>
<p>This doesn't make everything obvious, but you get better questions.</p>
<p>
	Example: say you want to train models to be really good at creating PowerPoint presentations. This
	is a deep and economically valuable task.
</p>
<p>
	There's a very scalable way to do this, proposed by my friend Shaya Zarkesh. Start with either a
	replica of PowerPoint or something very similar open source. Find a library of real presentations.
	For each one, AI-generate a spec of the presentation, and the task is to build a presentation from
	the spec. The grader then visually compares the original presentation with the created one, and
	scores based on the difference.
</p>
<p>
	This very quickly gets you thousands of tasks with a great difficulty distribution. There are
	still open questions like should you create a replica or just use open source, if replica then
	what features to implement, how precise should the spec be, how strict the grader should be on
	visual differences. But these questions feel tractable because you know what you're optimizing
	for. Moreover, it's not as committal. You can assign the PowerPoint experiment to one engineer,
	and they can make their decisions without affecting any of your other experiments. This is unlike
	the "simulate the internet" problem, where the infra decisions you make affect everyone.
</p>
<p>
	Here's another example: we believe one of the deepest and most valuable computer use tasks is
	finding bugs in software. I can think of two good ways to create this type of task at scale:
</p>
<ol>
	<li>
		Start with a working app from an open source repo. Generate a very precise description of how a
		feature in that app works. Tweak the app code in a few random places to alter its behavior. The
		task is for the agent to use the app to figure out where it fails to meet the spec. An LLM
		grader can compare the agent's writeup to the correct list of changes made.
	</li>
	<li>
		Host two different copies of the same app, they're completely identical except one has a few
		bugs added. The task is to find all the differences between the two apps. (you also want to seed
		the copies with different datasets, so that it's not a trivial visual diff + exhaustive search
		problem).
	</li>
</ol>
<p>
	The first method maps extremely well to how bug-finding will be done in real software development,
	but there could be flaws in generating the precise spec. The second method is almost bulletproof,
	but it's slightly less realistic. (We actually used the second method to pre-screen our human
	annotators, and it was remarkably predictive of who was generally good at using computers. So
	we're confident it would work for training agents too.)
</p>
<h2>Why we stopped</h2>
<p>
	A few months before deciding to wind down, we tried pivoting to the task-first approach. It was
	clearly directionally better, but we quickly realized we were struggling. The personas we hired
	and the infra we had built were all around "simulate the internet". Doing the new way right would
	have meant laying off half the team and throwing out most of what we'd built.
</p>
<p>
	We might have done that if we still believed in the market. But we didn't. Even with the right
	approach, the ceiling seemed too low.
</p>
<p>
	We considered pivoting to coding RL environments. That's an infinitely deep and economically
	valuable problem.
</p>
<p>
	But we stepped back. We had been heads down for two years while the world shifted seismically
	around us. And I've learned a lot that I didn't expect to learn: life from a manager's
	perspective, how labor markets work, the real value of social capital.
</p>
<p>
	We felt we needed some time to rebuild our world models, cleanse our stale assumptions, figure out
	where we'd really fit best in the future. And we didn't feel we could do this while running a
	company. So we stopped.
</p>
<p>
	If you're looking to hire remote engineers or data annotators with AI experience, please let me
	know. We've hired some really great people, and they're looking for the next thing. I'm also happy
	to chat with anyone who just wants to learn more about the space.
</p>
