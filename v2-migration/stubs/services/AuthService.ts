// AuthService.ts — Stub for v2. Replace with your auth provider.

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

let currentUser: User | null = null;
const listeners: Array<(user: User | null) => void> = [];

export function getCurrentUser(): User | null {
  return currentUser;
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  listeners.push(callback);
  callback(currentUser);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export async function getIdToken(): Promise<string | null> {
  // TODO: Return JWT from your auth provider
  return null;
}

export async function signInWithEmail(_email: string, _password: string): Promise<User> {
  throw new Error('Not implemented');
}

export async function signInWithGoogle(): Promise<User> {
  throw new Error('Not implemented');
}

export async function signInWithApple(): Promise<User> {
  throw new Error('Not implemented');
}

export async function signOut(): Promise<void> {
  currentUser = null;
  listeners.forEach(cb => cb(null));
}
