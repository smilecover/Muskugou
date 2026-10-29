/**
 * 歌单广场与歌单管理。
 *
 * - 广场：分类标签 + 分类歌单分页
 * - 详情 / 相似歌单
 * - 收藏歌单、删除歌单、增删歌曲
 *
 * 增删歌曲的接口要求登录，并且参数是原库约定的 `name|hash|album_id|mixsongid`
 * 字符串；歌名里的逗号会破坏分隔，因此这里会先做清洗。
 */

import { callModuleBody } from '../registry';
import { normalizePlaylist, type Playlist, type Song } from '../normalize';
import { arrayFrom, num, pick, text } from './common';

export interface PlaylistTagGroup {
  id: string;
  name: string;
  tags: { id: string; name: string }[];
}

/** 歌单分类标签 */
export async function getPlaylistTags(): Promise<PlaylistTagGroup[]> {
  const body = await callModuleBody('/playlist/tags');
  return arrayFrom(body, 'data').map((group) => ({
    id: text(group.tag_id),
    name: text(group.tag_name) || '分类',
    tags: arrayFrom(group, 'son').map((tag) => ({
      id: text(tag.tag_id),
      name: text(tag.tag_name),
    })),
  }));
}

export interface PlaylistSquare {
  playlists: Playlist[];
  total: number;
  hasMore: boolean;
}

/** 分类歌单广场 */
export async function getPlaylistSquare(
  categoryId = 0,
  page = 1,
  pageSize = 30,
  sort = '',
): Promise<PlaylistSquare> {
  const body = await callModuleBody('/top/playlist', {
    category_id: categoryId,
    page,
    pagesize: pageSize,
    sort: sort || undefined,
    withsong: 0,
    withtag: 0,
  });
  const data = body?.data || {};
  const playlists = arrayFrom(data, 'special_list').map((item) => normalizePlaylist(item));
  const total = num(pick(data.total, data.count, playlists.length));
  return {
    playlists,
    total,
    hasMore: Boolean(num(data.has_next)) || page * pageSize < total,
  };
}

/** 歌单详情（名称、封面、简介等） */
export async function getPlaylistDetail(id: string): Promise<Playlist | null> {
  try {
    const body = await callModuleBody('/playlist/detail', { ids: id });
    const raw = arrayFrom(body, 'data')[0];
    if (raw) return normalizePlaylist({ ...raw, global_collection_id: id });
  } catch {
    // 详情接口偶尔只支持部分歌单，退回歌曲接口的第一页资料
  }
  return null;
}

/** 相似歌单 */
export async function getSimilarPlaylists(id: string): Promise<Playlist[]> {
  const body = await callModuleBody('/playlist/similar', { ids: id });
  const groups = arrayFrom(body, 'data');
  const playlists: Playlist[] = [];
  for (const group of groups) {
    playlists.push(...arrayFrom(group, 'collection_list').map((item) => normalizePlaylist(item)));
  }
  return playlists;
}

/** 收藏歌单（需要登录） */
export async function collectPlaylist(playlist: Playlist): Promise<void> {
  await callModuleBody('/playlist/add', {
    name: playlist.name,
    source: 1,
    type: 0,
    list_create_gid: playlist.id,
    list_create_listid: playlist.listId || undefined,
    list_create_userid: playlist.creatorId || undefined,
  });
}

/** 删除 / 取消收藏歌单（需要登录） */
export async function deletePlaylist(listid: string): Promise<void> {
  await callModuleBody('/playlist/del', { listid });
}

/** 修改歌单信息（需要登录） */
export async function updatePlaylist(
  listid: string,
  data: { name?: string; tags?: string; intro?: string; totalVer?: string | number },
): Promise<void> {
  await callModuleBody('/playlist/update', {
    listid,
    name: data.name,
    tags: data.tags,
    intro: data.intro,
    total_ver: data.totalVer ?? 0,
    type: 0,
  });
}

/** 把歌名里的分隔符清洗掉，避免破坏原库的 `name|hash|...` 协议 */
function sanitize(value: string): string {
  return value.replace(/[|,]/g, ' ').trim();
}

/**
 * 批量添加歌曲到歌单。
 * `listid` 必须是用户歌单的数字 listid（不是 collection_xxx）。
 */
export async function addSongsToPlaylist(listid: string, songs: Song[]): Promise<void> {
  if (!songs.length) return;
  const rows = songs
    .filter((song) => song.hash)
    .map((song) =>
      [
        sanitize(song.name),
        song.hash,
        song.albumId || 0,
        song.albumAudioId || song.id || 0,
      ].join('|'),
    );
  if (!rows.length) return;
  await callModuleBody('/playlist/tracks/add', { listid, data: rows.join(',') });
}

/** 从歌单移除歌曲（按 fileid，需要 Song.fileId） */
export async function removeSongsFromPlaylist(listid: string, fileIds: string[]): Promise<void> {
  const ids = fileIds.filter(Boolean);
  if (!ids.length) return;
  await callModuleBody('/playlist/tracks/del', { listid, fileids: ids.join(',') });
}

/** 歌单歌曲排序 */
export async function sortPlaylistTracks(
  listid: string,
  songs: Pick<Song, 'fileId'>[],
  listVer: string | number = 0,
): Promise<void> {
  const data = songs
    .filter((song) => song.fileId)
    .map((song, index) => `${song.fileId}|${index + 1}`)
    .join(',');
  if (!data) return;
  await callModuleBody('/playlist/tracks/sort', { listid, data, list_ver: listVer });
}

/** 歌单动态（收藏/评论等） */
export async function getPlaylistEffect(page = 1, pageSize = 20): Promise<any[]> {
  const body = await callModuleBody('/playlist/effect', { page, pagesize: pageSize });
  return arrayFrom(body, 'data.list', 'data');
}
