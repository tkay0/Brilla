import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'brilla_access_token';

type Listener = () => void;

// undefined = not yet loaded from SecureStore, null = loaded and there is no token.
let token: string | null | undefined;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export async function loadToken() {
  try {
    token = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? null;
  } catch (error) {
    console.error('Failed to load token from SecureStore:', error);
    token = null;
  }
  emit();
  return token;
}

export async function setToken(next: string) {
  token = next;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, next);
  } catch (error) {
    console.error('Failed to save token to SecureStore:', error);
  }
  emit();
}

export async function clearToken() {
  token = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to delete token from SecureStore:', error);
  }
  emit();
}

export function getToken() {
  return token ?? null;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Returns undefined while SecureStore hasn't been read yet, null when signed out,
// or the JWT when signed in - callers gate the auth vs. tab navigator on this.
export function useAuthToken() {
  return useSyncExternalStore(
    subscribe,
    () => token,
    () => token,
  );
}
