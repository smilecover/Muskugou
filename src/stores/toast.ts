/** 轻量全局提示 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let seed = 0;

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([]);

  function remove(id: number): void {
    items.value = items.value.filter((item) => item.id !== id);
  }

  function show(message: string, type: ToastType = 'info', duration = 2600): void {
    const id = (seed += 1);
    items.value = [...items.value, { id, message, type }].slice(-3);
    setTimeout(() => remove(id), duration);
  }

  const info = (message: string) => show(message, 'info');
  const success = (message: string) => show(message, 'success');
  const error = (message: string) => show(message, 'error', 3600);

  return { items, show, remove, info, success, error };
});
