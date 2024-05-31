import { browserLocalPersistence, getAuth } from 'firebase/auth';
import { app } from './firebase';

export const auth = getAuth(app);
auth.setPersistence(browserLocalPersistence);
