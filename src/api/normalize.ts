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

/**
 * 部分接口会把嵌套字段序列化成 JSON 字符串。
 *
 * 例如 v3 云歌单偶尔返回 `trans_param: "{\"ogg_128_hash\":\"...\"}"`，
 * 直接按对象读取会永远拿不到 OGG hash / 封面。这里只解析以 `{`、`[`
 * 开头的字符串，普通歌名/歌手名不会被误解析。
 */
function parseStructured(value: any): any {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  if (!raw || (raw[0] !== '{' && raw[0] !== '[')) return value;
  try {
    return JSON.parse(raw);
  } catch {
    return value;
  }
}

/** 值 → 对象（JSON 字符串、数组和空值都返回空对象） */
function asRecord(value: any): any {
  const parsed = parseStructured(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

/** 值 → 数组（单个对象会包成一项，JSON 字符串会被还原） */
function asArray(value: any): any[] {
  const parsed = parseStructured(value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed === undefined || parsed === null || parsed === '') return [];
  return [parsed];
}

/** 依次尝试多个取值，返回第一个非空对象 */
function firstRecord(...values: any[]): any {
  for (const value of values) {
    const record = asRecord(value);
    if (Object.keys(record).length) return record;
  }
  return {};
}

/**
 * 歌曲对象里常见的嵌套结构。
 *
 * 各接口把同一份信息放在 `audio_info` / `song_info` / `album_info` /
 * `album_info.album_info` 等不同位置，这里一次解析好，供后续提取函数复用。
 */
function songParts(raw: any): {
  audioInfo: any;
  songInfo: any;
  albumInfo: any;
  baseInfo: any;
  transParam: any;
  audioTransParam: any;
  songTransParam: any;
} {
  const audioInfo = asRecord(raw?.audio_info);
  const songInfo = asRecord(raw?.song_info);
  const baseInfo = asRecord(raw?.base);
  const albumInfo = firstRecord(
    raw?.album_info,
    raw?.albuminfo,
    raw?.album,
    audioInfo?.album_info,
    audioInfo?.albuminfo,
    audioInfo?.album,
    songInfo?.album_info,
    songInfo?.albuminfo,
  );
  return {
    audioInfo,
    songInfo,
    albumInfo,
    baseInfo,
    // 相关版本等接口把 OGG/封面信息放在 copyright.trans_param 里
    transParam: asRecord(raw?.trans_param) || asRecord(raw?.copyright?.trans_param),
    audioTransParam: asRecord(audioInfo?.trans_param) || asRecord(audioInfo?.copyright?.trans_param),
    songTransParam: asRecord(songInfo?.trans_param) || asRecord(songInfo?.copyright?.trans_param),
  };
}

/** 判断数组里是否是歌曲对象 */
function isSongLike(value: any): boolean {
  return Boolean(value && typeof value === 'object' && (value.hash || value.FileHash || value.hash_128 || value.audio_info));
}

// ---------------------------------------------------------------------------
// 歌手 / 专辑 / 封面的通用提取
// ---------------------------------------------------------------------------

/**
 * 单个歌手对象/字符串 → 歌手名。
 *
 * 酷狗不同接口的歌手字段差异很大：`author_name`、`singer_name`、
 * `singername`、`name`，有时数组元素直接是字符串。统一在这里兼容。
 */
function artistNameOf(value: any): string {
  if (typeof value === 'string') return value.trim();
  if (value === undefined || value === null || typeof value !== 'object') return '';
  const baseInfo = asRecord(value.base);
  return toText(
    firstValue(
      value.author_name,
      value.authorName,
      value.singer_name,
      value.singerName,
      value.singername,
      value.name,
      value.nickname,
      baseInfo.author_name,
      baseInfo.singer_name,
      baseInfo.name
    )
  );
}

/** 数组/单值 → 歌手名数组（元素可能是对象、字符串或 JSON 字符串） */
function artistNamesOf(value: any): string[] {
  const parsed = parseStructured(value);
  if (Array.isArray(parsed)) return parsed.map(artistNameOf).filter(Boolean);
  const name = artistNameOf(parsed);
  return name ? [name] : [];
}

/** 单个歌手对象/字符串 → 歌手 id（字符串只接受纯数字，避免把歌手名当 id） */
function artistIdOf(value: any): string {
  const parsed = parseStructured(value);
  if (typeof parsed === 'number') return toText(parsed);
  if (typeof parsed === 'string') {
    const text = parsed.trim();
    return /^\d+$/.test(text) ? text : '';
  }
  if (!parsed || typeof parsed !== 'object') return '';
  const baseInfo = asRecord(parsed.base);
  return toText(
    firstValue(
      parsed.author_id,
      parsed.authorId,
      parsed.singer_id,
      parsed.singerid,
      parsed.singerId,
      parsed.id,
      baseInfo.author_id,
      baseInfo.singer_id,
      baseInfo.id
    )
  );
}

/** 数组/单值 → 歌手 id 数组 */
function artistIdsOf(value: any): string[] {
  const parsed = parseStructured(value);
  if (Array.isArray(parsed)) return parsed.map(artistIdOf).filter(Boolean);
  const id = artistIdOf(parsed);
  return id ? [id] : [];
}

/** 音频扩展名（云歌单 v3 的 filename 字段会带扩展名） */
const AUDIO_EXTENSION = /\.(mp3|flac|ogg|wav|m4a|aac|ape|wma|opus|dsf|dff|mgg|mflac|kgm|kgma)$/i;

/**
 * 去掉路径和音频扩展名，得到可展示的文件名。
 *
 * 云歌单 v3 返回的 `name` / `filename` 常带 `.mp3` 后缀，
 * 直接展示会出现“光年之外.mp3”这种异常歌名。
 */
export function cleanSongName(value: unknown): string {
  let text = toText(value);
  if (!text) return '';
  text = text.replace(/\\/g, '/');
  const slash = text.lastIndexOf('/');
  if (slash >= 0) text = text.slice(slash + 1);
  return text.replace(AUDIO_EXTENSION, '').trim();
}

/**
 * 去掉歌名前面的“歌手 - ”前缀。
 *
 * 仅当前缀确实等于某个歌手名时才去掉，避免误伤歌名本身含 " - " 的歌曲。
 */
export function stripArtistPrefix(songName: string, artistName: string): string {
  const separator = songName.indexOf(' - ');
  if (separator < 0) return songName;
  const prefix = songName.slice(0, separator).replace(/\s+/g, '').toLowerCase();
  const artistKeys = new Set(
    [artistName, ...artistName.split(/[、,，&/]/)]
      .map((item) => item.replace(/\s+/g, '').toLowerCase())
      .filter(Boolean),
  );
  return artistKeys.has(prefix) ? songName.slice(separator + 3).trim() : songName;
}

/** 清洗歌名并去掉与歌手重复的前缀 */
export function cleanSongDisplayName(songName: string, artistName: string): string {
  return stripArtistPrefix(cleanSongName(songName), artistName);
}

/**
 * 修正本地持久化歌曲的展示字段。
 *
 * 旧版本会把 "光年之外.mp3" 原样存入队列/历史/收藏；重新归一化会丢失
 * fileId 等字段，因此这里只修正 name。
 */
export function cleanStoredSong(song: Song): Song {
  const name = cleanSongDisplayName(song.name, song.artist) || song.name;
  // 旧数据可能把 0 / "null" 当成封面保存
  const cover = /^(0|null|undefined)$/i.test(song.cover || '') ? '' : song.cover;
  return name !== song.name || cover !== song.cover ? { ...song, name, cover } : song;
}

function extractArtists(raw: any): { name: string; ids: string[] } {
  const { audioInfo, songInfo, albumInfo, baseInfo } = songParts(raw);

  // 关注新歌等 feed 接口会把歌手放在数组/嵌套对象里，字段名也不固定
  const names = [
    ...artistNamesOf(raw?.authors),
    ...artistNamesOf(raw?.Singers),
    ...artistNamesOf(raw?.singers),
    ...artistNamesOf(raw?.singerinfo),
    ...artistNamesOf(raw?.singer_list),
    ...artistNamesOf(raw?.artists),
    ...artistNamesOf(audioInfo?.authors),
    ...artistNamesOf(audioInfo?.singers),
    ...artistNamesOf(audioInfo?.singerinfo),
    ...artistNamesOf(audioInfo?.singer_list),
    ...artistNamesOf(audioInfo?.singer),
    ...artistNamesOf(songInfo?.authors),
    ...artistNamesOf(songInfo?.singers),
    ...artistNamesOf(songInfo?.singerinfo),
    ...artistNamesOf(songInfo?.singer_list),
    ...artistNamesOf(albumInfo?.authors),
    ...artistNamesOf(albumInfo?.singers),
    ...artistNamesOf(albumInfo?.singerinfo),
    ...artistNamesOf(baseInfo?.authors),
    ...artistNamesOf(baseInfo?.singers),
    // 少数接口把 singer/artist 直接写成数组
    ...artistNamesOf(raw?.singer),
    ...artistNamesOf(raw?.artist),
  ];

  let name = toText(
    firstValue(
      raw?.SingerName,
      raw?.singername,
      raw?.singer_name,
      raw?.singerName,
      raw?.author_name,
      raw?.authorName,
      raw?.artist_name,
      raw?.artistName,
      baseInfo?.author_name,
      baseInfo?.singer_name,
      audioInfo?.author_name,
      audioInfo?.authorName,
      audioInfo?.singer_name,
      audioInfo?.singerName,
      audioInfo?.singername,
      songInfo?.author_name,
      songInfo?.authorName,
      songInfo?.singer_name,
      songInfo?.singerName,
      songInfo?.singername,
      albumInfo?.author_name,
      albumInfo?.singer_name,
      artistNameOf(raw?.singer),
      artistNameOf(raw?.artist),
      names.join('、')
    )
  );

  // 歌单接口的 name / filename 常是 "歌手 - 歌名"，仅在完全没有歌手字段时兜底
  if (!name) {
    const fallbackName = cleanSongName(
      firstValue(raw?.name, raw?.filename, raw?.FileName, raw?.file_name, raw?.orifilename),
    );
    if (fallbackName.includes(' - ')) {
      name = fallbackName.split(' - ')[0].trim();
    }
  }

  const ids = uniqueStrings([
    ...(Array.isArray(raw?.SingerId) ? raw.SingerId : [raw?.SingerId]),
    ...(Array.isArray(raw?.singerids) ? raw.singerids : [raw?.singerids]),
    ...artistIdsOf(raw?.Singers),
    ...artistIdsOf(raw?.singers),
    ...artistIdsOf(raw?.singerinfo),
    ...artistIdsOf(raw?.singer_list),
    ...artistIdsOf(raw?.authors),
    ...artistIdsOf(raw?.artists),
    ...artistIdsOf(audioInfo?.authors),
    ...artistIdsOf(audioInfo?.singers),
    ...artistIdsOf(songInfo?.authors),
    ...artistIdsOf(songInfo?.singers),
    ...artistIdsOf(albumInfo?.authors),
    ...artistIdsOf(albumInfo?.singers),
    ...artistIdsOf(raw?.singer),
    ...artistIdsOf(raw?.artist),
    raw?.singerid,
    raw?.singer_id,
    raw?.author_id,
    raw?.authorId,
    raw?.artist_id,
    raw?.artistId,
    baseInfo?.author_id,
    songInfo?.author_id,
    audioInfo?.author_id,
    albumInfo?.author_id,
  ]).filter((id) => id !== '0');

  return { name: name || '未知歌手', ids };
}

function extractAlbumName(raw: any): string {
  const { audioInfo, songInfo, albumInfo, baseInfo } = songParts(raw);
  return toText(
    firstValue(
      raw?.AlbumName,
      raw?.album_name,
      raw?.albumname,
      raw?.albumName,
      albumInfo?.album_name,
      albumInfo?.albumname,
      albumInfo?.name,
      songInfo?.album_name,
      songInfo?.albumname,
      audioInfo?.album_name,
      audioInfo?.albumname,
      baseInfo?.album_name,
      baseInfo?.albumname
    )
  );
}

function extractAlbumId(raw: any): string {
  const { audioInfo, songInfo, albumInfo, baseInfo } = songParts(raw);
  return toText(
    firstValue(
      raw?.AlbumID,
      raw?.album_id,
      raw?.albumid,
      raw?.albumId,
      albumInfo?.album_id,
      albumInfo?.albumid,
      albumInfo?.id,
      baseInfo?.album_id,
      baseInfo?.albumid,
      songInfo?.ori_album_id,
      songInfo?.album_id,
      songInfo?.albumid,
      audioInfo?.ori_album_id,
      audioInfo?.album_id,
      audioInfo?.albumid,
      raw?.ori_album_id
    )
  );
}

function extractCover(raw: any): string {
  const { audioInfo, songInfo, albumInfo, transParam, audioTransParam, songTransParam } = songParts(raw);
  const cover = normalizeImage(
    firstValue(
      // 概念版优先使用 trans_param.union_cover（各音质共用一张封面）
      transParam?.union_cover,
      audioTransParam?.union_cover,
      songTransParam?.union_cover,
      albumInfo?.sizable_cover,
      albumInfo?.sizableCover,
      albumInfo?.imgurl,
      albumInfo?.img,
      albumInfo?.cover,
      albumInfo?.pic,
      albumInfo?.album_cover,
      songInfo?.album_cover,
      songInfo?.sizable_cover,
      songInfo?.imgurl,
      songInfo?.img,
      songInfo?.cover,
      songInfo?.pic,
      raw?.sizable_cover,
      raw?.sizableCover,
      raw?.AlbumImage,
      raw?.Image,
      raw?.imgurl,
      raw?.img,
      raw?.cover,
      raw?.cover_url,
      raw?.album_cover,
      raw?.album_img,
      raw?.pic,
      audioInfo?.cover,
      audioInfo?.album_cover,
      audioInfo?.sizable_cover,
      audioInfo?.imgurl,
      audioInfo?.img,
      audioInfo?.pic
    )
  );
  // 接口偶尔用 0 / "null" 表示没有封面，避免把它当成有效地址
  return /^(0|null|undefined)$/i.test(cover) ? '' : cover;
}

function extractDuration(raw: any): number {
  const { audioInfo, songInfo } = songParts(raw);
  const milliseconds = toNumber(
    firstValue(
      raw?.timelength,
      // 发现页等接口把各音质时长直接放在根字段
      raw?.timelength_128,
      raw?.timelength_320,
      raw?.timelength_flac,
      raw?.timelength_high,
      raw?.timelen,
      raw?.duration,
      audioInfo?.duration_128,
      audioInfo?.timelength_128,
      audioInfo?.duration,
      audioInfo?.timelength,
      audioInfo?.timelen,
      songInfo?.timelength_128,
      songInfo?.timelength,
      songInfo?.timelen,
      songInfo?.duration
    )
  );
  if (milliseconds) return milliseconds;

  // 搜索接口的 Duration 单位是秒
  const seconds = toNumber(firstValue(raw?.Duration, raw?.duration));
  return seconds ? (seconds < 10_000 ? seconds * 1000 : seconds) : 0;
}

function qualityFromBitrate(bitrate: number): Quality {
  // 少数接口用 bps（128000）而非 kbps 返回码率
  const value = bitrate > 10_000 ? bitrate / 1000 : bitrate;
  if (value >= 1400) return 'high';
  if (value >= 700) return 'flac';
  if (value >= 250) return '320';
  return '128';
}

/** relate_goods 的 level → App 音质（2=128、4=320、5=FLAC、6=Hi-Res、7=DSD） */
function qualityFromLevel(level: number): Quality | null {
  if (level === 1 || level === 2) return '128';
  if (level === 4) return '320';
  if (level === 5) return 'flac';
  if (level === 6) return 'high';
  if (level === 7) return 'super';
  return null;
}

/** 音质字段文本 → App 音质（只认标准档位，避免把歌手名等文本误判） */
function qualityFromText(value: unknown): Quality | null {
  const text = toText(value).toLowerCase();
  if (!text) return null;
  if (text === '128' || text === '128k' || text === 'standard' || text === 'std') return '128';
  if (text === '320' || text === '320k' || text === 'hq') return '320';
  if (text === 'flac' || text === 'sq' || text === 'lossless') return 'flac';
  if (text === 'high' || text === 'hi-res' || text === 'hires' || text === 'hr' || text === 'res') return 'high';
  if (text === 'super' || text === 'dsd' || text === 'master' || text === 'viper_tape') return 'super';
  return null;
}

function extractQualities(raw: any): SongQuality[] {
  const { audioInfo, songInfo, transParam, audioTransParam, songTransParam } = songParts(raw);

  const map = new Map<Quality, SongQuality>();
  const add = (quality: Quality | null, hash: unknown, size?: unknown) => {
    if (!quality) return;
    const text = toText(hash);
    if (!text || map.has(quality)) return;
    map.set(quality, { quality, hash: text, size: toNumber(size) || undefined });
  };

  // 1. 概念版 128/320 播放的是 OGG 资源：优先使用 trans_param 里的 ogg hash。
  //    注意 song.hash 仍保持标准 hash，歌词/权益/鉴权接口需要它。
  add(
    '128',
    firstValue(transParam?.ogg_128_hash, audioTransParam?.ogg_128_hash, songTransParam?.ogg_128_hash),
    firstValue(transParam?.ogg_128_filesize, audioTransParam?.ogg_128_filesize, songTransParam?.ogg_128_filesize),
  );
  add(
    '320',
    firstValue(transParam?.ogg_320_hash, audioTransParam?.ogg_320_hash, songTransParam?.ogg_320_hash),
    firstValue(transParam?.ogg_320_filesize, audioTransParam?.ogg_320_filesize, songTransParam?.ogg_320_filesize),
  );

  // 2. relate_goods：歌单接口通过它携带各音质 hash。
  //    level=1 是概念版 128K OGG 资源，优先处理；level=2 是普通 128K MP3。
  const relateGoods = [
    ...asArray(raw?.relate_goods),
    ...asArray(raw?.related_goods),
    ...asArray(audioInfo?.relate_goods),
    ...asArray(audioInfo?.related_goods),
    ...asArray(songInfo?.relate_goods),
  ].sort((a, b) => Number(toNumber(a?.level) !== 1) - Number(toNumber(b?.level) !== 1));

  for (const goods of relateGoods) {
    if (!goods || typeof goods !== 'object') continue;
    const quality =
      qualityFromText(goods.quality) ||
      qualityFromLevel(toNumber(goods.level)) ||
      qualityFromBitrate(toNumber(goods.bitrate));
    add(
      quality,
      firstValue(goods.hash, goods.FileHash, goods.file_hash),
      firstValue(goods.size, goods.filesize, goods.info?.filesize),
    );
  }

  // 3. 已经整理好的 qualities 数组（如 /privilege/lite 的音质明细）
  for (const item of [
    ...asArray(raw?.qualities),
    ...asArray(audioInfo?.qualities),
    ...asArray(songInfo?.qualities),
  ]) {
    if (!item || typeof item !== 'object') continue;
    const quality =
      qualityFromText(item.quality) ||
      qualityFromLevel(toNumber(item.level)) ||
      qualityFromBitrate(toNumber(item.bitrate));
    add(
      quality,
      firstValue(item.hash, item.FileHash),
      firstValue(item.size, item.filesize, item.info?.filesize),
    );
  }

  // 4. 各音质的扁平字段，作为最后的兜底
  add(
    '128',
    firstValue(
      raw?.FileHash,
      raw?.hash,
      raw?.hash_128,
      audioInfo?.hash_128,
      audioInfo?.hash,
      songInfo?.hash_128,
      songInfo?.hash,
    ),
    firstValue(raw?.FileSize, raw?.filesize_128, audioInfo?.filesize_128, songInfo?.filesize_128),
  );
  add(
    '320',
    firstValue(
      raw?.HQFileHash,
      raw?.HQHash,
      raw?.hqhash,
      raw?.hash_320,
      audioInfo?.HQFileHash,
      audioInfo?.hash_320,
      songInfo?.HQFileHash,
      songInfo?.hash_320,
    ),
    firstValue(raw?.HQFileSize, raw?.filesize_320, audioInfo?.filesize_320, songInfo?.filesize_320),
  );
  add(
    'flac',
    firstValue(
      raw?.SQFileHash,
      raw?.SQHash,
      raw?.sqhash,
      raw?.hash_flac,
      audioInfo?.SQFileHash,
      audioInfo?.hash_flac,
      songInfo?.SQFileHash,
      songInfo?.hash_flac,
    ),
    firstValue(raw?.SQFileSize, raw?.filesize_flac, audioInfo?.filesize_flac, songInfo?.filesize_flac),
  );
  add(
    'high',
    firstValue(
      raw?.ResFileHash,
      raw?.ResHash,
      raw?.res_hash,
      raw?.hash_high,
      audioInfo?.ResFileHash,
      audioInfo?.hash_high,
      songInfo?.ResFileHash,
      songInfo?.hash_high,
    ),
    firstValue(raw?.ResFileSize, raw?.filesize_high, audioInfo?.filesize_high, songInfo?.filesize_high),
  );
  add(
    'super',
    firstValue(
      raw?.SuperFileHash,
      raw?.SuperHash,
      raw?.super_hash,
      raw?.hash_super,
      audioInfo?.SuperFileHash,
      audioInfo?.hash_super,
      songInfo?.SuperFileHash,
      songInfo?.hash_super,
    ),
    firstValue(raw?.SuperFileSize, raw?.filesize_super, audioInfo?.filesize_super, songInfo?.filesize_super),
  );

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
  const { audioInfo, songInfo, baseInfo, transParam, audioTransParam, songTransParam } = songParts(raw);
  const { name, ids } = extractArtists(raw);
  const qualities = extractQualities(raw);
  const defaultQuality = qualities.find((item) => item.quality === '128') || qualities[0];

  let songName =
    cleanSongName(
      firstValue(
        raw?.SongName,
        raw?.songname,
        raw?.song_name,
        raw?.songName,
        raw?.name,
        raw?.audio_name,
        raw?.audioName,
        raw?.track_name,
        raw?.title,
        baseInfo?.audio_name,
        baseInfo?.song_name,
        // /audio/related 的 base 用 songname 而不是 song_name
        baseInfo?.songname,
        baseInfo?.songName,
        baseInfo?.filename,
        raw?.FileName,
        raw?.filename,
        raw?.fileName,
        raw?.file_name,
        raw?.orifilename,
        songInfo?.songname,
        songInfo?.song_name,
        songInfo?.audio_name,
        audioInfo?.song_name,
        audioInfo?.songname,
        audioInfo?.audio_name,
        audioInfo?.filename
      )
    ) || '未知歌曲';

  // 歌单/云歌单接口的 name 或 filename 常是“歌手 - 歌名”，去掉与歌手重复的前缀
  songName = stripArtistPrefix(songName, name);

  const id = toText(
    firstValue(
      raw?.MixSongID,
      raw?.album_audio_id,
      baseInfo?.album_audio_id,
      songInfo?.album_audio_id,
      raw?.mixsongid,
      raw?.audio_id,
      raw?.Audioid,
      raw?.ID,
      raw?.hash,
      raw?.FileHash,
      raw?.audio_id,
      songInfo?.audio_id,
      audioInfo?.audio_id,
      audioInfo?.hash_128
    )
  );

  // 标准 hash 用于歌词/权益/鉴权；qualities 里的 128 可能是概念版 OGG hash，
  // 因此不能用 defaultQuality 反推 song.hash。
  const canonicalHash = toText(
    firstValue(
      raw?.FileHash,
      raw?.hash,
      raw?.hash_128,
      audioInfo?.hash_128,
      audioInfo?.hash,
      songInfo?.hash_128,
      songInfo?.hash,
      transParam?.ogg_128_hash,
      audioTransParam?.ogg_128_hash,
      songTransParam?.ogg_128_hash,
    ),
  );

  return {
    id: id || defaultQuality?.hash || `${name}-${Math.random()}`,
    hash: canonicalHash || defaultQuality?.hash || '',
    name: songName,
    artist: name,
    artistIds: ids,
    albumId: extractAlbumId(raw),
    albumName: extractAlbumName(raw),
    albumAudioId: toText(
      firstValue(
        raw?.MixSongID,
        raw?.album_audio_id,
        baseInfo?.album_audio_id,
        songInfo?.album_audio_id,
        raw?.mixsongid,
        raw?.audio_id,
        songInfo?.audio_id,
        audioInfo?.album_audio_id,
        audioInfo?.audio_id
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
