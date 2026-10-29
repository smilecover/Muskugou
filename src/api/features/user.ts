/**
 * 账号相关：用户资料、关注/粉丝、云盘、已购、VIP 详情。
 *
 * 这些接口大多需要登录；未登录时由页面引导到扫码登录。
 * 酷狗的用户资料接口只对当前登录账号可靠，公开用户页主要用于查看粉丝/关注列表。
 */

import { callModuleBody } from '../registry';
import { normalizeAlbum, normalizeSong, type Album, type Song } from '../normalize';
import { arrayFrom, fallback, image, num, pick, text } from './common';

export interface PublicUser {
  id: string;
  name: string;
  avatar: string;
  signature: string;
  fans: number;
  follows: number;
  songs: number;
}

function normalizeUser(raw: any): PublicUser {
  return {
    id: text(pick(raw.userid, raw.user_id, raw.id, raw.t_userid)),
    name: text(pick(raw.nickname, raw.user_name, raw.name)) || '酷狗用户',
    avatar: image(pick(raw.user_pic, raw.avatar, raw.pic, raw.img), 200),
    signature: text(pick(raw.signature, raw.intro, raw.user_sign)),
    fans: num(pick(raw.fans_num, raw.fans, raw.fansnums)),
    follows: num(pick(raw.follow_num, raw.follows, raw.follownums)),
    songs: num(pick(raw.song_num, raw.song_count, raw.audio_count)),
  };
}

export interface UserPage {
  user: PublicUser | null;
  songs: Song[];
  total: number;
}

/** 用户主页信息（需登录；未登录时返回 null） */
export async function getUserDetail(userid?: string): Promise<PublicUser | null> {
  const body = await callModuleBody('/user/detail', { userid });
  const raw = body?.data?.user_info || body?.data?.info || body?.data || {};
  if (!raw || typeof raw !== 'object') return null;
  return normalizeUser({ ...raw, userid: pick(raw.userid, userid) });
}

/** 关注列表（酷狗当前账号关注的歌手/用户） */
export async function getFollowedUsers(): Promise<PublicUser[]> {
  const body = await callModuleBody('/user/follow');
  return arrayFrom(body, 'data.list', 'data.info', 'data').map(normalizeUser);
}

/** 粉丝列表 */
export async function getFans(): Promise<PublicUser[]> {
  const body = await callModuleBody('/user/fans');
  return arrayFrom(body, 'data.list', 'data.info', 'data').map(normalizeUser);
}

/** 好友列表 */
export async function getFriends(): Promise<PublicUser[]> {
  const body = await callModuleBody('/user/friends');
  return arrayFrom(body, 'data.list', 'data.info', 'data').map(normalizeUser);
}

/** 访客列表 */
export async function getVisitors(page = 1, pageSize = 20): Promise<PublicUser[]> {
  const body = await callModuleBody('/user/visitors', { page, pagesize: pageSize });
  return arrayFrom(body, 'data.list', 'data.info', 'data.visitors', 'data').map(normalizeUser);
}

/** 关注用户 */
export async function followUser(userid: string): Promise<void> {
  await callModuleBody('/user/follow/add', { t_userid: userid, tuid: userid, source: 1 });
}

/** 取消关注 */
export async function unfollowUser(userid: string): Promise<void> {
  await callModuleBody('/user/follow/del', { t_userid: userid, tuid: userid, source: 1 });
}

// ---------------------------------------------------------------------------
// 听歌排行（当前账号）
// ---------------------------------------------------------------------------

/** 听歌排行；type 0=周榜，1=总榜 */
export async function getUserListen(type = 0): Promise<Song[]> {
  const body = await callModuleBody('/user/listen', { type });
  return arrayFrom(body, 'data.list', 'data.info', 'data.songs', 'data').map((item) =>
    normalizeSong(item?.song_info || item?.audio_info || item, 'listen'),
  );
}

// ---------------------------------------------------------------------------
// 云盘
// ---------------------------------------------------------------------------

export interface CloudSong extends Song {
  fileId: string;
  kvId: string;
}

function normalizeCloudSong(raw: any): CloudSong {
  const song = normalizeSong(
    {
      ...raw,
      songname: pick(raw.songname, raw.name, raw.filename, raw.track_name),
      hash: pick(raw.hash, raw.filehash, raw.FileHash),
      album_audio_id: pick(raw.album_audio_id, raw.mixsongid, raw.mix_id, raw.audio_id),
      timelength: pick(raw.timelength, raw.timelen, raw.duration),
    },
    'cloud',
  );
  return {
    ...song,
    fileId: text(pick(raw.fileid, raw.file_id)),
    kvId: text(pick(raw.kv_id, raw.kvid, raw.id)),
  };
}

/** 云盘歌曲 */
export async function getCloudSongs(page = 1, pageSize = 50): Promise<{ songs: CloudSong[]; total: number }> {
  const body = await callModuleBody('/user/cloud', { page, pagesize: pageSize });
  const data = body?.data || {};
  const list = arrayFrom(data, 'list', 'data_list', 'songs', 'info');
  return {
    songs: list.map(normalizeCloudSong),
    total: num(pick(data.total, data.count, list.length)),
  };
}

/** 删除云盘歌曲 */
export async function deleteCloudSongs(songs: CloudSong[]): Promise<void> {
  const fileIds = songs.map((song) => song.fileId).filter(Boolean);
  const kvIds = songs.map((song) => song.kvId).filter(Boolean);
  const albumAudioIds = songs.map((song) => song.albumAudioId).filter(Boolean);
  if (!fileIds.length && !kvIds.length && !albumAudioIds.length) return;
  await callModuleBody('/user/cloud/del', {
    fileids: fileIds.join(','),
    kv_ids: kvIds.join(','),
    album_audio_ids: albumAudioIds.join(','),
  });
}

/** 云盘歌曲播放地址（上传的本地文件也可通过这个接口取地址） */
export async function getCloudSongUrl(song: CloudSong): Promise<string> {
  const body = await callModuleBody('/user/cloud/url', {
    hash: song.hash,
    album_audio_id: song.albumAudioId,
    audio_id: song.id,
    name: song.name,
  });
  return text(pick(body?.data?.url, body?.data?.play_url, body?.url));
}

// ---------------------------------------------------------------------------
// 已购内容
// ---------------------------------------------------------------------------

/** 已购单曲 */
export async function getPurchasedSongs(page = 1, pageSize = 50): Promise<{ songs: Song[]; total: number }> {
  const body = await callModuleBody('/user/purchased/songs', { page, pagesize: pageSize });
  const data = body?.data || {};
  const list = arrayFrom(data, 'list', 'data_list', 'songs', 'info');
  return {
    songs: list.map((item) => normalizeSong(item?.song_info || item?.audio_info || item, 'purchased')),
    total: num(pick(data.total, data.count, list.length)),
  };
}

/** 已购专辑 */
export async function getPurchasedAlbums(page = 1, pageSize = 20): Promise<{ albums: Album[]; total: number }> {
  const body = await callModuleBody('/user/purchased/albums', { page, pagesize: pageSize });
  const data = body?.data || {};
  const list = arrayFrom(data, 'list', 'data_list', 'albums', 'info');
  return {
    albums: list.map((item) => normalizeAlbum(item?.album_info || item)),
    total: num(pick(data.total, data.count, list.length)),
  };
}

// ---------------------------------------------------------------------------
// VIP
// ---------------------------------------------------------------------------

/** 概念版 VIP 详情 */
export async function getUserVipDetail(): Promise<any> {
  const body = await callModuleBody('/user/vip/detail');
  return body?.data || body;
}

/** 联名 VIP 信息 */
export async function getUnionVip(): Promise<any> {
  const body = await callModuleBody('/youth/union/vip');
  return body?.data || body;
}

/** 批量查询 union vip 信息 */
export async function getBatchUnionVip(userids: string[]): Promise<any> {
  const body = await callModuleBody('/user/batch/union/vipinfo', {
    userids: userids.join(','),
    userid_list: userids.join(','),
    kugouid: userids.join(','),
    get_type: 1,
    busi_type: 1,
  });
  return body?.data || body;
}

/** 账号页聚合；任一接口失败返回空值 */
export async function getUserCenter(): Promise<{
  profile: PublicUser | null;
  followers: PublicUser[];
  following: PublicUser[];
}> {
  const [profile, followers, following] = await Promise.all([
    fallback(() => getUserDetail(), null),
    fallback(getFans, []),
    fallback(getFollowedUsers, []),
  ]);
  return { profile, followers, following };
}
