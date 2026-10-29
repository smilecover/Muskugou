<script setup lang="ts">
/** 底部导航：首页 / 发现 / 搜索 / 排行 / 我的。 */

import type { Component } from 'vue';
import { useRoute } from 'vue-router';
import { Compass, Home, Search, Trophy, User } from 'lucide-vue-next';

interface TabItem {
  name: string;
  label: string;
  to: string;
  icon: Component;
}

const route = useRoute();

const tabs: TabItem[] = [
  { name: 'home', label: '首页', to: '/', icon: Home },
  { name: 'discover', label: '发现', to: '/discover', icon: Compass },
  { name: 'search', label: '搜索', to: '/search', icon: Search },
  { name: 'ranks', label: '排行', to: '/ranks', icon: Trophy },
  { name: 'library', label: '我的', to: '/library', icon: User },
];

function isActive(tab: TabItem): boolean {
  return route.name === tab.name;
}
</script>

<template>
  <nav class="tabbar">
    <router-link
      v-for="tab in tabs"
      :key="tab.name"
      :to="tab.to"
      class="tabbar__item"
      :class="{ 'tabbar__item--active': isActive(tab) }"
    >
      <component :is="tab.icon" :size="21" :stroke-width="isActive(tab) ? 2.4 : 1.9" />
      <span>{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.tabbar {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  height: calc(60px + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  border-top: 1px solid var(--line);
  background: rgba(9, 14, 22, 0.94);
  backdrop-filter: blur(22px);
}

.tabbar__item {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--muted);
  font-size: 10.5px;
  letter-spacing: 0.02em;
  transition: color 0.18s ease;
}

.tabbar__item--active {
  color: var(--accent);
}

.tabbar__item--active::before {
  position: absolute;
  top: 0;
  width: 22px;
  height: 2px;
  border-radius: 999px;
  background: var(--accent-gradient);
  content: '';
}
</style>
