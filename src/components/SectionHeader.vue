<script setup lang="ts">
/** 首页分区标题，可带“更多”入口。 */

import { ChevronRight } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    title: string;
    action?: string;
    to?: string;
  }>(),
  { action: '查看更多', to: '' },
);
</script>

<template>
  <div class="section-head">
    <h2 class="section-title">{{ title }}</h2>
    <router-link v-if="to" :to="to" class="section-action">
      {{ action }}
      <ChevronRight :size="14" />
    </router-link>
    <slot name="action" />
  </div>
</template>
