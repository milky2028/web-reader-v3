<script lang="ts">
	import { fetchBooks } from '$lib/books.svelte';
	import { getUser } from '$lib/user.svelte';

	const user = $derived(getUser());
	const routes = $derived([
		{ path: '/', name: 'Upload' },
		{ path: '/books', name: 'Books' },
		{ path: '/login', name: user ? 'Sign Out' : 'Log In' }
	]);

	$effect(() => {
		fetchBooks(user);
	});
</script>

<style>
	main {
		height: calc(100% - 3rem);
	}
</style>

<div>
	{#each routes as route, i (route.path)}<a href={route.path}>{route.name}</a>{i !==
		routes.length - 1
			? ' | '
			: ''}
	{/each}
</div>
<main><slot /></main>
