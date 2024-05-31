<script lang="ts">
	const routes = [
		{ path: '/login', name: 'Log In' },
		{ path: '/', name: 'Upload' },
		{ path: '/books', name: 'Books' }
	];
</script>

<style>
	main {
		height: calc(100% - 3rem);
	}
</style>

<div>
	{#each routes as route, i}<a href={route.path}>{route.name}</a>{i !== routes.length - 1
			? ' | '
			: ''}
	{/each}
</div>
<main><slot /></main>
