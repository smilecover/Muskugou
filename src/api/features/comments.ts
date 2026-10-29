/**
 * 评论与弹幕。
 *
 * 歌曲、歌单、专辑共用一套评论数据结构；楼层回复通过 `special_id + tid` 拉取。
 * 发送/删除评论需要登录（概念版登录即可）。
 */

import { callModuleBody } from '../registry';
import { arrayFrom, num, pick, text } from './common';

export type CommentResource = 'song' | 'playlist' | 'album';

export interface CommentItem {
  id: string;
  content: string;
  userName: string;
  userAvatar: string;
  userId: string;
  /** 评论时间，原始格式 YYYY-MM-DD HH:mm:ss */
  time: string;
  /** 点赞数（接口不一定返回） */
  likes: number;
  replyCount: number;
  /** 资源类型对应的 id */
  specialId: string;
  childId: string;
  /** 楼层请求需要的 code/tid */
  code: string;
  city: string;
  hot: boolean;
}

function normalizeComment(raw: any, index = 0): CommentItem {
  let city = '';
  const extdata = text(raw.extdata);
  if (extdata) {
    try {
      city = text(JSON.parse(extdata)?.city);
    } catch {
      city = '';
    }
  }
  return {
    id: text(pick(raw.id, raw.comment_id, raw.cid)) || `c-${index}`,
    content: text(pick(raw.content, raw.comment, raw.msg)),
    userName: text(pick(raw.user_name, raw.nickname, raw.username)) || '酷狗用户',
    userAvatar: text(pick(raw.user_pic, raw.avatar, raw.user_avatar)),
    userId: text(pick(raw.user_id, raw.userid)),
    time: text(pick(raw.addtime, raw.create_time, raw.time)),
    likes: num(pick(raw.praise_num, raw.like_num, raw.likes, raw.praise_count)),
    replyCount: num(pick(raw.reply_num, raw.reply_count, raw.comment_count)),
    specialId: text(pick(raw.special_child_id, raw.special_id)),
    childId: text(pick(raw.special_id, raw.special_child_id)),
    code: text(raw.code),
    city,
    hot: Boolean(num(raw.is_hot) || index < 3),
  };
}

export interface CommentPage {
  comments: CommentItem[];
  /** 总评论数 */
  total: number;
  page: number;
  hasMore: boolean;
  /** 热门搜索词 / 分类标签 */
  hotWords: string[];
}

function parseCommentPage(body: any, page: number, pageSize: number, resource: CommentResource): CommentPage {
  const list = arrayFrom(body, 'list', 'lists', 'data.list', 'data.lists', 'comments');
  const total = num(
    pick(body?.combine_count, body?.count, body?.total, body?.data?.total, body?.data?.count, list.length),
  );
  const hotWords = arrayFrom(body, 'hot_word_list')
    .map((item) => text(item?.content))
    .filter(Boolean);
  return {
    comments: list.map((raw, index) => {
      const item = normalizeComment(raw, index);
      // 歌单/专辑的 special_id 字段含义不同，补上请求上下文更稳妥
      if (resource !== 'song' && !item.specialId) item.specialId = text(raw.special_id);
      return item;
    }),
    total,
    page,
    hasMore: page * pageSize < total,
    hotWords,
  };
}

/** 歌曲评论 */
export async function getSongComments(mixsongid: string, page = 1, pageSize = 30): Promise<CommentPage> {
  const body = await callModuleBody('/comment/music', { mixsongid, page, pagesize: pageSize });
  return parseCommentPage(body, page, pageSize, 'song');
}

/** 歌单评论 */
export async function getPlaylistComments(id: string, page = 1, pageSize = 30): Promise<CommentPage> {
  const body = await callModuleBody('/comment/playlist', { id, page, pagesize: pageSize });
  return parseCommentPage(body, page, pageSize, 'playlist');
}

/** 专辑评论 */
export async function getAlbumComments(id: string, page = 1, pageSize = 30): Promise<CommentPage> {
  const body = await callModuleBody('/comment/album', { id, page, pagesize: pageSize });
  return parseCommentPage(body, page, pageSize, 'album');
}

/** 楼中楼回复 */
export async function getFloorComments(
  comment: Pick<CommentItem, 'specialId' | 'code' | 'id'>,
  page = 1,
  pageSize = 30,
  resource: CommentResource = 'song',
  mixsongid = '',
): Promise<CommentPage> {
  const body = await callModuleBody('/comment/floor', {
    special_id: comment.specialId,
    tid: comment.id,
    code: comment.code || undefined,
    page,
    pagesize: pageSize,
    resource_type: resource,
    mixsongid: mixsongid || undefined,
  });
  return parseCommentPage(body, page, pageSize, resource);
}

/** 评论数（歌曲） */
export async function getCommentCount(hash: string, specialId: string): Promise<number> {
  const body = await callModuleBody('/comment/count', { hash, special_id: specialId });
  return num(pick(body?.data?.count, body?.data?.comment_count, body?.count, body?.data));
}

/** 歌曲评论热词 */
export async function getCommentHotWords(mixsongid: string): Promise<string[]> {
  const body = await callModuleBody('/comment/music/hotword', { mixsongid });
  return arrayFrom(body, 'data.hot_word_list', 'data.list', 'hot_word_list')
    .map((item) => text(item?.content || item?.word || item))
    .filter(Boolean);
}

/** 评论分类（全部 / 精彩评论等） */
export async function getCommentClassify(mixsongid: string): Promise<{ name: string; type: string; count: number }[]> {
  const body = await callModuleBody('/comment/music/classify', { mixsongid });
  return arrayFrom(body, 'data.tag', 'data.list', 'tag').map((item) => ({
    name: text(item?.name),
    type: text(item?.type),
    count: num(item?.count),
  }));
}

/** 发送歌曲评论 */
export async function sendSongComment(params: {
  mixsongid: string;
  content: string;
  songName: string;
  specialId?: string;
  childId?: string;
}): Promise<void> {
  await callModuleBody('/comment/music/send', {
    mixsongid: params.mixsongid,
    content: params.content,
    song_name: params.songName,
    name: params.songName,
    special_id: params.specialId,
    childrenid: params.childId || params.mixsongid,
    childrenname: params.songName,
  });
}

/** 发送歌单评论 */
export async function sendPlaylistComment(params: {
  id: string;
  content: string;
  playlistName: string;
}): Promise<void> {
  await callModuleBody('/comment/playlist/send', {
    id: params.id,
    playlist_id: params.id,
    content: params.content,
    playlist_name: params.playlistName,
    name: params.playlistName,
  });
}

/** 发送专辑评论 */
export async function sendAlbumComment(params: {
  id: string;
  content: string;
  albumName: string;
}): Promise<void> {
  await callModuleBody('/comment/album/send', {
    id: params.id,
    album_id: params.id,
    content: params.content,
    album_name: params.albumName,
    name: params.albumName,
  });
}

/** 删除自己的评论 */
export async function deleteSongComment(comment: CommentItem, mixsongid: string): Promise<void> {
  await callModuleBody('/comment/music/del', {
    comment_id: comment.id,
    cid: comment.id,
    mixsongid,
    special_id: comment.specialId,
    childrenid: comment.childId,
  });
}

// ---------------------------------------------------------------------------
// 弹幕
// ---------------------------------------------------------------------------

export interface BarrageItem {
  id: string;
  content: string;
  time: number;
  userName: string;
  color: string;
}

/** 歌曲弹幕 */
export async function getSongBarrage(hash: string, specialId: string, mixsongid: string): Promise<BarrageItem[]> {
  const body = await callModuleBody('/song/barrage', {
    hash,
    special_id: specialId,
    childrenid: specialId,
    id: mixsongid,
  });
  return arrayFrom(body, 'data.list', 'data.barrage_list', 'list').map((item, index) => ({
    id: text(item?.id) || `b-${index}`,
    content: text(item?.content),
    time: num(pick(item?.time, item?.timeline, item?.offset)),
    userName: text(item?.user_name),
    color: text(item?.color) || '#ffffff',
  }));
}

/** 发送歌曲弹幕 */
export async function sendSongBarrage(params: {
  hash: string;
  specialId: string;
  mixsongid: string;
  content: string;
  songName: string;
}): Promise<void> {
  await callModuleBody('/song/barrage/send', {
    hash: params.hash,
    schash: params.hash,
    special_id: params.specialId,
    id: params.mixsongid,
    childrenid: params.specialId,
    content: params.content,
    song_name: params.songName,
    name: params.songName,
  });
}

/** 视频弹幕 */
export async function getVideoBarrage(videoId: string, hash: string): Promise<BarrageItem[]> {
  const body = await callModuleBody('/video/barrage', { video_id: videoId, hash });
  return arrayFrom(body, 'data.list', 'data.barrage_list', 'list').map((item, index) => ({
    id: text(item?.id) || `vb-${index}`,
    content: text(item?.content),
    time: num(pick(item?.time, item?.timeline, item?.offset)),
    userName: text(item?.user_name),
    color: text(item?.color) || '#ffffff',
  }));
}
