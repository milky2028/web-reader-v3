<script lang="ts">
	import { auth } from '$lib/auth';
	import { getUser } from '$lib/user.svelte';
	import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const data = new FormData(event.target as HTMLFormElement);

		const email = data.get('email');
		const password = data.get('password');
		if (typeof email === 'string' && typeof password === 'string') {
			await signInWithEmailAndPassword(auth, email, password);
		}
	}
</script>

<style>
	div {
		display: grid;
		place-items: center;
		height: 25vh;
	}

	form {
		display: grid;
		row-gap: 1rem;
		width: 25vw;
	}

	h1 {
		margin: 0;
	}

	input {
		width: 100%;
	}
</style>

<div>
	{#if getUser()}
		<button on:click={() => signOut(auth)}>Sign Out</button>
	{:else}
		<form on:submit={onSubmit}>
			<h1>Log In</h1>
			<label>Email<br /><input name="email" type="email" /></label>
			<label>Password<br /><input name="password" type="password" /></label>
			<input type="submit" value="Log In" />
		</form>
	{/if}
</div>
