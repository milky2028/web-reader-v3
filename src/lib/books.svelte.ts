import type { User } from 'firebase/auth';
import { getDocs, query, where, orderBy } from 'firebase/firestore/lite';
import { booksCollection } from './db';

type Book = {
	cover: string;
	length: number;
	name: string;
};

let books: Book[] = $state([]);
export async function fetchBooks(user: User | null) {
	if (user) {
		const response = await getDocs(
			query(booksCollection, where('userId', '==', user.uid), orderBy('name'))
		);

		books = response.docs.map((doc) => doc.data() as Book);
	}
}

export const getBooks = () => books;
