/**
 * App 的类型化接口门面。
 *
 * 236 个移植模块保持原库的“路由 + params”调用方式；这一层负责：
 *   - 设备注册（dfid）
 *   - 响应归一化
 *   - 播放地址的音质选择、失败回退与试听
 *   - 登录态与用户信息
 *
 * UI 只依赖这里导出的函数和类型，不直接接触 registry / core。
 */

import { getCookieJar, getAuth, hasLogin, removeCookieValue, setCookieObject, setCookieValue, clearAuth } from './core/jar';
import { getSettings } from './core/config';
import { callModule, callModuleBody } from './registry';
import {
  extractList,
  findFirstWith,
  flattenAlbumBuckets,
  flattenNumberedObject,
  normalizeAlbum,
  normalizeArtist,
  normalizePlaylist,
  normalizeRank,
  normalizeSong,
  QUALITY_RANK,
  type Album,
  type Artist,
  type Playlist,
  type Quality,
  type Rank,
  type Song,
  type SongQuality,
} from './normalize';

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

/** 把接口错误转成适合 UI 展示的文案 */
export function toErrorMessage(error: unknown): string {
  const anyError = error as any;
  const body = anyError?.body;
  const message =
    body?.error ||
    body?.msg ||
    body?.error_msg ||
    body?.message ||
    anyError?.message ||
    (typeof error === 'string' ? error : '');
  const code = body?.error_code ?? body?.errcode;
  if (code === 20028) return '请求触发安全验证，请稍后再试或先登录';
  if (code === 20010) return '参数不正确或内容不可用';
  if (typeof message === 'string' && message.trim()) return message.trim();
  return '网络请求失败，请检查网络后重试';
}

/** 安全执行一个接口，失败时返回兜底值 */
async function safe<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// 设备注册
// ---------------------------------------------------------------------------

let registerPromise: Promise<string | null> | null = null;
let lastRegisterFailure = 0;
/** 注册失败后的冷却时间：酷狗按 IP 限流，短时间重复调用只会继续返回空数据 */
const REGISTER_COOLDOWN = 60_000;

/** dfid 必须是真实字符串；服务端偶发返回 "undefined"/"null" 时视为无效 */
function isValidDfid(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return Boolean(text) && text !== 'undefined' && text !== 'null' && text !== '-';
}

/**
 * 复用标准版 Cookie 里已经注册过的 dfid。
 *
 * App 现在固定使用概念版，但老版本可能把 dfid 写在 `...cookies.v1.standard`
 * 里。dfid 本质是设备标识，与平台无关，直接迁移可以避免再次触发注册限流。
 */
function inheritDfid(): string | null {
  if (getSettings().platform !== 'lite') return null;
  const standardDfid = getCookieJar('standard').dfid;
  if (!isValidDfid(standardDfid)) return null;
  setCookieValue('dfid', standardDfid, 'lite');
  return standardDfid;
}

/**
 * 确保存在 dfid。
 *
 * 酷狗的播放地址接口要求先调用 `/register/dev`，否则会返回
 * “本次请求需要验证”（errcode 20028）。App 启动时静默调用一次。
 */
export async function ensureDfid(force = false): Promise<string | null> {
  const existing = getCookieJar().dfid;
  if (!force && isValidDfid(existing)) return existing;
  // 清掉历史版本可能写入的 "undefined"，避免它继续覆盖请求里的 dfid
  if (existing && !isValidDfid(existing)) removeCookieValue('dfid');

  const inherited = inheritDfid();
  if (!force && inherited) return inherited;

  if (registerPromise) return registerPromise;
  if (!force && lastRegisterFailure && Date.now() - lastRegisterFailure < REGISTER_COOLDOWN) {
    return null;
  }

  registerPromise = (async () => {
    try {
      const body = await callModuleBody('/register/dev');
      const dfid = body?.data?.dfid;
      if (isValidDfid(dfid)) {
        setCookieValue('dfid', dfid);
        lastRegisterFailure = 0;
        return dfid;
      }
      lastRegisterFailure = Date.now();
      return null;
    } catch {
      lastRegisterFailure = Date.now();
      return null;
    } finally {
      registerPromise = null;
    }
  })();

  return registerPromise;
}

// ---------------------------------------------------------------------------
// 用户 Auth（概念版免费听）
// ---------------------------------------------------------------------------

let authPromise: Promise<string> | null = null;
let lastAuthFailure = 0;

/**
 * 确保登录用户拥有 `auth`。
 *
 * 概念版的免费听不是 `free_part` 试听，而是通过 Auth 版地址接口
 * （`/song/url/auth/merge`）为登录用户返回完整的 128K 音频。
 * `/user/verify` 会返回 `auth`，模块会把它写回 Cookie，这里再做一层兜底。
 */
export async function ensureUserAuth(force = false): Promise<string> {
  if (!hasLogin()) return '';
  const existing = getCookieJar().auth;
  if (!force && typeof existing === 'string' && existing.length >= 8) return existing;
  if (authPromise) return authPromise;
  if (!force && lastAuthFailure && Date.now() - lastAuthFailure < 30_000) {
    return typeof existing === 'string' ? existing : '';
  }

  authPromise = (async () => {
    try {
      await ensureDfid().catch(() => null);
      const response = await callModule('/user/verify');
      const auth = response?.body?.data?.auth;
      if (typeof auth === 'string' && auth) {
        setCookieValue('auth', auth);
        lastAuthFailure = 0;
        return auth;
      }
      const saved = getCookieJar().auth;
      if (typeof saved === 'string' && saved) {
        lastAuthFailure = 0;
        return saved;
      }
      lastAuthFailure = Date.now();
      return '';
    } catch {
      lastAuthFailure = Date.now();
      return '';
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

/** 主动作废 auth（退出登录或接口返回鉴权失败时调用） */
export function resetUserAuth(): void {
  lastAuthFailure = 0;
  authPromise = null;
}

/** 判断响应是否属于“设备未注册/需要安全验证” */
function isVerificationError(body: any): boolean {
  if (!body || typeof body !== 'object') return false;
  const code = Number(body.errcode ?? body.error_code ?? 0);
  const text = String(body.error || body.msg || '');
  return code === 20028 || text.includes('需要验证');
}

// ---------------------------------------------------------------------------
// 首页
// ---------------------------------------------------------------------------

export interface HomeData {
  discover: Song[];
  /** 概念版「免费听」推荐（/ai/recommend/song） */
  conceptSongs: Song[];
  playlists: Playlist[];
  ranks: Rank[];
  newSongs: Song[];
  newAlbums: Album[];
}

/** 发现页推荐歌曲（公开接口） */
export async function getDiscoverSongs(pageSize = 6): Promise<Song[]> {
  const body = await callModuleBody('/home/discover', { pagesize: pageSize });
  const items = body?.data?.items || [];
  return items
    .filter((item: any) => item?.item_type === 'song' && item?.song_info)
    .map((item: any) => normalizeSong(item.song_info, 'discover'));
}

/**
 * 概念版「免费听」推荐歌曲。
 *
 * 接口返回的歌曲与普通歌曲结构略有差异，可能包在 song_info / audio_info 里，
 * 这里做一次兼容拆分后再统一归一化。接口失败不影响首页其它区块。
 */
export async function getConceptRecommendSongs(pageSize = 10): Promise<Song[]> {
  const body = await callModuleBody('/ai/recommend/song', { page: 1, pagesize: pageSize });
  const candidates = [
    body?.data?.song_list,
    body?.data?.lists,
    body?.data?.songs,
    body?.data?.info,
    body?.data?.recommend_songs,
    extractList(body),
  ];
  const list = candidates.find((item) => Array.isArray(item) && item.length) || [];
  return list.map((item: any) => normalizeSong(item?.song_info || item?.audio_info || item, 'concept'));
}

/** 推荐歌单 */
export async function getTopPlaylists(pageSize = 12): Promise<Playlist[]> {
  const body = await callModuleBody('/top/playlist', {
    category_id: 0,
    pagesize: pageSize,
    withsong: 0,
    withtag: 0,
  });
  const list = body?.data?.special_list || body?.data?.info || body?.data?.lists || [];
  return list.map((item: any) => normalizePlaylist(item));
}

/** 排行榜列表 */
export async function getRankList(): Promise<Rank[]> {
  const body = await callModuleBody('/rank/list', { withsong: 0 });
  const list = body?.data?.info || body?.data?.list || [];
  return list.map((item: any) => normalizeRank(item));
}

/** 新歌速递 */
export async function getNewSongs(pageSize = 12): Promise<Song[]> {
  const body = await callModuleBody('/top/song', { pagesize: pageSize });
  return flattenNumberedObject(body).map((item: any) => normalizeSong(item, 'new-song'));
}

/** 新碟上架 */
export async function getNewAlbums(pageSize = 12): Promise<Album[]> {
  const body = await callModuleBody('/top/album', { pagesize: pageSize });
  return flattenAlbumBuckets(body).map((item: any) => normalizeAlbum(item));
}

/** 首页一次性加载；单个接口失败不影响其他区块 */
export async function getHomeData(): Promise<HomeData> {
  await ensureDfid().catch(() => null);
  const [discover, conceptSongs, playlists, ranks, newSongs, newAlbums] = await Promise.all([
    safe(() => getDiscoverSongs(6), []),
    safe(() => getConceptRecommendSongs(10), []),
    safe(() => getTopPlaylists(12), []),
    safe(() => getRankList(), []),
    safe(() => getNewSongs(12), []),
    safe(() => getNewAlbums(12), []),
  ]);
  return { discover, conceptSongs, playlists, ranks, newSongs, newAlbums };
}

// ---------------------------------------------------------------------------
// 搜索
// ---------------------------------------------------------------------------

export interface SongSearchResult {
  songs: Song[];
  total: number;
}

export interface AlbumSearchResult {
  albums: Album[];
  total: number;
}

export interface ArtistSearchResult {
  artists: Artist[];
  total: number;
}

export interface PlaylistSearchResult {
  playlists: Playlist[];
  total: number;
}

export async function searchSongs(keyword: string, page = 1, pageSize = 30): Promise<SongSearchResult> {
  const body = await callModuleBody('/search', { type: 'song', keywords: keyword, page, pagesize: pageSize });
  const list = body?.data?.lists || [];
  return { songs: list.map((item: any) => normalizeSong(item, 'search')), total: Number(body?.data?.total || 0) };
}

export async function searchAlbums(keyword: string, page = 1, pageSize = 20): Promise<AlbumSearchResult> {
  const body = await callModuleBody('/search', { type: 'album', keywords: keyword, page, pagesize: pageSize });
  const list = body?.data?.lists || [];
  return { albums: list.map((item: any) => normalizeAlbum(item)), total: Number(body?.data?.total || 0) };
}

export async function searchArtists(keyword: string, page = 1, pageSize = 20): Promise<ArtistSearchResult> {
  const body = await callModuleBody('/search', { type: 'author', keywords: keyword, page, pagesize: pageSize });
  const list = body?.data?.lists || [];
  return { artists: list.map((item: any) => normalizeArtist(item)), total: Number(body?.data?.total || 0) };
}

export async function searchPlaylists(keyword: string, page = 1, pageSize = 20): Promise<PlaylistSearchResult> {
  const body = await callModuleBody('/search', { type: 'special', keywords: keyword, page, pagesize: pageSize });
  const list = body?.data?.lists || [];
  return {
    playlists: list.map((item: any) => normalizePlaylist({ ...item, global_collection_id: item.gid })),
    total: Number(body?.data?.total || 0),
  };
}

/** 热搜词 */
export async function getHotSearches(): Promise<string[]> {
  const body = await callModuleBody('/search/hot');
  const groups = body?.data?.list || [];
  const words: string[] = [];
  for (const group of groups) {
    for (const item of group?.keywords || []) {
      if (item?.keyword) words.push(String(item.keyword));
    }
  }
  return [...new Set(words)].slice(0, 20);
}

/** 搜索联想词 */
export async function getSearchSuggestions(keyword: string): Promise<string[]> {
  if (!keyword.trim()) return [];
  const body = await callModuleBody('/search/suggest', { keywords: keyword });
  const groups = Array.isArray(body?.data) ? body.data : [];
  const words: string[] = [];
  for (const group of groups) {
    for (const item of group?.RecordDatas || []) {
      if (item?.HintInfo) words.push(String(item.HintInfo));
    }
  }
  return [...new Set(words)].slice(0, 10);
}

// ---------------------------------------------------------------------------
// 歌单 / 专辑 / 歌手 / 排行榜
// ---------------------------------------------------------------------------

export interface PlaylistPage {
  playlist: Playlist | null;
  songs: Song[];
  total: number;
  hasMore: boolean;
}

export async function getPlaylistPage(id: string, page = 1, pageSize = 50): Promise<PlaylistPage> {
  // 用户自建/收藏的歌单使用数字 listid，需要走 cloudlist 的新版接口；
  // 公开歌单使用 collection_xxx 形式的 global_collection_id。
  const isUserList = /^\d+$/.test(id);
  const body = isUserList
    ? await callModuleBody('/playlist/track/all/new', { listid: id, page, pagesize: pageSize })
    : await callModuleBody('/playlist/track/all', { id, page, pagesize: pageSize });

  const data = body?.data || body || {};
  const rawSongs = data.songs || data.lists || data.info || [];
  const songs = rawSongs.map((item: any) => normalizeSong(item, 'playlist'));
  const infoCandidate = data.list_info || data.info;
  const info =
    infoCandidate && typeof infoCandidate === 'object' && !Array.isArray(infoCandidate)
      ? infoCandidate
      : {};
  const total = Number(data.count || data.total || info.count || songs.length);

  let playlist: Playlist | null = null;
  if (page === 1) {
    if (Object.keys(info).length) {
      playlist = normalizePlaylist({
        ...info,
        // 避免把数字 listid 当成公开歌单 id
        global_collection_id: isUserList ? undefined : info.global_collection_id || id,
        listid: isUserList ? id : info.listid,
      });
    } else if (isUserList && hasLogin()) {
      // 新版接口不返回歌单资料时，从用户歌单列表里补全封面和名称
      const lists = await getUserPlaylists().catch(() => []);
      playlist = lists.find((item) => item.listId === id || item.id === id) || null;
    }
  }

  return {
    playlist,
    songs,
    total,
    hasMore: songs.length > 0 && page * pageSize < total,
  };
}

export interface AlbumDetail {
  album: Album;
  songs: Song[];
  total: number;
  hasMore: boolean;
}

export async function getAlbumDetail(id: string, page = 1, pageSize = 50): Promise<AlbumDetail> {
  const [detailBody, songsBody] = await Promise.all([
    page === 1 ? callModuleBody('/album/detail', { id }) : Promise.resolve(null),
    callModuleBody('/album/songs', { id, page, pagesize: pageSize }),
  ]);
  const detailRaw = detailBody?.data ? (Array.isArray(detailBody.data) ? detailBody.data[0] : detailBody.data) : {};
  const rawSongs = extractList(songsBody);
  const songs = rawSongs.map((item: any) => normalizeSong(item, 'album'));
  const total = Number(songsBody?.data?.total || songsBody?.total || songs.length || 0);
  return {
    album: normalizeAlbum(detailRaw || {}),
    songs,
    total,
    hasMore: songs.length > 0 && page * pageSize < total,
  };
}

export interface ArtistDetail {
  artist: Artist;
  songs: Song[];
  albums: Album[];
  songTotal: number;
  albumTotal: number;
}

export async function getArtistDetail(id: string, page = 1, pageSize = 30): Promise<ArtistDetail> {
  const [detailBody, songsBody, albumsBody] = await Promise.all([
    callModuleBody('/artist/detail', { id }),
    callModuleBody('/artist/audios/new', { id, page, pagesize: pageSize, sort: 'hot' }),
    callModuleBody('/artist/albums', { id, page: 1, pagesize: 12, sort: 'hot' }),
  ]);
  const detailRaw = Array.isArray(detailBody?.data) ? detailBody.data[0] : detailBody?.data || {};
  const songs = extractList(songsBody).map((item: any) => normalizeSong(item, 'artist'));
  const albums = extractList(albumsBody).map((item: any) => normalizeAlbum(item));
  return {
    artist: normalizeArtist(detailRaw || {}),
    songs,
    albums,
    songTotal: Number(songsBody?.data?.total || songsBody?.total || detailRaw?.song_count || songs.length),
    // /artist/albums 不返回总数，用歌手详情里的 album_count 兜底；
    // 否则“加载更多专辑”会误以为只有第一页。
    albumTotal: Number(
      albumsBody?.data?.total || albumsBody?.total || detailRaw?.album_count || albums.length,
    ),
  };
}

/** 歌手歌曲分页（歌手页“加载更多”使用） */
export async function getArtistSongs(
  id: string,
  page = 1,
  pageSize = 30,
): Promise<{ songs: Song[]; total: number }> {
  const body = await callModuleBody('/artist/audios/new', { id, page, pagesize: pageSize, sort: 'hot' });
  const songs = extractList(body).map((item: any) => normalizeSong(item, 'artist'));
  return { songs, total: Number(body?.data?.total || body?.total || songs.length) };
}

/** 歌手专辑分页 */
export async function getArtistAlbums(
  id: string,
  page = 1,
  pageSize = 12,
): Promise<{ albums: Album[]; total: number }> {
  const body = await callModuleBody('/artist/albums', { id, page, pagesize: pageSize, sort: 'hot' });
  const albums = extractList(body).map((item: any) => normalizeAlbum(item));
  // 该接口按数组分页，不提供 total；返回 0 让调用方沿用歌手详情的总数
  return { albums, total: Number(body?.data?.total || body?.total || 0) };
}

export interface RankDetail {
  rank: Rank;
  songs: Song[];
  total: number;
  hasMore: boolean;
}

export async function getRankDetail(rankid: string, rankCid = '', page = 1, pageSize = 50): Promise<RankDetail> {
  const [infoBody, songsBody] = await Promise.all([
    // 榜单信息失败时仍然展示歌曲列表，名称用路由页兜底
    page === 1 ? callModuleBody('/rank/info', { rankid, rank_cid: rankCid }).catch(() => null) : Promise.resolve(null),
    callModuleBody('/rank/audio', { rankid, rank_cid: rankCid, page, pagesize: pageSize }),
  ]);
  const infoRaw = Array.isArray(infoBody?.data) ? infoBody.data[0] : infoBody?.data || {};
  const rawSongs = songsBody?.data?.songlist || songsBody?.data?.audio_list || extractList(songsBody);
  const songs = rawSongs.map((item: any) => normalizeSong(item, 'rank'));
  const total = Number(songsBody?.data?.total || songsBody?.total || songs.length);
  return {
    rank: normalizeRank(infoRaw || {}),
    songs,
    total,
    hasMore: songs.length > 0 && page * pageSize < total,
  };
}

// ---------------------------------------------------------------------------
// 播放地址
// ---------------------------------------------------------------------------

export interface PlayableUrl {
  /** 首选播放地址 */
  url: string;
  /** CDN 备用地址（主地址 4xx/超时/解码失败时依次尝试） */
  fallbackUrls: string[];
  /** 是否为 60 秒试听片段 */
  preview: boolean;
  /** 概念版免费听：登录后获得的完整标准音质，不是试听 */
  freeListen: boolean;
  quality: Quality;
  expiresAt: number;
}

const urlCache = new Map<string, PlayableUrl>();
let cachePlatform = getSettings().platform;

function currentCachePlatform(): string {
  const platform = getSettings().platform;
  if (platform !== cachePlatform) {
    cachePlatform = platform;
    urlCache.clear();
  }
  return platform;
}

/**
 * 列出所有可尝试的音质，从请求音质向下回退。
 *
 * 例如请求 320 时会依次尝试 320、128；这样会员歌曲在只有标准音质
 * 权限时仍然可以播放，而不是直接报错。
 */
export function qualityCandidates(song: Song, quality: Quality): SongQuality[] {
  const requested = QUALITY_RANK[quality] ?? 0;
  const list = song.qualities
    .filter((item) => QUALITY_RANK[item.quality] <= requested && item.hash)
    .sort((a, b) => QUALITY_RANK[b.quality] - QUALITY_RANK[a.quality]);

  // 搜索结果偶尔缺少 128 条目；song.hash 本身就是 128K hash，补一个兜底
  if (!list.some((item) => item.quality === '128') && song.hash) {
    list.push({ quality: '128', hash: song.hash });
  }

  // 多音质接口偶尔返回相同 hash，去重避免重复请求
  const seen = new Set<string>();
  return list.filter((item) => {
    if (!item.hash || seen.has(item.hash)) return false;
    seen.add(item.hash);
    return true;
  });
}

/** 按请求音质挑选 hash；没有目标音质时向下回退 */
export function pickQuality(song: Song, quality: Quality): SongQuality {
  return qualityCandidates(song, quality)[0] || { quality: '128', hash: song.hash };
}

/** 从任意响应结构中提取 http(s) 地址（url / backupUrl / data.url 等） */
function collectHttpUrls(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === 'string') {
    return /^https?:\/\//i.test(value) ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectHttpUrls(item, depth + 1));
  }
  if (typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const keys = ['url', 'urls', 'backupUrl', 'backup_url', 'play_url', 'playUrl'];
  const direct = keys.flatMap((key) => collectHttpUrls(record[key], depth + 1));
  if (direct.length) return direct;

  // 只继续展开常见的包装层，避免把整个响应树都扫一遍
  return ['data', 'result'].flatMap((key) => collectHttpUrls(record[key], depth + 1));
}

/**
 * 主地址优先使用 https；同时保留 http 版本作为备用。
 *
 * 部分酷狗 CDN 节点没有配置证书，或只允许明文访问。播放器在
 * `error` 事件里会依次尝试备用地址，因此不需要在这里猜测哪个可用。
 */
function buildUrlVariants(url: string): string[] {
  const clean = url.trim();
  if (!clean) return [];
  if (/^http:\/\//i.test(clean)) {
    return [...new Set([clean.replace(/^http:/i, 'https:'), clean])];
  }
  if (/^https:\/\//i.test(clean)) {
    return [...new Set([clean, clean.replace(/^https:/i, 'http:')])];
  }
  return [clean];
}

/** 提取响应里的全部播放地址（已展开主/备 CDN 与协议变体） */
function extractUrls(body: any): string[] {
  const urls: string[] = [];
  for (const raw of collectHttpUrls(body)) {
    for (const variant of buildUrlVariants(raw)) {
      if (!urls.includes(variant)) urls.push(variant);
    }
  }
  return urls;
}

/** 接口模块失败时会 reject 一个 { status, body }，这里统一取出响应体 */
async function requestBody(task: () => Promise<any>): Promise<any> {
  try {
    return await task();
  } catch (error) {
    return (error as any)?.body || null;
  }
}

function rememberPlayable(
  cacheKey: string,
  urls: string[],
  quality: Quality,
  preview: boolean,
  freeListen: boolean,
): PlayableUrl {
  const [url, ...fallbackUrls] = urls;
  const result: PlayableUrl = {
    url,
    fallbackUrls,
    preview,
    freeListen,
    quality,
    // 试听/免费听地址的有效期更短；完整地址缓存 15 分钟
    expiresAt: Date.now() + (preview ? 5 : 15) * 60 * 1000,
  };
  urlCache.set(cacheKey, result);
  return result;
}

/**
 * 获取播放地址（概念版）。
 *
 * 依次尝试：
 *   1. `/song/url`：免费歌曲、会员账号直接返回完整地址；
 *   2. `/song/url/auth/merge`：登录后为付费歌曲返回完整 128K 免费听地址；
 *   3. `/song/url` + `free_part`：最后兜底为 60 秒试听。
 *
 * 每一步都会按请求音质向下回退，并保留 CDN 备用地址。
 */
export async function getSongUrl(
  song: Song,
  quality: Quality = getSettings().quality,
  force = false,
): Promise<PlayableUrl> {
  const cacheKey = `${currentCachePlatform()}:${quality}:${song.hash || song.id}`;
  const cached = urlCache.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now()) return cached;

  await ensureDfid().catch(() => null);

  const candidates = qualityCandidates(song, quality);
  let lastBody: any = null;
  let verificationRetried = false;

  const regularRequest = (candidate: SongQuality, freePart: boolean) =>
    callModule('/song/url', {
      hash: candidate.hash,
      album_id: song.albumId,
      album_audio_id: song.albumAudioId,
      quality: candidate.quality,
      free_part: freePart,
    }).then((response) => response.body);

  // 1. 常规地址
  for (const candidate of candidates) {
    let body = await requestBody(() => regularRequest(candidate, false));
    lastBody = body || lastBody;

    // 设备注册偶发失败时重新注册并重试一次（否则只会得到 20028）
    if (!extractUrls(body).length && isVerificationError(body) && !verificationRetried) {
      verificationRetried = true;
      const dfid = await ensureDfid(true).catch(() => null);
      if (dfid) {
        body = await requestBody(() => regularRequest(candidate, false));
        lastBody = body || lastBody;
      }
    }

    const urls = extractUrls(body);
    if (urls.length) return rememberPlayable(cacheKey, urls, candidate.quality, false, false);
  }

  // 2. 概念版免费听（完整标准音质，需要登录 + auth）
  if (getSettings().platform === 'lite' && hasLogin()) {
    const auth = await ensureUserAuth();
    if (auth) {
      for (const candidate of candidates) {
        const body = await requestBody(() =>
          callModule('/song/url/auth/merge', {
            hash: candidate.hash,
            album_id: song.albumId,
            album_audio_id: song.albumAudioId,
            quality: candidate.quality,
            auth,
          }).then((response) => response.body),
        );
        lastBody = body || lastBody;
        const urls = extractUrls(body);
        if (urls.length) {
          // 免费听是完整音频，不是 60 秒片段；只有标准音质（128）适用
          return rememberPlayable(cacheKey, urls, candidate.quality, false, candidate.quality === '128');
        }
      }
    }
  }

  // 3. 60 秒试听兜底
  for (const candidate of candidates) {
    const body = await requestBody(() => regularRequest(candidate, true));
    lastBody = body || lastBody;
    const urls = extractUrls(body);
    if (urls.length) return rememberPlayable(cacheKey, urls, candidate.quality, true, false);
  }

  throw new Error(playbackErrorText(lastBody, song));
}

/** 生成可操作的播放失败提示（区分未登录、设备验证、版权限制） */
function playbackErrorText(body: any, song: Song): string {
  if (isVerificationError(body)) {
    return '设备验证失败，请稍后重试（酷狗可能临时限流）';
  }
  const message = body?.error || body?.msg || body?.error_msg;
  if (typeof message === 'string' && message.trim() && !/^请求失败$/i.test(message.trim())) {
    return message.trim();
  }
  if (getSettings().platform === 'lite' && !hasLogin() && (song.payType !== 0 || song.privilege !== 0)) {
    return '该歌曲需要登录后使用概念版免费听';
  }
  return '该歌曲暂时无法播放（可能需要更高会员权益或已下架）';
}

/** 清除播放地址缓存（切换平台/音质时调用） */
export function clearUrlCache(): void {
  urlCache.clear();
}

// ---------------------------------------------------------------------------
// 歌词
// ---------------------------------------------------------------------------

export interface LyricResult {
  raw: string;
  /** 逐字/逐行歌词文本 */
  content: string;
  id: string;
}

export async function getLyric(song: Song): Promise<LyricResult> {
  const searchBody = await callModuleBody('/search/lyric', {
    hash: song.hash,
    album_audio_id: song.albumAudioId,
    duration: Math.round(song.duration / 1000),
    keywords: song.name,
  });
  const candidates = searchBody?.candidates || searchBody?.data?.candidates || [];
  if (!candidates.length) throw new Error('没有找到歌词');

  const candidate = candidates[0];
  const body = await callModuleBody('/lyric', {
    id: candidate.id,
    accesskey: candidate.accesskey,
    fmt: 'krc',
    decode: true,
  });
  const content = body?.decodeContent || '';
  if (!content) throw new Error('歌词解码失败');
  return { raw: content, content, id: String(candidate.id) };
}

// ---------------------------------------------------------------------------
// 登录 / 用户
// ---------------------------------------------------------------------------

export interface LoginQr {
  key: string;
  url: string;
  image: string;
}

export interface QrStatus {
  status: number;
  message: string;
  token?: string;
  userid?: string;
}

/** 生成扫码登录二维码（仅生成，不会触发任何短信） */
export async function createLoginQr(): Promise<LoginQr> {
  const keyBody = await callModuleBody('/login/qr/key', { type: 'web' });
  const key = keyBody?.data?.qrcode || keyBody?.data?.key;
  if (!key) throw new Error('获取二维码 key 失败');

  const imageBody = await callModuleBody('/login/qr/create', { key, qrimg: true });
  const url = imageBody?.data?.url || '';
  const image = imageBody?.data?.base64 || '';
  if (!image) throw new Error('生成二维码失败');
  return { key: String(key), url, image };
}

/** 轮询扫码状态：0 过期，1 等待扫码，2 待确认，4 成功 */
export async function checkLoginQr(key: string): Promise<QrStatus> {
  const response = await callModule('/login/qr/check', { key });
  const body = response?.body;
  const status = Number(body?.data?.status ?? -1);
  const token = body?.data?.token ? String(body.data.token) : undefined;
  const userid = body?.data?.userid ? String(body.data.userid) : undefined;

  if (status === 4 && token && userid) {
    setCookieObject({ token, userid });
  }

  const messages: Record<number, string> = {
    0: '二维码已过期，请点击刷新',
    1: '请使用酷狗音乐 App 扫码',
    2: '已扫码，请在手机上确认登录',
    4: '登录成功',
  };

  return { status, message: messages[status] || '未知状态', token, userid };
}

export interface UserProfile {
  userid: string;
  nickname: string;
  avatar: string;
  vipType: number;
  signature: string;
  fans: number;
  follows: number;
}

export async function getUserProfile(): Promise<UserProfile> {
  const body = await callModuleBody('/user/detail');
  const data = Array.isArray(body?.data) ? body.data[0] : body?.data || {};
  return {
    userid: String(data?.userid || getAuth().userid || '0'),
    nickname: String(data?.nickname || data?.username || '酷狗用户'),
    avatar: String(data?.pic || data?.user_pic || data?.avatar || ''),
    vipType: Number(data?.vip_type || 0),
    signature: String(data?.signature || data?.intro || ''),
    fans: Number(data?.fans || data?.fans_count || 0),
    follows: Number(data?.follows || data?.follow_count || 0),
  };
}

export async function getUserPlaylists(): Promise<Playlist[]> {
  const body = await callModuleBody('/user/playlist', { page: 1, pagesize: 50 });
  const list = extractList(body);
  return list
    .filter((item: any) => item && (item.global_collection_id || item.listid || item.name))
    .map((item: any) => {
      const playlist = normalizePlaylist(item);
      // 用户歌单统一用 listid 打开：创建和收藏的歌单都支持新版接口
      if (playlist.listId) playlist.id = playlist.listId;
      return playlist;
    });
}

/** 当前登录态 */
export function isLoggedIn(): boolean {
  return hasLogin();
}

export { clearAuth };

// ---------------------------------------------------------------------------
// 杂项
// ---------------------------------------------------------------------------

/** 首页搜索框默认占位词 */
export const DEFAULT_SEARCH_KEYWORD = '周杰伦';

/** 排行榜首个榜单的 id（用于“排行榜”页入口） */
export const DEFAULT_RANK_ID = '8888';

/** 从搜索结果里挑一个可完整播放的免费歌曲（调试/示例用） */
export function findFreeSong(songs: Song[]): Song | undefined {
  return songs.find((song) => song.payType === 0);
}
