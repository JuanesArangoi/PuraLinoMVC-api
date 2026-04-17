import { AsyncLocalStorage } from 'node:async_hooks';

export const asyncContext = new AsyncLocalStorage();

export function getCurrentUser() {
  const store = asyncContext.getStore();
  return store?.user || null;
}
