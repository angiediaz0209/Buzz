// Auth lives apart from firebase.js on purpose.
//
// Every screen imports `db` from firebase.js. When getAuth() was called there
// too, the auth SDK — 77 KB, 23 KB gzipped — was pulled into the main bundle
// for everyone, including clients who scan a code and never sign in to
// anything. Keeping it here means only the modules that actually authenticate
// pull it in, and they are all artist-only lazy chunks.
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import app from './firebase';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
