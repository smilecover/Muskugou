/**
 * 响应归一化。
 *
 * 酷狗不同接口返回的歌曲结构差异很大：
 *   - 搜索：扁平字段（FileHash / SongName / SingerName）
 *   - 歌单：扁平字段 + singerinfo / related_goods
 *   - 排行、专辑、歌手：嵌套 audio_info / album_info / authors
 *
 * UI 不应该关心这些差异，因此这里统一转换为 `Song` / `Playlist` /
 * `Album` / `Artist` / `Rank`，并保留多音质 hash 供播放器切换。
 */

import { normalizeImage } from './core/util';

/** 音质档位，从低到高 */
export type Quality = '128' | '320' | 'flac' | 'high' | 'super';

/** 音质从低到高的序号 */
export const QUALITY_RANK: Record<Quality, number> = {
  '128': 0,
  '320': 1,
  flac: 2,
  high: 3,
  super: 4,
};

/** 一首歌在某个音质下的 hash */
export interface SongQuality {
  quality: Quality;
  hash: string;
  size?: number;
}

/** 统一后的歌曲结构 */
export interface Song {
  /** 歌曲/音频 id（用于队列去重） */
  id: string;
  /** 默认（128K）hash */
  hash: string;
  name: string;
  artist: string;
  artistIds: string[];
  albumId: string;
  albumName: string;
  albumAudioId: string;
  cover: string;
  /** 时长，毫秒 */
  duration: number;
  qualities: SongQuality[];
  /** 0 表示免费，非 0 通常需要会员/购买 */
  payType: number;
  privilege: number;
  /** 歌单内歌曲的文件 id，删除歌单歌曲时使用（部分接口不返回） */
  fileId?: string;
  /** 关联 MV hash，用于从歌曲跳转 MV */
  mvHash?: string;
  source?: string;
}

export interface Playlist {
  /** 对外的歌单 id：公开歌单是 global_collection_id，用户歌单是 listid */
  id: string;
  /** 用户歌单的 listid（/playlist/track/all/new 使用） */
  listId: string;
  name: string;
  cover: string;
  playCount: number;
  trackCount: number;
  creator: string;
  /** 歌单创建者 id，收藏歌单时使用 */
  creatorId: string;
  intro: string;
  tags: string[];
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  cover: string;
  publishTime: string;
  songCount: number;
  intro: string;
}

export interface Artist {
  id: string;
  name: string;
  avatar: string;
  fans: number;
  songCount: number;
  albumCount: number;
  intro: string;
}

export interface Rank {
  id: string;
  rankCid: string;
  name: string;
  cover: string;
  intro: string;
  playCount: number;
  updateFrequency: string;
}

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

function firstValue<T = any>(...values: T[]): any {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function toText(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map(toText).filter(Boolean))];
}

/** 判断数组里是否是歌曲对象 */
function isSongLike(value: any): boolean {
  return Boolean(value && typeof value === 'object' && (value.hash || value.FileHash || value.hash_128 || value.audio_info));
}

// ---------------------------------------------------------------------------
// 歌手 / 专辑 / 封面的通用提取
// ---------------------------------------------------------------------------

function extractArtists(raw: any): { name: string; ids: string[] } {
  const audioInfo = raw?.audio_info || raw?.song_info || {};
  const authors = Array.isArray(raw?.authors)
    ? raw.authors.map((author: any) => author?.author_name || author?.base?.author_name)
    : [];
  const singers = Array.isArray(raw?.Singers)
    ? raw.Singers.map((singer: any) => singer?.name || singer?.singerName)
    : [];
  const singerInfo = Array.isArray(raw?.singerinfo)
    ? raw.singerinfo.map((singer: any) => singer?.name || singer?.singername)
    : [];

  let name = toText(
    firstValue(
      raw?.SingerName,
      raw?.singername,
      raw?.author_name,
      raw?.base?.author_name,
      audioInfo?.author_name,
      raw?.singer,
      authors.length ? authors.join('、') : '',
      singers.length ? singers.join('、') : '',
      singerInfo.length ? singerInfo.join('、') : ''
    )
  );

  // 歌单接口的 name 常是 "歌手 - 歌名"，仅在完全没有歌手字段时兜底
  if (!name && typeof raw?.name === 'string' && raw.name.includes(' - ')) {
    name = raw.name.split(' - ')[0].trim();
  }

  const ids = uniqueStrings([
    ...(Array.isArray(raw?.SingerId) ? raw.SingerId : [raw?.SingerId]),
    ...(Array.isArray(raw?.Singers) ? raw.Singers.map((singer: any) => singer?.id) : []),
    ...(Array.isArray(raw?.singerinfo) ? raw.singerinfo.map((singer: any) => singer?.id) : []),
    ...(Array.isArray(raw?.authors)
      ? raw.authors.map((author: any) => author?.author_id || author?.base?.author_id)
      : []),
    raw?.singerid,
    raw?.author_id,
    raw?.artist_id,
    raw?.song_info?.author_id,
  ]).filter((id) => id !== '0');

  return { name: name || '未知歌手', ids };
}

function extractAlbumName(raw: any): string {
  const audioInfo = raw?.audio_info || {};
  return toText(
    firstValue(
      raw?.AlbumName,
      raw?.album_name,
      raw?.album_info?.album_name,
      raw?.albuminfo?.name,
      raw?.albumname,
      raw?.song_info?.album_name,
      audioInfo?.album_name
    )
  );
}

function extractAlbumId(raw: any): string {
  return toText(
    firstValue(
      raw?.AlbumID,
      raw?.album_id,
      raw?.album_info?.album_id,
      raw?.albuminfo?.id,
      raw?.base?.album_id,
      raw?.song_info?.ori_album_id,
      raw?.ori_album_id
    )
  );
}

function extractCover(raw: any): string {
  const audioInfo = raw?.audio_info || {};
  return normalizeImage(
    firstValue(
      raw?.trans_param?.union_cover,
      raw?.album_info?.sizable_cover,
      raw?.album_info?.cover,
      raw?.song_info?.album_cover,
      raw?.AlbumImage,
      raw?.Image,
      raw?.imgurl,
      raw?.cover,
      raw?.album_cover,
      raw?.pic,
      audioInfo?.cover
    )
  );
}

function extractDuration(raw: any): number {
  const audioInfo = raw?.audio_info || {};
  const songInfo = raw?.song_info || {};
  const milliseconds = toNumber(
    firstValue(
      raw?.timelength,
      // 发现页等接口把各音质时长直接放在根字段
      raw?.timelength_128,
      raw?.timelength_320,
      raw?.timelength_flac,
      raw?.timelen,
      raw?.duration,
      audioInfo?.duration_128,
      audioInfo?.timelength_128,
      audioInfo?.duration,
      audioInfo?.timelength,
      songInfo?.timelength_128,
      songInfo?.timelength
    )
  );
  if (milliseconds) return milliseconds;

  // 搜索接口的 Duration 单位是秒
  const seconds = toNumber(firstValue(raw?.Duration, raw?.duration));
  return seconds ? (seconds < 10_000 ? seconds * 1000 : seconds) : 0;
}

function qualityFromBitrate(bitrate: number): Quality {
  if (bitrate >= 1400) return 'high';
  if (bitrate >= 700) return 'flac';
  if (bitrate >= 250) return '320';
  return '128';
}

function extractQualities(raw: any): SongQuality[] {
  const audioInfo = raw?.audio_info || {};
  const songInfo = raw?.song_info || {};

  const map = new Map<Quality, SongQuality>();
  const add = (quality: Quality, hash: unknown, size?: unknown) => {
    const text = toText(hash);
    if (!text || map.has(quality)) return;
    map.set(quality, { quality, hash: text, size: toNumber(size) || undefined });
  };

  add(
    '128',
    firstValue(raw?.FileHash, raw?.hash, raw?.hash_128, audioInfo?.hash_128, audioInfo?.hash, songInfo?.hash_128),
    firstValue(raw?.FileSize, raw?.filesize_128, audioInfo?.filesize_128, songInfo?.filesize_128),
  );
  add(
    '320',
    firstValue(raw?.HQFileHash, raw?.hash_320, audioInfo?.hash_320, songInfo?.hash_320),
    firstValue(raw?.HQFileSize, raw?.filesize_320, audioInfo?.filesize_320, songInfo?.filesize_320),
  );
  add(
    'flac',
    firstValue(raw?.SQFileHash, raw?.hash_flac, audioInfo?.hash_flac, songInfo?.hash_flac),
    firstValue(raw?.SQFileSize, raw?.filesize_flac, audioInfo?.filesize_flac, songInfo?.filesize_flac),
  );
  add(
    'high',
    firstValue(raw?.ResFileHash, raw?.hash_high, audioInfo?.hash_high, songInfo?.hash_high),
    firstValue(raw?.ResFileSize, raw?.filesize_high, audioInfo?.filesize_high, songInfo?.filesize_high),
  );
  add(
    'super',
    firstValue(raw?.SuperFileHash, raw?.hash_super, audioInfo?.hash_super, songInfo?.hash_super),
    firstValue(raw?.SuperFileSize, raw?.filesize_super, audioInfo?.filesize_super, songInfo?.filesize_super),
  );

  // 歌单接口通过 related_goods 提供多音质 hash
  if (Array.isArray(raw?.relate_goods)) {
    for (const goods of raw.relate_goods) {
      if (!goods?.hash) continue;
      add(qualityFromBitrate(toNumber(goods.bitrate)), goods.hash, goods.size);
    }
  }

  if (!map.size && raw?.hash) add('128', raw.hash);

  return [...map.values()].sort((a, b) => QUALITY_RANK[a.quality] - QUALITY_RANK[b.quality]);
}

// ---------------------------------------------------------------------------
// 歌曲
// ---------------------------------------------------------------------------

/**
 * 把任意接口返回的歌曲对象转成统一结构。
 * `source` 仅用于调试/统计，不影响逻辑。
 */
export function normalizeSong(raw: any, source = 'unknown'): Song {
  const audioInfo = raw?.audio_info || {};
  const { name, ids } = extractArtists(raw);
  const qualities = extractQualities(raw);
  const defaultQuality = qualities.find((item) => item.quality === '128') || qualities[0];

  let songName =
    toText(
      firstValue(
        raw?.SongName,
        raw?.songname,
        raw?.song_name,
        raw?.name,
        raw?.audio_name,
        raw?.base?.audio_name,
        raw?.FileName,
        raw?.song_info?.songname
      )
    ) || '未知歌曲';

  // 歌单接口的 name 字段是“歌手 - 歌名”，歌手信息已单独展示；
  // 仅当分隔符前缀确实等于歌手名时才去掉，避免误伤歌名本身含 " - " 的歌曲。
  if (source === 'playlist' && songName.includes(' - ')) {
    const separator = songName.indexOf(' - ');
    const prefix = songName.slice(0, separator).replace(/\s+/g, '').toLowerCase();
    const artistKey = name.replace(/\s+/g, '').toLowerCase();
    if (artistKey && prefix === artistKey) {
      songName = songName.slice(separator + 3).trim();
    }
  }

  const id = toText(
    firstValue(
      raw?.MixSongID,
      raw?.album_audio_id,
      raw?.base?.album_audio_id,
      raw?.song_info?.album_audio_id,
      raw?.mixsongid,
      raw?.audio_id,
      raw?.Audioid,
      raw?.ID,
      raw?.hash,
      raw?.FileHash,
      audioInfo?.hash_128
    )
  );

  return {
    id: id || defaultQuality?.hash || `${name}-${Math.random()}`,
    hash: defaultQuality?.hash || toText(firstValue(raw?.FileHash, raw?.hash, audioInfo?.hash_128)),
    name: songName,
    artist: name,
    artistIds: ids,
    albumId: extractAlbumId(raw),
    albumName: extractAlbumName(raw),
    albumAudioId: toText(
      firstValue(
        raw?.MixSongID,
        raw?.album_audio_id,
        raw?.base?.album_audio_id,
        raw?.song_info?.album_audio_id,
        raw?.mixsongid,
        raw?.audio_id
      )
    ),
    cover: extractCover(raw),
    duration: extractDuration(raw),
    qualities,
    payType: toNumber(
      firstValue(
        raw?.PayType,
        raw?.pay_type,
        raw?.feetype,
        raw?.pay_type_128,
        raw?.goods_info?.pay_type,
        raw?.song_info?.pay_type
      )
    ),
    privilege: toNumber(
      firstValue(raw?.Privilege, raw?.privilege, raw?.privilege_download?.privilege, audioInfo?.privilege)
    ),
    fileId: toText(firstValue(raw?.fileid, raw?.file_id, raw?.FileId)) || undefined,
    mvHash:
      toText(firstValue(raw?.mvhash, raw?.MvHash, raw?.mv_hash, raw?.audio_info?.mv_hash)) || undefined,
    source,
  };
}

// ---------------------------------------------------------------------------
// 歌单 / 专辑 / 歌手 / 排行榜
// ---------------------------------------------------------------------------

export function normalizePlaylist(raw: any): Playlist {
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.map((tag: any) => tag?.tag_name || tag).filter(Boolean)
    : toText(raw?.tags).split(',').filter(Boolean);

  const listId = toText(firstValue(raw?.listid, raw?.listId, raw?.list_id));
  return {
    id: toText(
      firstValue(raw?.global_collection_id, raw?.gid, raw?.specialid, raw?.specialId, listId, raw?.id),
    ),
    listId,
    name: toText(firstValue(raw?.specialname, raw?.name, raw?.title, raw?.listname)) || '未命名歌单',
    cover: normalizeImage(firstValue(raw?.imgurl, raw?.img, raw?.pic, raw?.flexible_cover, raw?.cover)),
    playCount: toNumber(firstValue(raw?.play_count, raw?.playcount, raw?.total_play_count, raw?.heat)),
    trackCount: toNumber(firstValue(raw?.song_count, raw?.songcount, raw?.count, raw?.percount, raw?.trackCount)),
    creator: toText(firstValue(raw?.nickname, raw?.list_create_username, raw?.create_user_nickname, raw?.singername)),
    creatorId: toText(firstValue(raw?.list_create_userid, raw?.suid, raw?.userid)),
    intro: toText(raw?.intro),
    tags: uniqueStrings(tags),
  };
}

export function normalizeAlbum(raw: any): Album {
  const authors = Array.isArray(raw?.authors) ? raw.authors : [];
  const artist = toText(
    firstValue(
      raw?.singer,
      raw?.singername,
      raw?.author_name,
      authors.map((author: any) => author?.author_name || author?.name).join('、'),
      Array.isArray(raw?.singers) ? raw.singers.map((singer: any) => singer?.name).join('、') : ''
    )
  );
  // 搜索专辑接口常把 singerid 返回为 "0"，真正可用的歌手 id 在
  // singers/singerids 里；优先取后两者，并过滤无效的 0。
  const artistIds = [
    authors[0]?.author_id,
    Array.isArray(raw?.singers) ? raw.singers[0]?.id : '',
    Array.isArray(raw?.singerids) ? raw.singerids[0] : '',
    raw?.author_id,
    raw?.singerid,
  ]
    .map((value) => toText(value))
    .filter((value) => value && value !== '0');
  const artistId = artistIds[0] || '';

  return {
    id: toText(firstValue(raw?.albumid, raw?.album_id, raw?.id)),
    name: toText(firstValue(raw?.albumname, raw?.album_name, raw?.name)) || '未命名专辑',
    artist: artist || '未知歌手',
    artistId,
    cover: normalizeImage(firstValue(raw?.imgurl, raw?.img, raw?.sizable_cover, raw?.cover)),
    publishTime: toText(firstValue(raw?.publishtime, raw?.publish_time, raw?.publish_date)),
    songCount: toNumber(firstValue(raw?.songcount, raw?.song_count, raw?.count)),
    intro: toText(raw?.intro),
  };
}

export function normalizeArtist(raw: any): Artist {
  const intro = Array.isArray(raw?.long_intro)
    ? raw.long_intro.map((item: any) => item?.content || '').join('\n')
    : toText(firstValue(raw?.intro, raw?.long_intro));

  return {
    id: toText(firstValue(raw?.AuthorId, raw?.author_id, raw?.id, raw?.singerid)),
    name: toText(firstValue(raw?.AuthorName, raw?.author_name, raw?.name, raw?.singername)) || '未知歌手',
    avatar: normalizeImage(
      firstValue(raw?.Avatar, raw?.sizable_avatar, raw?.avatar, raw?.FirstFrameImage, raw?.imgurl)
    ),
    fans: toNumber(firstValue(raw?.FansNum, raw?.fansnums, raw?.fans)),
    songCount: toNumber(firstValue(raw?.AudioCount, raw?.song_count, raw?.songcount)),
    albumCount: toNumber(firstValue(raw?.AlbumCount, raw?.album_count, raw?.albumcount)),
    intro,
  };
}

export function normalizeRank(raw: any): Rank {
  return {
    id: toText(firstValue(raw?.rankid, raw?.rank_id, raw?.id)),
    rankCid: toText(firstValue(raw?.rank_cid, raw?.rankcid, raw?.cid)),
    name: toText(firstValue(raw?.rankname, raw?.name, raw?.title)) || '未命名榜单',
    cover: normalizeImage(firstValue(raw?.imgurl, raw?.img_9, raw?.banner_9, raw?.album_img_9, raw?.base_img)),
    intro: toText(raw?.intro),
    playCount: toNumber(firstValue(raw?.play_times, raw?.play_count, raw?.playcount)),
    updateFrequency: toText(
      firstValue(raw?.update_frequency, raw?.updateFrequency, raw?.update_frequency_type)
    ),
  };
}

// ---------------------------------------------------------------------------
// 列表结构兼容
// ---------------------------------------------------------------------------

/** 从常见响应结构中取出数组（各接口字段不统一） */
export function extractList(body: any): any[] {
  const candidates = [
    body?.data?.lists,
    body?.data?.info,
    body?.data?.list,
    body?.data?.songs,
    body?.data?.songlist,
    body?.data?.audios,
    body?.data?.audio_list,
    body?.data?.special_list,
    body?.data?.special_recommend?.info,
    body?.data?.items,
    body?.data,
    body?.lists,
    body?.info,
    body?.songs,
    body?.songlist,
    body?.audios,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  return [];
}

/** 把 top_album 的按语种分组结构拍平 */
export function flattenAlbumBuckets(body: any): any[] {
  const data = body?.data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data)) return data;
  return Object.values(data)
    .filter(Array.isArray)
    .flat()
    .filter((item) => item && typeof item === 'object' && (item.albumid || item.album_id));
}

/** 把 top_song 形如 { 0: song, 1: song } 的对象拍平 */
export function flattenNumberedObject(body: any): any[] {
  const data = body?.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data !== 'object') return [];
  const values = Object.values(data);
  if (values.some((value) => isSongLike(value))) return values.filter(isSongLike);
  return [];
}

/** 从任意嵌套结构里找第一个包含指定字段的对象 */
export function findFirstWith(value: any, key: string, depth = 0): any {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstWith(item, key, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (value[key] !== undefined) return value;
  for (const child of Object.values(value)) {
    const found = findFirstWith(child, key, depth + 1);
    if (found) return found;
  }
  return null;
}
