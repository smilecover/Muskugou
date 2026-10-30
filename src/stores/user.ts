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
  getUserGrade,
  getUserPlaylists,
  getUserProfile,
  hasLogin,
  resetUserAuth,
  toErrorMessage,
  type LoginQr,
  type Playlist,
  type UserGrade,
  type UserProfile,
} from '@/api';
import { useLibraryStore } from './library';
import { useToastStore } from './toast';

export const useUserStore = defineStore('user', () => {
  const toast = useToastStore();
  const library = useLibraryStore();

  const loggedIn = ref(hasLogin());
  const profile = ref<UserProfile | null>(null);
  const playlists = ref<Playlist[]>([]);
  const grade = ref<UserGrade | null>(null);
  const gradeLoading = ref(false);
  const gradeError = ref('');
  const loading = ref(false);
  /** 任意方式登录成功后的统一收尾（刷新 auth / 资料 / 歌单） */
  const finishing = ref(false);

  const qr = ref<LoginQr | null>(null);
  const qrStatus = ref(-1);
  const qrMessage = ref('');
  const qrLoading = ref(false);

  let pollTimer: number | null = null;
  let polling = false;
  /** 二维码生成请求令牌：切换登录方式时作废仍在途的 createLoginQr */
  let loginToken = 0;

  const nickname = computed(() => profile.value?.nickname || (loggedIn.value ? '酷狗用户' : '未登录'));
  const avatar = computed(() => profile.value?.avatar || '');

  function resetUser(): void {
    profile.value = null;
    playlists.value = [];
    grade.value = null;
    gradeError.value = '';
  }

  /** 单独刷新听歌等级；失败只记录错误，不影响其它资料 */
  async function refreshGrade(): Promise<void> {
    if (gradeLoading.value) return;
    if (!hasLogin()) {
      grade.value = null;
      gradeError.value = '';
      return;
    }

    gradeLoading.value = true;
    gradeError.value = '';
    try {
      grade.value = await getUserGrade();
    } catch (error) {
      gradeError.value = toErrorMessage(error);
    } finally {
      gradeLoading.value = false;
    }
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
        // refreshGrade 自己吞掉错误，等级接口失败不会阻断资料与歌单
        refreshGrade(),
      ]);
      profile.value = nextProfile;
      playlists.value = nextPlaylists;
      // 登录后「收藏」使用酷狗「我喜欢」歌单，后台同步歌曲
      if (hasLogin()) library.applyPlaylists(nextPlaylists);
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
      // 换了账号后旧 auth 与旧「我喜欢」都不能继续使用
      resetUserAuth();
      library.resetCloud();
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
    const token = (loginToken += 1);
    stopPolling();
    qr.value = null;
    qrStatus.value = -1;
    qrMessage.value = '';
    qrLoading.value = true;
    try {
      const nextQr = await createLoginQr();
      // 期间用户可能切换到其它登录方式，旧请求直接丢弃
      if (token !== loginToken) return;
      qr.value = nextQr;
      qrStatus.value = 1;
      qrMessage.value = '请使用酷狗音乐 App 扫码';
      pollTimer = window.setInterval(() => void pollOnce(), 2000);
    } catch (error) {
      if (token !== loginToken) return;
      qrMessage.value = toErrorMessage(error);
      toast.error(qrMessage.value);
    } finally {
      if (token === loginToken) qrLoading.value = false;
    }
  }

  /**
   * 离开扫码方式时调用：停止轮询，并作废仍在途的二维码生成请求。
   * 与 stopPolling 的区别是它会递增令牌，避免旧请求回来后重新开始轮询。
   */
  function cancelLogin(): void {
    loginToken += 1;
    stopPolling();
    qrLoading.value = false;
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
    library.resetCloud();
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
    grade,
    gradeLoading,
    gradeError,
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
    refreshGrade,
    completeLogin,
    startLogin,
    cancelLogin,
    resumePolling,
    refreshQr,
    pollOnce,
    stopPolling,
    logout,
  };
});
