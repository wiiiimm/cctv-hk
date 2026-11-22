// App-wide toast for short notices (offline / online, update ready), optionally with one action button.
import { useSyncExternalStore } from "react";

export interface Toast {
  text: string;
  action?: string;
  onAction?: () => void;
  id: number;
}

let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function notify(text: string, action?: string, onAction?: () => void, sticky = false) {
  current = { text, action, onAction, id: Date.now() };
  clearTimeout(timer);
  if (!sticky) timer = setTimeout(dismiss, action ? 7000 : 5000);
  emit();
}

export function dismiss() {
  current = null;
  emit();
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}
