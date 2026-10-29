/**
 * 账号相关：用户资料、听歌等级、关注/粉丝、云盘、已购、VIP 详情。
 *
 * 这些接口大多需要登录；未登录时由页面引导到登录页。
 * 酷狗的用户资料接口只对当前登录账号可靠：查看他人主页时先用列表里缓存的
 * 昵称/头像兜底，再通过概念版公开音乐接口展示对方公开的内容。
 */

import { getAuth, hasLogin } from '../core/jar';
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

// ---------------------------------------------------------------------------
// 用户资料缓存
// ---------------------------------------------------------------------------

/**
 * 会话内记住列表里出现过的用户。
 *
 * 酷狗没有公开的“按 userid 查资料”接口，`/user/detail` 也只对当前账号最可靠。
 * 从关注/粉丝/评论等列表进入主页时，先用列表里已有的昵称和头像兜底，
 * 再尝试请求详情，避免页面顶部一片空白。
 */
const knownUsers = new Map<string, PublicUser>();
const MAX_KNOWN_USERS = 200;

export function rememberUser(user: PublicUser | null | undefined): void {
  if (!user?.id) return;
  const existing = knownUsers.get(user.id);
  if (!knownUsers.has(user.id) && knownUsers.size >= MAX_KNOWN_USERS) {
    const oldest = knownUsers.keys().next().value;
    if (oldest) knownUsers.delete(oldest);
  }
  knownUsers.set(
    user.id,
    existing
      ? {
          ...existing,
          ...user,
          // 后拿到的资料可能只有昵称/头像，不要用它覆盖已有的签名与统计
          name: user.name && user.name !== '酷狗用户' ? user.name : existing.name,
          avatar: user.avatar || existing.avatar,
          signature: user.signature || existing.signature,
          fans: user.fans || existing.fans,
          follows: user.follows || existing.follows,
          songs: user.songs || existing.songs,
        }
      : user,
  );
}

/** 读取会话内缓存过的用户资料；不会发起网络请求 */
export function getRememberedUser(userid: string): PublicUser | null {
  const key = text(userid);
  return key ? knownUsers.get(key) || null : null;
}

function normalizeUser(raw: any): PublicUser {
  const user: PublicUser = {
    id: text(pick(raw.userid, raw.user_id, raw.id, raw.t_userid)),
    name: text(pick(raw.nickname, raw.user_name, raw.name)) || '酷狗用户',
    avatar: image(pick(raw.user_pic, raw.avatar, raw.pic, raw.img), 200),
    signature: text(pick(raw.signature, raw.intro, raw.user_sign)),
    fans: num(pick(raw.fans_num, raw.fans, raw.fansnums)),
    follows: num(pick(raw.follow_num, raw.follows, raw.follownums)),
    songs: num(pick(raw.song_num, raw.song_count, raw.audio_count)),
  };
  rememberUser(user);
  return user;
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

  const user = normalizeUser(raw);
  // 响应没有 userid 时：
  // - 查询自己：回退到当前登录账号；
  // - 查询他人：不强行套用目标 id，调用方可以据此判断详情是否真的属于目标用户。
  if (!user.id && !userid) user.id = text(getAuth().userid);
  return user;
}

// ---------------------------------------------------------------------------
// 听歌等级
// ---------------------------------------------------------------------------

export interface UserGrade {
  /** 当前听歌等级 */
  level: number;
  /** 当前累计积分 */
  currentPoint: number;
  /** 当前等级起始积分 */
  levelPoint: number;
  /** 下一级等级；已满级时与 level 相同或更小 */
  nextLevel: number;
  /** 下一级所需积分 */
  nextLevelPoint: number;
  /** 累计听歌秒数（d_sec） */
  listenSeconds: number;
  /** 服务端返回的累计听歌分钟数（duration） */
  listenMinutes: number;
  /** 服务端时间 */
  serverTime: string;
  /** 距离下一级的进度，0~1；满级时为 1 */
  progress: number;
  /** 距离下一级还差多少积分；满级时为 0 */
  pointsToNext: number;
  /** 是否已经满级 */
  maxLevel: boolean;
}

/** 查询当前账号的听歌等级、积分与累计听歌时长 */
export async function getUserGrade(): Promise<UserGrade> {
  if (!hasLogin()) throw new Error('请先登录后再查看听歌等级');

  const body = await callModuleBody('/user/grade/info');
  const data = body?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('听歌等级接口没有返回数据');
  }

  const level = num(pick(data.p_grade, data.grade));
  const currentPoint = num(pick(data.p_current_point, data.current_point, data.point));
  const levelPoint = num(pick(data.p_grade_point, data.grade_point));
  const nextLevel = num(pick(data.p_next_grade, data.next_grade));
  const nextLevelPoint = num(pick(data.p_next_grade_point, data.next_grade_point));
  const listenSeconds = num(pick(data.d_sec, data.listen_seconds, data.listen_time));
  const listenMinutes = num(pick(data.duration, data.listen_minutes, data.listen_min));
  const maxLevel = nextLevel <= 0 || nextLevel <= level || nextLevelPoint <= levelPoint;
  const span = nextLevelPoint - levelPoint;
  const progress = maxLevel || span <= 0
    ? 1
    : Math.min(1, Math.max(0, (currentPoint - levelPoint) / span));

  return {
    level,
    currentPoint,
    levelPoint,
    nextLevel,
    nextLevelPoint,
    listenSeconds,
    listenMinutes,
    serverTime: text(data.servertime),
    progress,
    pointsToNext: maxLevel ? 0 : Math.max(0, nextLevelPoint - currentPoint),
    maxLevel,
  };
}

// ---------------------------------------------------------------------------
// 公开音乐
// ---------------------------------------------------------------------------

export interface PublicUserMusic {
  songs: Song[];
  total: number;
  /**
   * 接口顺带返回的公开资料。
   *
   * `/youth/user/song` 即使没有公开歌曲，也会返回 `nick_name` / `user_pic`，
   * 因此他人主页可以直接用它显示昵称和头像，不必依赖列表缓存。
   */
  user: PublicUser | null;
}

/** 用户公开的音乐（概念版主页），可用于查看他人；分页返回 */
export async function getUserPublicSongs(
  userid: string,
  page = 1,
  pageSize = 30,
): Promise<PublicUserMusic> {
  const id = text(userid);
  if (!id) return { songs: [], total: 0, user: null };

  const body = await callModuleBody('/youth/user/song', {
    userid: id,
    page,
    pagesize: pageSize,
  });
  const data = body?.data || {};
  const list = arrayFrom(body, 'data.list', 'data.songs', 'data.song_list', 'data.info', 'data');

  const nickname = text(pick(data.nick_name, data.nickname));
  const avatar = image(pick(data.user_pic, data.avatar), 200);
  let publicUser: PublicUser | null = null;
  if (nickname || avatar) {
    publicUser = {
      id: text(pick(data.userid, data.user_id)) || id,
      name: nickname || '酷狗用户',
      avatar,
      signature: '',
      fans: 0,
      follows: 0,
      songs: num(pick(data.list_count, data.total, data.song_count)),
    };
    rememberUser(publicUser);
  }

  return {
    songs: list.map((item) =>
      normalizeSong(item?.song_info || item?.audio_info || item, 'public'),
    ),
    // list_count 是公开音乐总数；没有时才退回通用 total/count
    total: num(pick(data.list_count, data.total, data.count, list.length)),
    user: publicUser,
  };
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
