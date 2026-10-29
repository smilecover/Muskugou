<script setup lang="ts">
/** 全局轻提示。放在页面顶部，避免被底部播放器遮挡。 */

import { AlertCircle, CheckCircle2, Info } from 'lucide-vue-next';
import { useToastStore } from '@/stores/toast';

const toast = useToastStore();

const icons = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div v-for="item in toast.items" :key="item.id" class="toast" :class="`toast--${item.type}`">
        <component :is="icons[item.type]" :size="17" :stroke-width="2" />
        <span>{{ item.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
