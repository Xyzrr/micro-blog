<script lang="ts">
	import classNames from 'classnames';

	export let title: string;
	let collapsed = true;

	const toggleCollapsed = () => {
		collapsed = !collapsed;
	};
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class={classNames('flex flex-col rounded', {
		'hover:brightness-95 cursor-pointer bg-gray-200': collapsed,
		'border border-gray-300 p-4': !collapsed
	})}
>
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<h2
		class={classNames('cursor-pointer flex items-center justify-between m-0', {
			'opacity-70 text-lg p-4': collapsed,
			'text-2xl mb-4 hover:brightness-200': !collapsed
		})}
		on:click={toggleCollapsed}
	>
		{title}
		<span class="inline-block mr-2">
			{#if !collapsed}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-6 h-6"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15" />
				</svg>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-6 h-6"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
			{/if}
		</span>
	</h2>
	{#if !collapsed}
		<slot />
	{/if}
</div>
