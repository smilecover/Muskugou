/**
 * 歌曲扩展信息与歌手扩展信息。
 *
 * 播放页/歌曲详情用：播放特权、高潮片段、相关版本、K 歌、上榜成绩、MV。
 * 歌手页用：荣誉、关注/取关、关注歌手的新歌。
 */

import { callModuleBody } from '../registry';
import { normalizeRank, normalizeSong, type Rank, type Song } from '../normalize';
import { arrayFrom, image, num, pick, text } from './common';

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
  /** 原始响应，页面可展示更多字段 */
  raw: any;
}

function toList(value: any): string[] {
  if (Array.isArray(value)) return value.map((item) => text(item?.quality || item)).filter(Boolean);
  return text(value)
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getSongPrivilege(song: Song): Promise<SongPrivilege> {
  const body = await callModuleBody('/privilege/lite', {
    hash: song.hash,
    album_id: song.albumId || undefined,
    album_audio_id: song.albumAudioId || undefined,
    qualities: '128,320,flac,high,super',
  });
  const item = arrayFrom(body, 'quality_vip', 'data.quality_vip', 'data')[0] || {};
  const freeQualities = toList(pick(item.free_qualities, item.free_quality));
  return {
    freeListen: Boolean(item.free_listen),
    bestFreeQuality: text(
      pick(item.best_free_quality, freeQualities[freeQualities.length - 1], item.free_quality),
    ),
    qualities: toList(item.qualities),
    freeQualities,
    vipQualities: toList(pick(item.vip_qualities, item.super_vip_qualities)),
    raw: item,
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
    const songInfo = item?.audio_info || item?.base || item;
    const normalized = normalizeSong(songInfo, 'related');
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

/** 关注歌手的新歌 */
export async function getFollowedArtistNewSongs(pageSize = 30): Promise<Song[]> {
  const body = await callModuleBody('/artist/follow/newsongs', { pagesize: pageSize, opt_sort: 0 });
  return arrayFrom(body, 'data.list', 'data').map((item) => normalizeSong(item, 'follow-new'));
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
