<script>
	import { collection, addDoc } from 'firebase/firestore';
	import { db } from '../../lib/firebase';

	let email = '';
	let loading = false;
	let done = false;

	const subscribe = async () => {
		// Implement the function to handle the subscription
		console.log(email);
		loading = true;
		const docRef = await addDoc(collection(db, 'subscriptions'), {
			createdAt: new Date(),
			email: email
		});
		loading = false;
		done = true;
		email = '';
	};
</script>

<svelte:head>
	<title>John Qian's blog</title>
	<meta
		name="description"
		content="The blog of John Qian. I'm tacking my name onto my site metadata to bump my SEO for my name."
	/>
</svelte:head>
<h1>Welcome!</h1>
<p>
	Thanks for visiting my blog. I'm currently an engineer at Adept. My thoughts don't reflect my
	workplace. Here I try to distill my thoughts to their simplest forms.
</p>
<p>
	If my blog posts resonate with you, feel free to reach out to me at <a
		href="mailto:johnlongqian+blog@gmail.com">johnlongqian+blog@gmail.com</a
	>
</p>
<div class="flex gap-2 items-center mt-8">
	<a target="_blank" rel="noreferrer" href="https://twitter.com/johnlqian">
		<img alt="twitter profile" src="twitter.svg" class="h-4 hover:brightness-110" />
	</a>
	<a target="_blank" rel="noreferrer" href="https://github.com/Xyzrr/micro-blog">
		<img alt="github profile" src="github.svg" class="h-5 rounded-full hover:opacity-90" />
	</a>
</div>
<p class="mt-16">
	Also feel free to put your email here if you want to be notified when I publish something
	potentially interesting. These emails will be very infrequent, if I send any at all. Nothing is
	automated; I'm just gauging interest right now.
</p>
<!-- Form -->
<form on:submit|preventDefault={subscribe} class="flex gap-2 items-center">
	<input
		type="email"
		bind:value={email}
		placeholder="Email address"
		required
		class="border rounded px-2 py-1"
	/>
	{#if loading}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-6 h-6 animate-spin"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
		</svg>
	{:else if done}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-6 h-6 text-green-500"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
		</svg>
	{:else}
		<button type="submit" class="opacity-80 hover:opacity-100 hover:text-blue-400">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="w-6 h-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
				/>
			</svg>
		</button>
	{/if}
</form>
{#if done}
	<p class="mt-2 text-sm text-gray-500">Thank you!</p>
{/if}
