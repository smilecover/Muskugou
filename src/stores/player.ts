/**
 * 全局播放器。
 *
 * 整个 App 只有一个 `<audio>` 元素和一份播放队列。播放器在这里集中处理：
 *   - 播放地址获取（音质回退、VIP 试听）
 *   - 播放 / 暂停 / 上一首 / 下一首 / 拖动进度
 *   - 列表循环 / 单曲循环 / 随机播放
 *   - 歌词加载与缓存
 *   - 最近播放记录
 *   - 系统媒体控制（Media Session，锁屏/通知栏可显示歌曲信息）
 *
 * 队列和播放模式会写入 localStorage，重启 App 后可以继续从上次的队列播放。
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  clearUrlCache,
  getLyric,
  getSettings,
  getSongUrl,
  onAuthChange,
  readJson,
  STORAGE_KEYS,
  toErrorMessage,
  writeJson,
  type PlayableUrl,
  type Quality,
  type Song,
} from '@/api';
import { parseLyric as parseLyricText, type LyricLine } from '@/utils/lyric';
import { useLibraryStore } from './library';
import { useSettingsStore } from './settings';
import { useToastStore } from './toast';

export type PlayMode = 'list' | 'single' | 'shuffle';

interface PersistedPlayer {
  index: number;
  mode: PlayMode;
  volume: number;
}

const MODES: PlayMode[] = ['list', 'single', 'shuffle'];
const DEFAULT_VOLUME = 0.8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isSong(value: any): value is Song {
  return Boolean(value && typeof value === 'object' && value.id && value.hash);
}

export const usePlayerStore = defineStore('player', () => {
  const toast = useToastStore();
  const library = useLibraryStore();
  const settings = useSettingsStore();

  // -------------------------------------------------------------------------
  // 状态
  // -------------------------------------------------------------------------

  const savedQueue = readJson<Song[]>(STORAGE_KEYS.queue, []);
  const savedPlayer = readJson<Partial<PersistedPlayer>>(STORAGE_KEYS.player, {});

  const queue = ref<Song[]>(Array.isArray(savedQueue) ? savedQueue.filter(isSong) : []);
  const mode = ref<PlayMode>(MODES.includes(savedPlayer.mode as PlayMode) ? (savedPlayer.mode as PlayMode) : 'list');
  const volume = ref(clamp(Number(savedPlayer.volume ?? DEFAULT_VOLUME), 0, 1));

  const initialIndex =
    typeof savedPlayer.index === 'number' && savedPlayer.index >= 0 && savedPlayer.index < queue.value.length
      ? savedPlayer.index
      : queue.value.length
        ? 0
        : -1;

  const index = ref(initialIndex);
  const current = ref<Song | null>(initialIndex >= 0 ? queue.value[initialIndex] : null);

  const playing = ref(false);
  const loading = ref(false);
  /** 缓冲中（播放过程中的卡顿，与首次加载区分开） */
  const buffering = ref(false);
  const preview = ref(false);
  /** 概念版免费听：完整标准音质，不是试听 */
  const freeListen = ref(false);
  const currentQuality = ref<Quality | null>(null);
  const currentTime = ref(0);
  const duration = ref(initialIndex >= 0 ? (queue.value[initialIndex].duration || 0) / 1000 : 0);
  const buffered = ref(0);
  const error = ref('');
  /** 浏览器自动播放被拦截，需要用户点一下播放按钮 */
  const needsGesture = ref(false);

  const lyricLines = ref<LyricLine[]>([]);
  const lyricLoading = ref(false);

  // 音频元素是普通对象，不需要放进 ref（放进 ref 会被 Vue 深度代理）
  let audio: HTMLAudioElement | null = null;
  /** 切歌请求序号，用于丢弃过期的异步响应 */
  let loadToken = 0;
  /** 歌词缓存：歌曲 id -> 解析结果 */
  const lyricCache = new Map<string, LyricLine[]>();
  /** 随机播放时记录来路，方便“上一首” */
  const shuffleHistory: number[] = [];
  let lastAudioError = '';
  /** 当前歌曲的可尝试地址（主地址 + CDN/协议备用地址） */
  let alternateUrls: string[] = [];
  let alternateIndex = 0;
  /** 最近一次触发 error 的地址，避免同一个地址重复上报 */
  let lastFailedUrl = '';
  /** 用户是否希望继续播放（用于切换到备用地址后恢复播放） */
  let wantsPlayback = false;

  const hasCurrent = computed(() => current.value !== null);
  const hasNext = computed(() => queue.value.length > 1);
  const hasPrev = computed(() => queue.value.length > 1);
  const progress = computed(() => (duration.value > 0 ? clamp(currentTime.value / duration.value, 0, 1) : 0));
  const modeLabel = computed(() => {
    if (mode.value === 'single') return '单曲循环';
    if (mode.value === 'shuffle') return '随机播放';
    return '列表循环';
  });

  // -------------------------------------------------------------------------
  // 持久化
  // -------------------------------------------------------------------------

  function persistPlayer(): void {
    writeJson(STORAGE_KEYS.player, {
      index: index.value,
      mode: mode.value,
      volume: volume.value,
    } satisfies PersistedPlayer);
  }

  function persistQueue(): void {
    writeJson(STORAGE_KEYS.queue, queue.value);
  }

  // -------------------------------------------------------------------------
  // 系统媒体控制
  // -------------------------------------------------------------------------

  function updateMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const song = current.value;

    if (!song) {
      session.metadata = null;
      session.playbackState = 'none';
      return;
    }

    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({
        title: song.name,
        artist: song.artist,
        album: song.albumName,
        artwork: song.cover ? [{ src: song.cover, sizes: '480x480', type: 'image/jpeg' }] : [],
      });
    }
    session.playbackState = playing.value ? 'playing' : 'paused';
  }

  function setMediaAction(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // 某些 WebView 不支持个别 action，忽略即可
    }
  }

  function bindMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    setMediaAction('play', () => void resume());
    setMediaAction('pause', () => pause());
    setMediaAction('nexttrack', () => void next());
    setMediaAction('previoustrack', () => void prev());
    setMediaAction('seekto', (details) => {
      if (typeof details.seekTime === 'number') seek(details.seekTime);
    });
  }

  // -------------------------------------------------------------------------
  // 播放进度
  // -------------------------------------------------------------------------

  function updateTime(): void {
    if (!audio) return;
    currentTime.value = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    if (Number.isFinite(audio.duration) && audio.duration > 0) duration.value = audio.duration;

    try {
      if (audio.buffered.length) buffered.value = audio.buffered.end(audio.buffered.length - 1);
    } catch {
      buffered.value = 0;
    }
  }

  // -------------------------------------------------------------------------
  // 音频元素
  // -------------------------------------------------------------------------

  /**
   * 在用户手势或自动播放上下文中开始播放。
   *
   * 浏览器的 autoplay 策略会拒绝没有用户手势的 `play()`（NotAllowedError）。
   * 此时不把它当成播放失败：保留已加载的地址，并显示“点按播放”提示。
   */
  async function playAudio(): Promise<void> {
    if (!audio) return;
    wantsPlayback = true;
    try {
      await audio.play();
      needsGesture.value = false;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
      needsGesture.value = true;
      playing.value = false;
      loading.value = false;
      buffering.value = false;
    }
  }

  /**
   * 音频加载失败：先尝试下一个 CDN / http 备用地址，全部失败后再提示用户重试。
   *
   * 酷狗返回的 URL 列表里经常同时有多个 CDN 节点，个别节点会 403/超时；
   * 逐条回退可以显著降低“点了歌没反应”的概率。
   */
  function handleAudioError(): void {
    if (!audio || !audio.src) return;
    const failedUrl = audio.src;
    if (failedUrl === lastFailedUrl) return;
    lastFailedUrl = failedUrl;

    if (alternateIndex + 1 < alternateUrls.length) {
      alternateIndex += 1;
      const nextUrl = alternateUrls[alternateIndex];
      const shouldPlay = wantsPlayback;
      audio.src = nextUrl;
      audio.load();
      if (shouldPlay) void playAudio();
      return;
    }

    const message = '音频加载失败，可能是版权限制或网络问题，点“重试”重新获取地址';
    if (message !== lastAudioError) {
      lastAudioError = message;
      toast.error(message);
    }
    error.value = message;
    wantsPlayback = false;
    playing.value = false;
    loading.value = false;
    buffering.value = false;
  }

  function ensureAudio(): HTMLAudioElement | null {
    if (audio) return audio;
    if (typeof Audio === 'undefined') return null;

    audio = new Audio();
    audio.preload = 'auto';
    audio.volume = volume.value;

    audio.addEventListener('play', () => {
      playing.value = true;
      loading.value = false;
      buffering.value = false;
      needsGesture.value = false;
      error.value = '';
      updateMediaSession();
    });
    audio.addEventListener('pause', () => {
      playing.value = false;
      buffering.value = false;
      updateMediaSession();
      persistPlayer();
    });
    audio.addEventListener('waiting', () => {
      if (playing.value) buffering.value = true;
    });
    audio.addEventListener('playing', () => {
      buffering.value = false;
      loading.value = false;
    });
    audio.addEventListener('canplay', () => {
      buffering.value = false;
      loading.value = false;
    });
    audio.addEventListener('loadedmetadata', () => {
      updateTime();
      loading.value = false;
    });
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('progress', updateTime);
    audio.addEventListener('ended', () => void handleEnded());
    audio.addEventListener('error', handleAudioError);

    bindMediaSession();
    return audio;
  }

  // -------------------------------------------------------------------------
  // 歌词
  // -------------------------------------------------------------------------

  async function loadLyric(song: Song, token: number): Promise<void> {
    const cached = lyricCache.get(song.id);
    if (cached) {
      lyricLines.value = cached;
      return;
    }

    lyricLoading.value = true;
    try {
      const result = await getLyric(song);
      if (token !== loadToken) return;
      const lines = parseLyricText(result.content);
      lyricCache.set(song.id, lines);
      // 只保留最近 30 首，避免长期占用内存
      if (lyricCache.size > 30) {
        const oldest = lyricCache.keys().next().value;
        if (oldest) lyricCache.delete(oldest);
      }
      lyricLines.value = lines;
    } catch {
      if (token === loadToken) lyricLines.value = [];
    } finally {
      if (token === loadToken) lyricLoading.value = false;
    }
  }

  // -------------------------------------------------------------------------
  // 核心：加载并播放
  // -------------------------------------------------------------------------

  /**
   * 加载队列中第 `targetIndex` 首。
   *
   * @param targetIndex 队列下标
   * @param autoplay    取到地址后是否立即播放
   * @param forceUrl    忽略播放地址缓存（例如音质刚刚变化）
   */
  async function loadAt(targetIndex: number, autoplay = true, forceUrl = false): Promise<void> {
    const song = queue.value[targetIndex];
    if (!song) return;

    index.value = targetIndex;
    current.value = song;
    currentTime.value = 0;
    buffered.value = 0;
    duration.value = (song.duration || 0) / 1000;
    lyricLines.value = [];
    lyricLoading.value = false;
    preview.value = false;
    freeListen.value = false;
    currentQuality.value = null;
    error.value = '';
    needsGesture.value = false;
    loading.value = true;
    buffering.value = false;
    lastAudioError = '';
    lastFailedUrl = '';
    alternateUrls = [];
    alternateIndex = 0;
    wantsPlayback = autoplay;
    persistPlayer();

    const token = (loadToken += 1);
    library.addHistory(song);
    updateMediaSession();
    void loadLyric(song, token);

    let playable: PlayableUrl;
    try {
      playable = await getSongUrl(song, getSettings().quality, forceUrl);
    } catch (err) {
      if (token !== loadToken) return;
      loading.value = false;
      playing.value = false;
      error.value = toErrorMessage(err);
      toast.error(error.value);
      return;
    }

    if (token !== loadToken) return;

    const element = ensureAudio();
    if (!element) {
      loading.value = false;
      error.value = '当前环境不支持音频播放';
      return;
    }

    preview.value = playable.preview;
    freeListen.value = playable.freeListen;
    currentQuality.value = playable.quality;

    // 主地址 + 备用地址：播放器在 error 事件中自动切换
    alternateUrls = [...new Set([playable.url, ...playable.fallbackUrls].filter(Boolean))];
    alternateIndex = 0;
    element.src = alternateUrls[0];
    element.load();

    if (autoplay) {
      await playAudio();
    } else {
      wantsPlayback = false;
      loading.value = false;
    }
  }

  /** 暂停状态下恢复当前歌曲；没有加载过地址则重新加载 */
  async function resume(): Promise<void> {
    if (!current.value) {
      if (queue.value.length) await loadAt(clamp(index.value, 0, queue.value.length - 1));
      return;
    }

    if (!audio || !audio.src) {
      await loadAt(index.value, true, Boolean(error.value));
      return;
    }

    if (error.value) {
      await loadAt(index.value, true, true);
      return;
    }

    // 已经播放到结尾时再点播放，从头开始
    if (duration.value > 0 && currentTime.value >= duration.value - 0.3) {
      audio.currentTime = 0;
    }

    await playAudio();
  }

  function pause(): void {
    wantsPlayback = false;
    needsGesture.value = false;
    audio?.pause();
    playing.value = false;
    updateMediaSession();
  }

  /**
   * 重新获取当前歌曲的播放地址。
   *
   * 用于播放失败提示里的「重试」：清空地址缓存并强制重新走一遍
   * 常规地址 → 概念版免费听 → 试听的完整链路。
   */
  async function retryCurrent(): Promise<void> {
    if (!current.value) return;
    clearUrlCache();
    lastAudioError = '';
    await loadAt(index.value, true, true);
  }

  async function toggle(): Promise<void> {
    if (playing.value) {
      pause();
      return;
    }
    await resume();
  }

  // -------------------------------------------------------------------------
  // 队列操作
  // -------------------------------------------------------------------------

  /** 用一组歌曲替换队列，并从 `startIndex` 开始播放 */
  async function playSongs(songs: Song[], startIndex = 0): Promise<void> {
    if (!songs.length) return;
    const nextQueue = songs.filter(isSong);
    if (!nextQueue.length) return;

    const safeIndex = clamp(startIndex, 0, nextQueue.length - 1);
    const wasPlaying = playing.value;
    queue.value = nextQueue;
    shuffleHistory.length = 0;
    persistQueue();
    // 如果点击的是当前歌曲，保持播放状态即可
    if (current.value && nextQueue[safeIndex]?.id === current.value.id && wasPlaying) {
      index.value = safeIndex;
      persistPlayer();
      await resume();
      return;
    }
    await loadAt(safeIndex);
  }

  /** 播放单首歌曲（不在队列中时替换队列） */
  async function playSong(song: Song): Promise<void> {
    const existing = queue.value.findIndex((item) => item.id === song.id);
    if (existing >= 0) {
      await loadAt(existing);
      return;
    }
    await playSongs([song], 0);
  }

  /** 插入到当前歌曲之后 */
  function playNext(song: Song): void {
    if (!queue.value.length) {
      void playSongs([song], 0);
      return;
    }
    const insertAt = index.value + 1;
    const nextQueue = [...queue.value];
    nextQueue.splice(insertAt, 0, song);
    queue.value = nextQueue;
    persistQueue();
    toast.success('已添加到下一首播放');
  }

  function removeFromQueue(targetIndex: number): void {
    if (targetIndex < 0 || targetIndex >= queue.value.length) return;
    const nextQueue = [...queue.value];
    nextQueue.splice(targetIndex, 1);
    queue.value = nextQueue;

    if (!nextQueue.length) {
      clearQueue();
      return;
    }

    if (targetIndex < index.value) {
      index.value -= 1;
    } else if (targetIndex === index.value) {
      // 删掉的是正在播放的歌曲：停止当前音频，播放原位置的下一首
      audio?.pause();
      audio = null;
      current.value = null;
      playing.value = false;
      const nextIndex = clamp(targetIndex, 0, nextQueue.length - 1);
      persistQueue();
      void loadAt(nextIndex, true);
      return;
    }
    persistQueue();
    persistPlayer();
  }

  function clearQueue(): void {
    queue.value = [];
    index.value = -1;
    current.value = null;
    playing.value = false;
    loading.value = false;
    buffering.value = false;
    preview.value = false;
    freeListen.value = false;
    needsGesture.value = false;
    currentQuality.value = null;
    currentTime.value = 0;
    duration.value = 0;
    lyricLines.value = [];
    error.value = '';
    wantsPlayback = false;
    alternateUrls = [];
    alternateIndex = 0;
    lastFailedUrl = '';
    loadToken += 1;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    persistQueue();
    persistPlayer();
    updateMediaSession();
  }

  // -------------------------------------------------------------------------
  // 切歌
  // -------------------------------------------------------------------------

  async function handleEnded(): Promise<void> {
    playing.value = false;
    if (mode.value === 'single') {
      if (audio) {
        audio.currentTime = 0;
        try {
          await audio.play();
        } catch {
          // 忽略自动播放限制，用户可手动继续
        }
      }
      return;
    }

    if (!settings.state.autoPlayNext) {
      updateMediaSession();
      return;
    }

    if (queue.value.length <= 1) {
      updateMediaSession();
      return;
    }
    await next();
  }

  /** 下一首（手动或自动） */
  async function next(auto = false): Promise<void> {
    if (!queue.value.length) return;
    if (queue.value.length === 1) {
      if (!auto) await loadAt(0);
      return;
    }

    let nextIndex: number;
    if (mode.value === 'shuffle') {
      shuffleHistory.push(index.value);
      if (shuffleHistory.length > 50) shuffleHistory.shift();
      nextIndex = randomIndexExcept(index.value);
    } else {
      nextIndex = (index.value + 1) % queue.value.length;
    }
    await loadAt(nextIndex);
  }

  /** 上一首：播放超过 3 秒时先回到开头 */
  async function prev(): Promise<void> {
    if (!queue.value.length) return;
    if (currentTime.value > 3 && audio) {
      seek(0);
      return;
    }
    if (queue.value.length === 1) {
      seek(0);
      return;
    }

    let prevIndex: number;
    if (mode.value === 'shuffle' && shuffleHistory.length) {
      prevIndex = shuffleHistory.pop() as number;
    } else {
      prevIndex = (index.value - 1 + queue.value.length) % queue.value.length;
    }
    await loadAt(prevIndex);
  }

  function randomIndexExcept(exclude: number): number {
    if (queue.value.length <= 1) return 0;
    let candidate = exclude;
    while (candidate === exclude) {
      candidate = Math.floor(Math.random() * queue.value.length);
    }
    return candidate;
  }

  // -------------------------------------------------------------------------
  // 进度 / 音量 / 模式
  // -------------------------------------------------------------------------

  function seek(seconds: number): void {
    if (!audio || !Number.isFinite(seconds)) return;
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration.value;
    const target = clamp(seconds, 0, max || 0);
    try {
      audio.currentTime = target;
      currentTime.value = target;
    } catch {
      // 元数据还没加载时设置进度可能失败，等 loadedmetadata 后再操作
    }
  }

  function setVolume(value: number): void {
    volume.value = clamp(value, 0, 1);
    if (audio) audio.volume = volume.value;
    persistPlayer();
  }

  function setMode(value: PlayMode): void {
    mode.value = value;
    persistPlayer();
  }

  function cycleMode(): PlayMode {
    const nextMode = MODES[(MODES.indexOf(mode.value) + 1) % MODES.length];
    setMode(nextMode);
    toast.info(nextMode === 'list' ? '列表循环' : nextMode === 'single' ? '单曲循环' : '随机播放');
    return nextMode;
  }

  /** 切换音质：清空地址缓存，下一首生效 */
  function refreshQuality(): void {
    clearUrlCache();
    if (!current.value) return;
    toast.info(`音质已切换为 ${getSettings().quality.toUpperCase()}，将在下一首生效`);
  }

  /** 从队列第 `targetIndex` 首开始播放 */
  async function jumpTo(targetIndex: number): Promise<void> {
    if (targetIndex < 0 || targetIndex >= queue.value.length) return;
    await loadAt(targetIndex);
  }

  // 登录状态变化后，之前缓存的试听地址可能已经能用完整版替换
  onAuthChange(() => clearUrlCache());

  return {
    // 状态
    queue,
    index,
    current,
    playing,
    loading,
    buffering,
    preview,
    freeListen,
    currentQuality,
    currentTime,
    duration,
    buffered,
    error,
    needsGesture,
    lyricLines,
    lyricLoading,
    mode,
    volume,
    // 计算属性
    hasCurrent,
    hasNext,
    hasPrev,
    progress,
    modeLabel,
    // 操作
    playSongs,
    playSong,
    playNext,
    removeFromQueue,
    clearQueue,
    resume,
    pause,
    toggle,
    retryCurrent,
    next,
    prev,
    seek,
    setVolume,
    setMode,
    cycleMode,
    refreshQuality,
    jumpTo,
  };
});
