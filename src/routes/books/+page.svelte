<script lang="ts">
	import { getBooks, type Book } from '$lib/books.svelte';
	import { storage } from '$lib/storage';
	import { getUser } from '$lib/user.svelte';
	import { getDownloadURL, ref } from 'firebase/storage';

	const books = $derived(getBooks());
	const user = $derived(getUser());

	function createUrl(book: Book, userId: string) {
		return getDownloadURL(ref(storage, `${userId}/${book.name}/${book.cover}`));
	}
</script>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: inline-block;
	}

	a {
		padding: 0.25rem;
	}
</style>

{#if books.length === 0}
	<p>No books uploaded yet</p>
{:else}
	<ul>
		{#each books as book (book.name)}
			{#if user}
				<li>
					<a href="/book/{book.name}/page/0">
						{#await createUrl(book, user.uid)}
							<div>Loading...</div>
						{:then url}
							<img src={url} loading="lazy" alt={book.name} width="200" />
						{/await}
					</a>
				</li>
			{/if}
		{/each}
	</ul>
{/if}
