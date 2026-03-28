// AuthService.ts — Stub for v2. Replace with your auth provider.

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/** @deprecated Use AuthUser instead */
export type User = AuthUser;

let currentUser: AuthUser | undefined = undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listeners: Array<(user: any) => void> = [];

export function getCurrentUser(): AuthUser | null {
  return currentUser ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onAuthStateChanged(callback: (user: any) => void): () => void {
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

export async function signInWithEmail(_email: string, _password: string): Promise<AuthUser> {
  throw new Error('Not implemented');
}

export async function signUpWithEmail(_email: string, _password: string): Promise<AuthUser> {
  throw new Error('Not implemented');
}

export async function signInWithGoogle(): Promise<AuthUser> {
  throw new Error('Not implemented');
}

export async function signInWithApple(): Promise<AuthUser> {
  throw new Error('Not implemented');
}

export async function sendPasswordReset(_email: string): Promise<void> {
  throw new Error('Not implemented');
}

export async function signOut(): Promise<void> {
  currentUser = undefined;
  listeners.forEach(cb => cb(undefined));
}
