/**
 * 搜索扩展：歌词搜索。
 *
 * 普通歌曲/歌单/专辑/歌手搜索在 `client.ts`；MV 搜索在 `video.ts`；
 * 听书搜索在 `audiobook.ts`。这里补齐按歌词找歌。
 */

import { callModuleBody } from '../registry';
import { arrayFrom, num, pick, text } from './common';

export interface LyricSearchItem {
  id: string;
  name: string;
  artist: string;
  hash: string;
  albumId: string;
  duration: number;
  /** 歌词片段 */
  lyric: string;
  /** 匹配到的歌名/歌词高亮片段 */
  fileName: string;
}

/** 按歌词搜索歌曲（/search type=lyric） */
export async function searchLyrics(
  keyword: string,
  page = 1,
  pageSize = 30,
): Promise<{ items: LyricSearchItem[]; total: number }> {
  const body = await callModuleBody('/search', { type: 'lyric', keywords: keyword, page, pagesize: pageSize });
  const items = arrayFrom(body, 'data.lists', 'data.list').map((item) => ({
    id: text(pick(item.LyricID, item.FileHash)),
    name: text(pick(item.SongName, item.FileName)) || '未知歌曲',
    artist: text(item.SingerName),
    hash: text(item.FileHash),
    albumId: text(item.AlbumID),
    duration: num(item.Duration) * 1000,
    lyric: text(item.Lyric),
    fileName: text(item.FileName),
  }));
  return { items, total: num(pick(body?.data?.total, body?.total, items.length)) };
}

/** 搜索默认提示词（无结果时展示） */
export async function getSearchDefaultKeyword(): Promise<string> {
  const body = await callModuleBody('/search/default');
  return text(pick(body?.data?.fallback, body?.data?.keyword, body?.data?.default_keyword));
}
