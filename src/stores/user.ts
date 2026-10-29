/**
 * 登录态与用户资料。
 *
 * 登录页提供扫码、短信、密码、微信、QQ 五种方式；无论使用哪一种，
 * 成功后都由 `completeLogin()` 统一刷新 auth、资料与歌单。
 * Cookie 保存在本地，概念版与标准版的登录态相互独立。
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  checkLoginQr,
  clearAuth,
  createLoginQr,
  ensureUserAuth,
  getUserPlaylists,
  getUserProfile,
  hasLogin,
  resetUserAuth,
  toErrorMessage,
  type LoginQr,
  type Playlist,
  type UserProfile,
} from '@/api';
import { useToastStore } from './toast';

export const useUserStore = defineStore('user', () => {
  const toast = useToastStore();

  const loggedIn = ref(hasLogin());
  const profile = ref<UserProfile | null>(null);
  const playlists = ref<Playlist[]>([]);
  const loading = ref(false);
  /** 任意方式登录成功后的统一收尾（刷新 auth / 资料 / 歌单） */
  const finishing = ref(false);

  const qr = ref<LoginQr | null>(null);
  const qrStatus = ref(-1);
  const qrMessage = ref('');
  const qrLoading = ref(false);

  let pollTimer: number | null = null;
  let polling = false;

  const nickname = computed(() => profile.value?.nickname || (loggedIn.value ? '酷狗用户' : '未登录'));
  const avatar = computed(() => profile.value?.avatar || '');

  function resetUser(): void {
    profile.value = null;
    playlists.value = [];
  }

  async function refresh(): Promise<void> {
    loggedIn.value = hasLogin();
    if (!loggedIn.value) {
      resetUser();
      return;
    }
    loading.value = true;
    try {
      // 概念版免费听依赖 auth；登录后先确保拿到了 auth，再拉取资料
      await ensureUserAuth().catch(() => '');
      const [nextProfile, nextPlaylists] = await Promise.all([
        getUserProfile().catch(() => null),
        getUserPlaylists().catch(() => []),
      ]);
      profile.value = nextProfile;
      playlists.value = nextPlaylists;
      loggedIn.value = hasLogin();
    } finally {
      loading.value = false;
    }
  }

  function init(): void {
    if (hasLogin()) void refresh();
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /**
   * 所有登录方式的公共收尾。
   *
   * 登录接口只负责写入 Cookie；这里统一作废旧 auth、重新申请 auth，
   * 再刷新用户资料与歌单，避免各登录入口行为不一致。
   */
  async function completeLogin(): Promise<void> {
    if (finishing.value) return;
    finishing.value = true;
    try {
      stopPolling();
      // 换了账号后旧 auth 不能继续使用，强制重新获取
      resetUserAuth();
      await ensureUserAuth(true).catch(() => '');
      await refresh();
      loggedIn.value = hasLogin();
      if (!loggedIn.value) throw new Error('登录凭证未能保存，请重试');
      toast.success(`已登录：${profile.value?.nickname || '酷狗用户'}`);
    } finally {
      finishing.value = false;
    }
  }

  async function pollOnce(): Promise<void> {
    if (!qr.value || polling) return;
    polling = true;
    try {
      const status = await checkLoginQr(qr.value.key);
      qrStatus.value = status.status;
      qrMessage.value = status.message;
      if (status.status === 4) {
        stopPolling();
        await completeLogin();
      } else if (status.status === 0) {
        stopPolling();
      }
    } catch (error) {
      // 轮询失败不打断用户，等下一次
      qrMessage.value = toErrorMessage(error);
    } finally {
      polling = false;
    }
  }

  async function startLogin(): Promise<void> {
    if (loggedIn.value) return;
    stopPolling();
    qr.value = null;
    qrStatus.value = -1;
    qrMessage.value = '';
    qrLoading.value = true;
    try {
      qr.value = await createLoginQr();
      qrStatus.value = 1;
      qrMessage.value = '请使用酷狗音乐 App 扫码';
      pollTimer = window.setInterval(() => void pollOnce(), 2000);
    } catch (error) {
      qrMessage.value = toErrorMessage(error);
      toast.error(qrMessage.value);
    } finally {
      qrLoading.value = false;
    }
  }

  /**
   * 从其它登录方式切回扫码时恢复轮询。
   * 二维码仍有效就沿用，已过期则重新生成。
   */
  function resumePolling(): void {
    if (qr.value && qrStatus.value !== 0 && qrStatus.value !== 4) {
      stopPolling();
      pollTimer = window.setInterval(() => void pollOnce(), 2000);
      return;
    }
    void startLogin();
  }

  /** 二维码过期后刷新 */
  async function refreshQr(): Promise<void> {
    await startLogin();
  }

  function logout(): void {
    stopPolling();
    clearAuth();
    resetUserAuth();
    qr.value = null;
    qrStatus.value = -1;
    qrMessage.value = '';
    loggedIn.value = false;
    resetUser();
    toast.success('已退出登录');
  }

  return {
    loggedIn,
    profile,
    playlists,
    loading,
    finishing,
    nickname,
    avatar,
    qr,
    qrStatus,
    qrMessage,
    qrLoading,
    init,
    refresh,
    completeLogin,
    startLogin,
    resumePolling,
    refreshQr,
    pollOnce,
    stopPolling,
    logout,
  };
});
