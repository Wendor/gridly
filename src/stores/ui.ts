import { defineStore } from 'pinia';
import { ref } from 'vue';

export type SidebarView = 'connections' | 'history' | 'settings'

export const useUIStore = defineStore('ui', () => {
  const activeSidebar = ref<SidebarView>('connections');

  function setSidebar(view: SidebarView): void {
    activeSidebar.value = view;
  }

  return {
    activeSidebar,
    setSidebar,
  };
});
