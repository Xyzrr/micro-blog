<script lang="ts">
	import { page } from '$app/stores';
	import classNames from 'classnames';

	export let to: string;
	$: activeUrl = $page.url.pathname;
</script>

<a
	href={to}
	class={classNames('py-1 px-4 hover:opacity-100 text-sm', {
		'opacity-100': activeUrl === to,
		'opacity-60': activeUrl !== to
	})}><slot /></a
>
