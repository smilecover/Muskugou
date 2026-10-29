<script setup lang="ts">
/** 详情页顶栏：返回 + 标题 + 右侧操作。 */

import { useRouter } from 'vue-router';
import { ChevronLeft } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    title?: string;
    transparent?: boolean;
  }>(),
  { title: '', transparent: false },
);

const router = useRouter();

function goBack(): void {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
}
</script>

<template>
  <header class="page-header" :class="{ 'page-header--plain': transparent }">
    <button class="icon-btn icon-btn--ghost" aria-label="返回" @click="goBack">
      <ChevronLeft :size="23" />
    </button>
    <h1 class="page-header__title">{{ title }}</h1>
    <slot name="actions" />
  </header>
</template>
