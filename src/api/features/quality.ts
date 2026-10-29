/**
 * 歌曲音质与封面补齐。
 *
 * 云歌单（`/playlist/track/all/new` → `/v4/get_list_all_file_v3`）在部分
 * 账号或版本下只返回 128K hash，归一化后整首歌曲只有一个音质；此时切换
 * 320K/无损会一直回退到 128K。这里调用概念版权益接口 `/privilege/lite`
 * 批量补齐每个音质的 hash（128/320 优先使用 OGG hash）。
 *
 * 封面缺失同理：云歌单行可能不带封面，但它的 album_id 仍可通过
 * `/album/detail` 取到 `sizable_cover`。封面和音质都带缓存，
 * 翻页/重复进入不会重复请求。
 */

import { callModuleBody } from '../registry';
import { QUALITY_RANK, type Quality, type Song, type SongQuality } from '../normalize';
import { normalizeImage } from '../core/util';
import { num, pick, text } from './common';

/** 权益接口返回的单个音质明细 */
export interface PrivilegeQuality {
  quality: Quality;
  /** 该音质可播放的 hash；概念版 128/320 为 OGG 资源 */
  hash: string;
  size: number;
  exists: boolean;
  obtainable: boolean;
  needVip: boolean;
  freeListen: boolean;
  /** 需要的会员类型：suvip / concept / 空字符串 */
  requireVipType: string;
}

/** 一首歌的概念版权益信息 */
export interface SongPrivilegeInfo {
  freeListen: boolean;
  bestFreeQuality: string;
  qualities: PrivilegeQuality[];
  freeQualities: string[];
  vipQualities: string[];
  raw: any;
}

const QUALITY_ORDER: Quality[] = ['128', '320', 'flac', 'high', 'super'];
const QUALITY_SET = new Set<string>(QUALITY_ORDER);

function toQuality(value: unknown): Quality | null {
  const key = text(value).toLowerCase();
  return QUALITY_SET.has(key) ? (key as Quality) : null;
}

/** 兼容数组和逗号分隔字符串 */
function toQualityList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  return text(value)
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePrivilegeItem(item: any): SongPrivilegeInfo | null {
  if (!item || typeof item !== 'object') return null;

  const qualities: PrivilegeQuality[] = [];
  for (const raw of Array.isArray(item.qualities) ? item.qualities : []) {
    const quality = toQuality(raw?.quality);
    if (!quality) continue;
    qualities.push({
      quality,
      hash: text(raw?.hash),
      size: num(raw?.size),
      exists: Boolean(raw?.exists),
      obtainable: Boolean(raw?.obtainable),
      needVip: Boolean(raw?.need_vip),
      freeListen: Boolean(raw?.free_listen),
      requireVipType: text(raw?.require_vip_type),
    });
  }
  if (!qualities.length) return null;

  qualities.sort((a, b) => QUALITY_RANK[a.quality] - QUALITY_RANK[b.quality]);
  return {
    freeListen: Boolean(item.free_listen),
    bestFreeQuality: text(item.best_free_quality),
    qualities,
    freeQualities: toQualityList(item.free_qualities),
    vipQualities: toQualityList(pick(item.vip_qualities, item.super_vip_qualities)),
    raw: item,
  };
}

// ---------------------------------------------------------------------------
// 权益（音质 hash）缓存与批量查询
// ---------------------------------------------------------------------------

const PRIVILEGE_TTL = 10 * 60 * 1000;
const PRIVILEGE_CACHE_LIMIT = 600;
/** 上游一次 resource 数组不宜过大，分批查询避免响应超时 */
const PRIVILEGE_CHUNK_SIZE = 20;

const privilegeCache = new Map<string, { at: number; info: SongPrivilegeInfo }>();

function privilegeKey(song: Song): string {
  return (song?.hash || '').trim().toLowerCase();
}

function readPrivilegeCache(key: string): SongPrivilegeInfo | null {
  const hit = privilegeCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > PRIVILEGE_TTL) {
    privilegeCache.delete(key);
    return null;
  }
  return hit.info;
}

function writePrivilegeCache(key: string, info: SongPrivilegeInfo): void {
  if (privilegeCache.size >= PRIVILEGE_CACHE_LIMIT) {
    const oldest = privilegeCache.keys().next().value;
    if (oldest) privilegeCache.delete(oldest);
  }
  privilegeCache.set(key, { at: Date.now(), info });
}

/**
 * 批量查询歌曲权益。
 *
 * 返回的 Map 以 `song.hash`（小写）为键；失败/无结果的歌曲不会出现在
 * Map 里，调用方保留原有音质信息即可。
 */
export async function fetchSongPrivileges(songs: Song[]): Promise<Map<string, SongPrivilegeInfo>> {
  const result = new Map<string, SongPrivilegeInfo>();
  const pending: Song[] = [];
  const seen = new Set<string>();

  for (const song of songs) {
    const key = privilegeKey(song);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const cached = readPrivilegeCache(key);
    if (cached) result.set(key, cached);
    else pending.push(song);
  }

  for (let start = 0; start < pending.length; start += PRIVILEGE_CHUNK_SIZE) {
    const chunk = pending.slice(start, start + PRIVILEGE_CHUNK_SIZE);
    try {
      const body = await callModuleBody('/privilege/lite', {
        hash: chunk.map((song) => song.hash).join(','),
        // album_id 与 hash 顺序一一对应；没有专辑 id 时传 0
        album_id: chunk.map((song) => song.albumId || 0).join(','),
        qualities: QUALITY_ORDER.join(','),
      });
      const items: any[] = Array.isArray(body?.quality_vip) ? body.quality_vip : [];

      for (let index = 0; index < chunk.length; index += 1) {
        const song = chunk[index];
        const key = privilegeKey(song);
        // 上游按请求顺序返回；多曲时优先按 hash 匹配，避免顺序错位
        const item =
          items.find((entry: any) => text(entry?.hash).toLowerCase() === key) || items[index];
        const info = parsePrivilegeItem(item);
        if (!info) continue;
        writePrivilegeCache(key, info);
        result.set(key, info);
      }
    } catch {
      // 权益接口失败不影响播放：保留调用方已有的音质信息
    }
  }

  return result;
}

/** 单曲权益（播放地址补齐/详情页使用） */
export async function getSongPrivilegeInfo(song: Song): Promise<SongPrivilegeInfo | null> {
  const key = privilegeKey(song);
  if (!key) return null;
  const cached = readPrivilegeCache(key);
  if (cached) return cached;
  const map = await fetchSongPrivileges([song]);
  return map.get(key) || null;
}

/**
 * 把权益接口的音质合并进歌曲。
 *
 * 权益接口的 hash 是权威数据（128/320 为 OGG），因此同音质时覆盖歌曲
 * 里原有的 hash；歌曲已有但权益接口未返回的音质会保留。
 */
export function applyPrivilegeToSong(song: Song, info: SongPrivilegeInfo): boolean {
  if (!song || !info) return false;

  const merged = new Map<Quality, SongQuality>();
  for (const item of song.qualities || []) {
    if (!item?.hash) continue;
    merged.set(item.quality, { ...item });
  }
  for (const item of info.qualities) {
    if (!item.exists || !item.hash) continue;
    merged.set(item.quality, {
      quality: item.quality,
      hash: item.hash,
      size: item.size || merged.get(item.quality)?.size,
    });
  }

  const next = [...merged.values()].sort(
    (a, b) => QUALITY_RANK[a.quality] - QUALITY_RANK[b.quality],
  );
  const changed =
    next.length !== song.qualities.length ||
    next.some(
      (item, index) =>
        item.quality !== song.qualities[index]?.quality ||
        item.hash !== song.qualities[index]?.hash,
    );

  if (changed) song.qualities = next;
  return changed;
}

/** 批量补齐歌曲音质，返回发生变化的歌曲数量 */
export async function enrichSongsWithQualities(songs: Song[]): Promise<number> {
  const targets = songs.filter((song) => Boolean(song?.hash));
  if (!targets.length) return 0;

  const map = await fetchSongPrivileges(targets);
  let changed = 0;
  for (const song of targets) {
    const info = map.get(privilegeKey(song));
    if (info && applyPrivilegeToSong(song, info)) changed += 1;
  }
  return changed;
}

// ---------------------------------------------------------------------------
// 封面补齐
// ---------------------------------------------------------------------------

const ALBUM_COVER_CACHE_LIMIT = 800;
const COVER_CONCURRENCY = 4;
/** 单次最多补这么多张专辑，避免一次性发出过多请求；其余等下次进入再补 */
const COVER_BATCH_LIMIT = 30;

const albumCoverCache = new Map<string, string>();
const albumCoverInFlight = new Map<string, Promise<string>>();

async function fetchAlbumCover(albumId: string): Promise<string> {
  const cached = albumCoverCache.get(albumId);
  if (cached) return cached;

  const inFlight = albumCoverInFlight.get(albumId);
  if (inFlight) return inFlight;

  const task = (async () => {
    try {
      const body = await callModuleBody('/album/detail', { id: albumId });
      const data = Array.isArray(body?.data) ? body.data[0] : body?.data || {};
      const cover = normalizeImage(
        pick(
          data?.sizable_cover,
          data?.sizableCover,
          data?.imgurl,
          data?.img,
          data?.cover,
          data?.pic,
          data?.album_cover,
        ),
      );
      if (cover) {
        if (albumCoverCache.size >= ALBUM_COVER_CACHE_LIMIT) {
          const oldest = albumCoverCache.keys().next().value;
          if (oldest) albumCoverCache.delete(oldest);
        }
        albumCoverCache.set(albumId, cover);
      }
      return cover;
    } catch {
      return '';
    } finally {
      albumCoverInFlight.delete(albumId);
    }
  })();

  albumCoverInFlight.set(albumId, task);
  return task;
}

/** 接口偶尔用 0 / "null" 表示没有封面 */
function hasUsableCover(value: string): boolean {
  const cover = text(value).toLowerCase();
  return Boolean(cover) && cover !== '0' && cover !== 'null' && cover !== 'undefined';
}

/**
 * 批量补齐封面（原地修改歌曲对象）。
 *
 * 只处理 `cover` 为空且有 albumId 的歌曲；封面按专辑缓存，同一专辑的
 * 多首歌只会请求一次。
 */
export async function enrichSongsWithCovers(songs: Song[]): Promise<number> {
  const targets = songs.filter(
    (song) => song && !hasUsableCover(song.cover) && song.albumId && song.albumId !== '0',
  );
  if (!targets.length) return 0;

  const albumIds = [...new Set(targets.map((song) => song.albumId))].slice(0, COVER_BATCH_LIMIT);
  const covers = new Map<string, string>();

  let cursor = 0;
  const workerCount = Math.min(COVER_CONCURRENCY, albumIds.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < albumIds.length) {
        const albumId = albumIds[cursor];
        cursor += 1;
        const cover = await fetchAlbumCover(albumId);
        if (cover) covers.set(albumId, cover);
      }
    }),
  );

  let changed = 0;
  for (const song of targets) {
    const cover = covers.get(song.albumId);
    if (cover && !hasUsableCover(song.cover)) {
      song.cover = cover;
      changed += 1;
    }
  }
  return changed;
}

/** 清空补齐缓存（退出登录/切换账号时调用） */
export function clearQualityCaches(): void {
  privilegeCache.clear();
  albumCoverCache.clear();
}
