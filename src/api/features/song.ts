/**
 * 歌曲扩展信息与歌手扩展信息。
 *
 * 播放页/歌曲详情用：播放特权、高潮片段、相关版本、K 歌、上榜成绩、MV。
 * 歌手页用：荣誉、关注/取关、关注歌手的新歌。
 */

import { callModuleBody } from '../registry';
import { normalizeRank, normalizeSong, type Rank, type Song, type SongQuality } from '../normalize';
import { arrayFrom, image, num, pick, text } from './common';
import { getSongPrivilegeInfo } from './quality';

/** 概念版播放特权（/privilege/lite） */
export interface SongPrivilege {
  /** 是否可以免费听完整版 */
  freeListen: boolean;
  /** 免费听的最佳音质 */
  bestFreeQuality: string;
  /** 可用的全部音质 */
  qualities: string[];
  freeQualities: string[];
  vipQualities: string[];
  /** 每个音质的可播放 hash（概念版 128/320 为 OGG） */
  qualityHashes: SongQuality[];
  /** 原始响应，页面可展示更多字段 */
  raw: any;
}

export async function getSongPrivilege(song: Song): Promise<SongPrivilege> {
  const info = await getSongPrivilegeInfo(song).catch(() => null);
  if (!info) {
    return {
      freeListen: false,
      bestFreeQuality: '',
      qualities: [],
      freeQualities: [],
      vipQualities: [],
      qualityHashes: [],
      raw: null,
    };
  }
  return {
    freeListen: info.freeListen,
    bestFreeQuality: info.bestFreeQuality,
    qualities: info.qualities.filter((item) => item.exists).map((item) => item.quality),
    freeQualities: info.freeQualities,
    vipQualities: info.vipQualities,
    qualityHashes: info.qualities
      .filter((item) => item.exists && item.hash)
      .map((item) => ({
        quality: item.quality,
        hash: item.hash,
        size: item.size || undefined,
      })),
    raw: info.raw,
  };
}

/** 歌曲鉴权（登录后返回 auth，用于免费听合并接口） */
export async function getSongAuth(song: Song): Promise<{ auth: string; openTime: string }> {
  const body = await callModuleBody('/song/auth', {
    hash: song.hash,
    album_id: song.albumId || undefined,
    album_audio_id: song.albumAudioId || undefined,
  });
  return {
    auth: text(pick(body?.data?.auth, body?.auth)),
    openTime: text(pick(body?.data?.open_time, body?.open_time)),
  };
}

export interface Climax {
  start: number;
  end: number;
  duration: number;
  hash: string;
  name: string;
  artist: string;
}

/** 歌曲高潮片段（用于“只播高潮”或进度条标记） */
export async function getSongClimax(song: Song): Promise<Climax | null> {
  const body = await callModuleBody('/song/climax', { hash: song.hash });
  const item = arrayFrom(body, 'data')[0];
  if (!item) return null;
  return {
    start: num(item.start_time),
    end: num(item.end_time),
    duration: num(item.timelength),
    hash: text(item.hash),
    name: text(pick(item.audio_name, song.name)),
    artist: text(pick(item.author_name, song.artist)),
  };
}

/** 相关版本（翻唱 / Live / 伴奏等） */
export async function getRelatedSongs(song: Song, page = 1, pageSize = 30): Promise<{ songs: Song[]; total: number }> {
  const body = await callModuleBody('/audio/related', {
    album_audio_id: song.albumAudioId || song.id,
    page,
    pagesize: pageSize,
    show_detail: 1,
  });
  const candidates = [
    ...arrayFrom(body, 'extra.original'),
    ...arrayFrom(body, 'data'),
    ...arrayFrom(body, 'extra.list'),
    ...arrayFrom(body, 'data.list'),
  ];
  const seen = new Set<string>();
  const songs: Song[] = [];
  for (const item of candidates) {
    // 相关版本接口把歌名/歌手放在外层的 base，音质 hash 放在 audio_info；
    // 直接取 audio_info 会丢掉歌手信息（显示“未知歌手”），这里传入完整条目。
    const normalized = normalizeSong(item, 'related');
    if (!normalized.hash || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    songs.push(normalized);
  }
  return { songs, total: num(pick(body?.total, songs.length)) };
}

/** K 歌作品数量 */
export async function getKtvTotal(song: Song): Promise<number> {
  const body = await callModuleBody('/audio/ktv/total', {
    songId: song.albumAudioId || song.id,
    songHash: song.hash,
    singerName: song.artist,
  });
  return num(pick(body?.data?.total, body?.data?.count, body?.data));
}

export interface RankingItem {
  platform: string;
  name: string;
  logo: string;
  rank: number;
  times: number;
  lastTime: string;
}

export interface SongRanking {
  title: string;
  subtitle: string;
  items: RankingItem[];
}

/** 歌曲上榜成绩（全球各音乐平台） */
export async function getSongRanking(song: Song): Promise<SongRanking> {
  const body = await callModuleBody('/song/ranking', { album_audio_id: song.albumAudioId || song.id });
  const data = body?.data || {};
  return {
    title: text(data.title1) || '上榜成绩',
    subtitle: text(data.title2),
    items: arrayFrom(data, 'info').map((item) => ({
      platform: text(item.platform),
      name: text(item.platform_name),
      logo: image(item.platform_logo, 120),
      rank: num(item.ranking_num),
      times: num(item.ranking_times),
      lastTime: text(item.last_time),
    })),
  };
}

/** 榜单的成绩详情（按平台） */
export async function getSongRankingFilter(song: Song, page = 1, pageSize = 20): Promise<any[]> {
  const body = await callModuleBody('/song/ranking/filter', {
    album_audio_id: song.albumAudioId || song.id,
    page,
    pagesize: pageSize,
  });
  return arrayFrom(body, 'data.list', 'data.info', 'data');
}

// ---------------------------------------------------------------------------
// 歌手扩展
// ---------------------------------------------------------------------------

export interface ArtistHonour {
  id: string;
  name: string;
  desc: string;
  icon: string;
  time: string;
}

/** 歌手荣誉 */
export async function getArtistHonours(artistId: string): Promise<ArtistHonour[]> {
  const body = await callModuleBody('/artist/honour', { id: artistId, page: 1, pagesize: 50 });
  return arrayFrom(body, 'data.list', 'data').map((item) => ({
    id: text(item.id),
    name: text(pick(item.name, item.honour_name, item.title)),
    desc: text(pick(item.desc, item.intro, item.content)),
    icon: image(pick(item.icon, item.pic, item.imgurl), 200),
    time: text(pick(item.time, item.addtime, item.publish_time)),
  }));
}

/** 关注歌手 */
export async function followArtist(artistId: string): Promise<void> {
  await callModuleBody('/artist/follow', { id: artistId });
}

/** 取消关注歌手 */
export async function unfollowArtist(artistId: string): Promise<void> {
  await callModuleBody('/artist/unfollow', { id: artistId });
}

// ---------------------------------------------------------------------------
// 关注歌手新歌
// ---------------------------------------------------------------------------

/** 对象本身是否描述一首歌（用于把歌曲和专辑分组区分开） */
function isSongEntry(value: any): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value.hash ||
        value.FileHash ||
        value.hash_128 ||
        value.audio_info ||
        value.song_info ||
        value.album_audio_id ||
        value.MixSongID ||
        value.audio_id),
  );
}

/**
 * 把数组或“对象套数组”的结构展开成数组。
 *
 * 酷狗的 feed 接口有时把列表包成 `info: { "2026-10-29": [...], ... }`，
 * 这里递归两层即可覆盖，避免只取到第一组。
 */
function arrayValues(value: any, depth = 0): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object' || depth > 2) return [];
  return Object.values(value).flatMap((item) => arrayValues(item, depth + 1));
}

/**
 * 找出响应里真正装着歌曲的数组。
 *
 * `/artist/follow/newsongs` 不同账号/版本返回的字段不统一：
 * 可能是 `data.list`、`data.info`，也可能按日期或专辑再包一层。
 */
function followFeedEntries(body: any): any[] {
  const keys = [
    'list',
    'lists',
    'info',
    'song_list',
    'songs',
    'songlist',
    'song_infos',
    'data_list',
    'album_list',
    'albums',
    'audios',
    'audio_list',
    'items',
    'feed_list',
  ];

  for (const source of [body?.data, body]) {
    if (Array.isArray(source) && source.length) return source;
    if (!source || typeof source !== 'object') continue;

    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value) && value.length) return value;
      // 有些版本把列表再包一层对象，如 info: { "2026-10-29": [歌曲...] }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = arrayValues(value);
        if (nested.length) return nested;
      }
    }
  }

  // 最后兜底：直接从 data 里找出第一组非空数组
  return arrayValues(body?.data);
}

/** 专辑/歌手分组里的歌曲数组 */
function songsInGroup(entry: any): any[] | null {
  const containers = [entry, entry?.data, entry?.album_info, entry?.album, entry?.albuminfo, entry?.base];
  for (const container of containers) {
    if (!container || typeof container !== 'object') continue;
    for (const key of [
      'song_list',
      'songs',
      'songlist',
      'song_infos',
      'audios',
      'audio_list',
      'musics',
      'tracks',
    ]) {
      const value = container[key];
      const songs = arrayValues(value);
      if (songs.length && songs.some(isSongEntry)) return songs;
    }
  }
  return null;
}

/** 把分组（专辑/歌手）上的公共字段补进组内歌曲，避免歌曲缺歌手、专辑和封面 */
function withGroupContext(song: any, group: any): any {
  const album = group?.album_info || group?.album || group?.albuminfo || {};
  const merged: any = { ...song };
  const fill = (key: string, ...values: any[]) => {
    const current = merged[key];
    const missing =
      current === undefined ||
      current === null ||
      current === '' ||
      (Array.isArray(current) && current.length === 0);
    if (!missing) return;
    const value = pick(...values);
    if (value === undefined || (Array.isArray(value) && value.length === 0)) return;
    merged[key] = value;
  };

  // 歌手：分组上可能只有 singer_name / author_name（字符串）
  fill(
    'author_name',
    group?.author_name,
    group?.authorName,
    group?.singer_name,
    group?.singerName,
    group?.singername,
    group?.nickname,
    album?.author_name,
    album?.singer_name,
  );
  // 数组形式的歌手交给 normalize 的 artistNamesOf 处理，不能塞进 author_name
  fill('singers', group?.singers, album?.singers);
  fill('authors', group?.authors, album?.authors);
  fill(
    'author_id',
    group?.author_id,
    group?.authorId,
    group?.singer_id,
    group?.singerid,
    album?.author_id,
    album?.singer_id,
  );
  // 分组把歌手放在单数字段（singer/artist/singerinfo）时，交给 normalize 兼容
  fill('singer', group?.singer, group?.artist, album?.singer, album?.artist);
  fill('singerinfo', group?.singerinfo, group?.singer_list, group?.artists, album?.artists);

  // 专辑与封面：组内歌曲经常省略
  fill('album_id', group?.album_id, group?.albumid, group?.albumId, album?.album_id, album?.albumid, album?.id);
  fill(
    'album_name',
    group?.album_name,
    group?.albumname,
    group?.albumName,
    album?.album_name,
    album?.albumname,
    album?.name,
  );
  fill(
    'sizable_cover',
    group?.sizable_cover,
    group?.sizableCover,
    group?.imgurl,
    group?.img,
    group?.cover,
    group?.pic,
    album?.sizable_cover,
    album?.imgurl,
    album?.img,
    album?.cover,
  );
  fill('trans_param', group?.trans_param);
  return merged;
}

/**
 * 把“关注歌手新歌”的响应拍平成歌曲列表。
 *
 * 接口按新专辑分组返回，组内才是歌曲；直接 normalize 分组对象会导致
 * 整片歌曲显示“未知歌手”。这里统一展开并把分组上的歌手/专辑字段
 * 合并进歌曲。导出便于协议自检脚本在不登录时验证各种结构。
 */
export function flattenFollowNewSongs(body: any): Song[] {
  const songs: Song[] = [];
  const seen = new Set<string>();

  for (const entry of followFeedEntries(body)) {
    if (!entry || typeof entry !== 'object') continue;

    const group = songsInGroup(entry);
    const raws = group
      ? group.map((song) => withGroupContext(song, entry))
      : [isSongEntry(entry) ? entry : entry?.data && isSongEntry(entry.data) ? withGroupContext(entry.data, entry) : entry];

    for (const raw of raws) {
      // 纯专辑/分组对象没有可播放字段，跳过，避免出现“专辑名 + 未知歌手”的假歌曲
      if (!isSongEntry(raw)) continue;
      const song = normalizeSong(raw, 'follow-new');
      if (!song.hash && !song.albumAudioId) continue;
      if (seen.has(song.id)) continue;
      seen.add(song.id);
      songs.push(song);
    }
  }

  return songs;
}

/**
 * 关注歌手的新歌。
 *
 * `optSort`：1=按时间（默认），2=按亲密度；`lastAlbumId` 用于翻页。
 */
export async function getFollowedArtistNewSongs(
  pageSize = 30,
  lastAlbumId = 0,
  optSort: 1 | 2 = 1,
): Promise<Song[]> {
  const body = await callModuleBody('/artist/follow/newsongs', {
    pagesize: pageSize,
    last_album_id: lastAlbumId,
    opt_sort: optSort,
  });
  return flattenFollowNewSongs(body);
}

// ---------------------------------------------------------------------------
// 榜单扩展
// ---------------------------------------------------------------------------

/** 榜单推荐（/rank/top） */
export async function getRankTop(): Promise<Rank[]> {
  const body = await callModuleBody('/rank/top');
  return arrayFrom(body, 'data.list').map((item) => normalizeRank(item));
}

export interface RankVolume {
  year: string;
  vols: { id: string; name: string }[];
}

/** 榜单往期（年份 -> 期数） */
export async function getRankVolumes(rankid: string, rankCid = ''): Promise<RankVolume[]> {
  const body = await callModuleBody('/rank/vol', { rankid, rank_cid: rankCid });
  return arrayFrom(body, 'data.info').map((item) => ({
    year: text(item.year),
    vols: arrayFrom(item, 'vols').map((vol) => ({
      id: text(pick(vol.volid, vol.id, vol.vol)),
      name: text(pick(vol.volname, vol.name, vol.vol)),
    })),
  }));
}
