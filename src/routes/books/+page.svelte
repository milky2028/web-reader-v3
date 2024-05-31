<script lang="ts">
	import { getBooks, fetchBooks } from '$lib/books.svelte';
	import { getUser } from '$lib/user.svelte';

	const books = $derived(getBooks());
</script>

{#if books.length === 0}
	<p>No books uploaded yet</p>
{:else}
	<ul>
		{#each books as book (book.name)}
			<li>
				{book.name}
				<!-- <a href="/book/{bookName}/page/{lastPage}">
					<img src={coverImg} loading="lazy" alt={bookName} width="200" />
				</a> -->
			</li>
		{/each}
	</ul>
{/if}
