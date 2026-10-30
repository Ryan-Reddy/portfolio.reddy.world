import {sameWork} from './desk-store.js';
import {packState,unpackState} from './desk-history.js';
// The desk's copy in Ryan's account: Firestore `private-desk/image-desk` in project getreddyworld, the same
// project, sign-in and owner-only rules as reddy.world/private (firestore.rules in Ryan-Reddy/reddy.world).
//
// The desk is served at reddy.world/private/portfolio/ (reddy.world moves it there), the same origin as /private, so this app with
// the same config sees the Google sign-in Ryan already has there. On another address (a PR preview of this
// repo) it is simply signed out and the desk keeps saving in the browser, as before.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, connectAuthEmulator, signInWithCredential } from 'firebase/auth';
import { getFirestore, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, connectFirestoreEmulator } from 'firebase/firestore';

// Must match reddy.world's src/services/firebaseConfig/firebase-config.ts: the sign-in is shared through it.
const firebaseConfig = {
  apiKey: 'AIzaSyAAqj-fbvSLjBjNRJfwbk8Rp3T1bTVs_Yg',
  authDomain: 'getreddyworld.firebaseapp.com',
  projectId: 'getreddyworld',
  storageBucket: 'getreddyworld.appspot.com',
  messagingSenderId: '815727821759',
  appId: '1:815727821759:web:a673d3cb49255ffc7b970a',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ref = doc(db, 'private-desk', 'image-desk');

// `PUBLIC_DESK_EMULATORS=1 npm run build` points the desk at the local Auth and Firestore emulators, for
// testing the signed-in path (scripts/desk-sync-check.mjs); PUBLIC_DESK_FIRESTORE_PORT moves Firestore off 8080
// when another emulator holds it. Unset, as in every real build, this block is dropped.
if (import.meta.env.PUBLIC_DESK_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', Number(import.meta.env.PUBLIC_DESK_FIRESTORE_PORT || 8080));
  // the Auth emulator takes an unsigned Google token at face value
  window.__deskSignInForTest = (email) => signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
}

/** The rules cap the saved text at 900,000 characters (a Firestore document holds at most 1 MiB). */
export const LIMIT = 900000;

export const watchUser = (callback) => onAuthStateChanged(auth, callback);
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutHere = () => signOut(auth);
/** Ryan's sign-in token, for reddy.world's /api/desk-to-site ("Send to site"). */
export const idToken = () => auth.currentUser?.getIdToken() ?? Promise.resolve(null);

const parse = (snap) => {
  if (!snap.exists()) return null;
  try { return JSON.parse(snap.data().state); } catch { return null; }
};

/** Calls `onRemote(state | null, savedAtMs)` with the saved copy now and on every change from another device. */
export const watchRemote = (onRemote, onError) => onSnapshot(ref, (snap) => onRemote(parse(snap), snap.exists() ? snap.data().updated?.toMillis?.() : undefined), onError);

/**
 * Saves `merge(remoteOrNull)` in one transaction: read the saved copy, merge this browser's work into it,
 * write the result. Two devices saving at once both keep their work. Resolves to the merged state.
 */
export async function save(merge) {
  return runTransaction(db, async (tx) => {
    const merged = merge(parse(await tx.get(ref)));
    const text = JSON.stringify(merged);
    if (text.length > LIMIT) throw Object.assign(new Error(`the desk is ${text.length.toLocaleString('en')} characters, more than the ${LIMIT.toLocaleString('en')} an account copy holds`), { code: 'too-big' });
    tx.set(ref, { state: text, updated: serverTimestamp() });
    return merged;
  });
}

const versionRefs=Array.from({length:4},(_,i)=>doc(db,'private-desk','image-desk-version-'+i));
export async function checkpoint(state) {
 const text=await packState({...state,versionAt:Date.now()});
 if(text.length>LIMIT)throw new Error('This backup is too large; export a copy before publishing.');
 await runTransaction(db,async tx=>{
  const previous=await Promise.all(versionRefs.map(ref=>tx.get(ref)));
  if(previous[0].exists() && sameWork(await unpackState(previous[0].data().state),state))return;
  for(let i=versionRefs.length-1;i>0;i--)if(previous[i-1].exists())tx.set(versionRefs[i],{state:previous[i-1].data().state,updated:serverTimestamp()});
  tx.set(versionRefs[0],{state:text,updated:serverTimestamp()});
 });
}
export async function versions() {
 const snapshots=await Promise.all(versionRefs.map(ref=>getDoc(ref)));
 return Promise.all(snapshots.filter(s=>s.exists()).map(async snap=>{const state=await unpackState(snap.data().state);return {state,at:state.versionAt ?? snap.data().updated?.toMillis?.()};}));
}
