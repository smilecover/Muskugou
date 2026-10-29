<script setup lang="ts">
/**
 * 图片封面。
 *
 * 酷狗部分图片地址是 http 或带 `{size}` 占位符，已经在归一化阶段处理；
 * 这里只负责懒加载与加载失败时的占位图。
 */

import { ref, watch } from 'vue';
import { Music2 } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    src?: string;
    alt?: string;
    iconSize?: number;
  }>(),
  { src: '', alt: '', iconSize: 22 },
);

const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <div class="cover-image">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      loading="lazy"
      decoding="async"
      draggable="false"
      @error="failed = true"
    />
    <div v-else class="cover-image__fallback">
      <Music2 :size="iconSize" :stroke-width="1.5" />
    </div>
  </div>
</template>
