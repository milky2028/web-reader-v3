import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './auth';

let user: User | null = $state(null);
onAuthStateChanged(auth, (userState) => {
	user = userState;
});

export const getUser = () => user;
