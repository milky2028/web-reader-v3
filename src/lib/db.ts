import { collection, getFirestore } from 'firebase/firestore/lite';
import { app } from './firebase';

const db = getFirestore(app);
export const booksCollection = collection(db, 'books');
export const pages = collection(db, 'pages');
