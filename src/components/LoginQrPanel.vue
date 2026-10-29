<script setup lang="ts">
/**
 * 登录二维码卡片。
 *
 * 酷狗 / 微信 / QQ 三种扫码登录共用同一套外观与状态遮罩，
 * 轮询和接口调用由父页面负责，这里只负责展示。
 */

import { RefreshCw, ScanLine } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    image: string;
    alt?: string;
    loading?: boolean;
    loadingText?: string;
    message?: string;
    overlay?: 'scanned' | 'expired' | null;
    overlayTitle?: string;
    overlayDesc?: string;
    refreshLabel?: string;
    refreshing?: boolean;
  }>(),
  {
    alt: '登录二维码',
    loading: false,
    loadingText: '正在生成二维码',
    message: '',
    overlay: null,
    overlayTitle: '二维码已过期',
    overlayDesc: '',
    refreshLabel: '刷新二维码',
    refreshing: false,
  },
);

defineEmits<{ refresh: [] }>();
</script>

<template>
  <div class="qr-card">
    <div class="qr-frame">
      <img v-if="image" :src="image" :alt="alt" draggable="false" />
      <div v-else class="qr-loading">
        <span class="spinner" />
        {{ loadingText }}
      </div>

      <div v-if="overlay === 'scanned'" class="qr-overlay">
        <ScanLine :size="30" :stroke-width="1.6" />
        <strong>{{ overlayTitle }}</strong>
        <span v-if="overlayDesc">{{ overlayDesc }}</span>
      </div>
      <div v-else-if="overlay === 'expired'" class="qr-overlay">
        <RefreshCw :size="26" :stroke-width="1.6" />
        <strong>{{ overlayTitle }}</strong>
        <span v-if="overlayDesc">{{ overlayDesc }}</span>
        <button class="btn btn--primary btn--sm" @click="$emit('refresh')">重新生成</button>
      </div>
    </div>

    <p class="qr-message">{{ message || '正在准备登录…' }}</p>

    <button class="qr-refresh" :disabled="refreshing" @click="$emit('refresh')">
      <RefreshCw :size="14" :class="{ 'spin-icon': refreshing }" />
      {{ refreshLabel }}
    </button>
  </div>
</template>

<style scoped>
.qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 18px 14px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background:
    radial-gradient(120% 100% at 50% 0%, rgba(56, 225, 198, 0.07), transparent 60%),
    rgba(255, 255, 255, 0.03);
}

.qr-frame {
  position: relative;
  width: min(62vw, 220px);
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
}

.qr-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 100%;
  color: #556;
  font-size: 11px;
  background: #0f1622;
}

.qr-loading .spinner {
  border-color: rgba(255, 255, 255, 0.16);
  border-top-color: var(--accent);
}

.qr-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
  color: var(--text);
  text-align: center;
  background: rgba(7, 11, 18, 0.86);
  backdrop-filter: blur(3px);
}

.qr-overlay strong {
  font-size: 14px;
}

.qr-overlay span {
  max-width: 170px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.qr-overlay .btn {
  margin-top: 8px;
}

.qr-message {
  min-height: 18px;
  margin: 14px 0 0;
  color: var(--text-2);
  font-size: 11.5px;
  line-height: 1.5;
  text-align: center;
}

.qr-refresh {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  padding: 5px 10px;
  color: var(--muted);
  font-size: 10.5px;
}

.qr-refresh:disabled {
  opacity: 0.6;
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
