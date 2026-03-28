// Type stubs for firebase auth — v1 imports that will be replaced in v2.

declare module 'firebase/auth' {
  export interface Auth {
    currentUser: { uid: string; email: string | null } | null;
  }
  export function getAuth(): Auth;
}

declare module '@react-native-firebase/auth' {
  interface FirebaseAuth {
    (): {
      currentUser: { uid: string; email: string | null; displayName: string | null } | null;
      signOut(): Promise<void>;
    };
  }
  const auth: FirebaseAuth;
  export default auth;
}
