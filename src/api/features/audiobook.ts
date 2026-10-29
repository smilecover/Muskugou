/**
 * 听书（长音频）接口。
 *
 * 书库、每日/每周/榜单/VIP 推荐、标签、搜索、详情与章节。
 * 章节数据可以归一化成 `Song` 直接交给播放器播放。
 */

import { callModuleBody } from '../registry';
import { normalizeSong, type Song } from '../normalize';
import { arrayFrom, fallback, image, num, pick, text } from './common';

export interface Audiobook {
  id: string;
  name: string;
  author: string;
  cover: string;
  intro: string;
  playCount: number;
  chapterCount: number;
  tags: string[];
  category: string;
  publishDate: string;
  recommendReason: string;
  sourceType: number;
}

/** 把听书专辑对象归一化 */
export function normalizeAudiobook(raw: any): Audiobook {
  const tags = arrayFrom(raw, 'album_tag')
    .map((tag) => text(tag.tag_name))
    .filter(Boolean);
  return {
    id: text(pick(raw.album_id, raw.albumid, raw.id)),
    name: text(pick(raw.album_name, raw.albumname, raw.name)) || '未命名有声书',
    author: text(
      pick(
        raw.author_name,
        raw.author,
        arrayFrom(raw, 'authors')
          .map((author) => author?.author_name)
          .join('、'),
      ),
    ),
    cover: image(pick(raw.sizable_cover, raw.cover, raw.imgurl, raw.album_cover), 480),
    intro: text(pick(raw.intro, raw.remark, raw.recommend_reason)),
    playCount: num(pick(raw.play_times, raw.play_count, raw.playcount)),
    chapterCount: num(pick(raw.audio_total, raw.chapter_count, raw.song_count, raw.count)),
    tags,
    category: text(raw.category),
    publishDate: text(pick(raw.publish_date, raw.publish_time)),
    recommendReason: text(pick(raw.recommend_reason, raw.recommend_name, raw.rec_tag)),
    sourceType: num(raw.source_type),
  };
}

export interface AudiobookShelf {
  title: string;
  albums: Audiobook[];
}

/** 免费书库（按标签分页） */
export async function getAudiobooks(
  tagId: string | number = 906,
  page = 1,
  pageSize = 30,
  sort = '',
): Promise<{ albums: Audiobook[]; hasMore: boolean }> {
  const body = await callModuleBody('/longaudio/album/list', {
    tag_id: tagId,
    page,
    page_size: pageSize,
    sort: sort || undefined,
  });
  const data = body?.data || {};
  const albums = arrayFrom(data, 'data_list').map(normalizeAudiobook);
  return { albums, hasMore: !Number(data.is_end ?? 0) && albums.length > 0 };
}

/** 每日推荐 */
export async function getAudiobookDaily(): Promise<Audiobook[]> {
  const body = await callModuleBody('/longaudio/daily/recommend', { page: 1, pagesize: 20 });
  return arrayFrom(body, 'data.albums').map(normalizeAudiobook);
}

/** 每周推荐 / VIP 推荐（结构一致） */
export async function getAudiobookWeekly(): Promise<Audiobook[]> {
  const body = await callModuleBody('/longaudio/week/recommend');
  return arrayFrom(body, 'data.list').map(normalizeAudiobook);
}

export async function getAudiobookVip(): Promise<Audiobook[]> {
  const body = await callModuleBody('/longaudio/vip/recommend');
  return arrayFrom(body, 'data.list').map(normalizeAudiobook);
}

export interface AudiobookRankShelf {
  name: string;
  tagId: string;
  albums: Audiobook[];
}

/** 榜单推荐（按分类分组） */
export async function getAudiobookRanks(): Promise<AudiobookRankShelf[]> {
  const body = await callModuleBody('/longaudio/rank/recommend');
  return arrayFrom(body, 'data').map((group) => ({
    name: text(group.rank_name) || '榜单',
    tagId: text(group.tag_id),
    albums: arrayFrom(group, 'albums').map(normalizeAudiobook),
  }));
}

export interface AudiobookTag {
  id: string;
  name: string;
  showVip: boolean;
}

export interface AudiobookTagGroup {
  id: string;
  name: string;
  icon: string;
  tags: AudiobookTag[];
}

/** 听书分类标签 */
export async function getAudiobookTags(): Promise<AudiobookTagGroup[]> {
  const body = await callModuleBody('/longaudio/tag/list');
  return arrayFrom(body, 'data').map((group) => ({
    id: text(group.tag_id),
    name: text(pick(group.top_tag_name, group.tag_name)) || '分类',
    icon: image(group.pic_img, 200),
    tags: arrayFrom(group, 'son').map((tag) => ({
      id: text(tag.tag_id),
      name: text(tag.tag_name),
      showVip: Boolean(num(tag.show_vip)),
    })),
  }));
}

export interface AudiobookDetail extends Audiobook {
  /** 富文本简介，已去掉 HTML 标签 */
  description: string;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 有声书详情 */
export async function getAudiobookDetail(albumId: string): Promise<AudiobookDetail> {
  // 该模块内部会调用 album_id.split，必须传字符串
  const body = await callModuleBody('/longaudio/album/detail', { album_id: String(albumId) });
  const raw = arrayFrom(body, 'data')[0] || body?.data || {};
  const fullIntro = text(raw.full_intro);
  let description = '';
  if (fullIntro) {
    try {
      const parsed = JSON.parse(fullIntro);
      description = stripHtml(
        Array.isArray(parsed) ? parsed.map((item) => item?.content || '').join(' ') : fullIntro,
      );
    } catch {
      description = stripHtml(fullIntro);
    }
  }
  return {
    ...normalizeAudiobook(raw),
    description: description || stripHtml(text(raw.intro)),
  };
}

export interface Chapter {
  id: string;
  name: string;
  duration: number;
  index: number;
  publishDate: string;
  song: Song;
}

/** 章节列表（可直接播放） */
export async function getAudiobookChapters(
  albumId: string,
  page = 1,
  pageSize = 50,
): Promise<{ chapters: Chapter[]; hasMore: boolean }> {
  const body = await callModuleBody('/longaudio/album/audios', {
    album_id: albumId,
    page,
    pagesize: pageSize,
  });
  const list = arrayFrom(body, 'data');
  const chapters = list.map((raw, index) => {
    const song = normalizeSong({ ...raw, album_id: raw.album_id || albumId }, 'audiobook');
    return {
      id: text(pick(raw.cid, raw.audio_id, song.id)),
      name: text(pick(raw.audio_name, raw.name, song.name)),
      duration: song.duration,
      index: (page - 1) * pageSize + index + 1,
      publishDate: text(pick(raw.publish_date, raw.addtime)),
      song,
    };
  });
  return { chapters, hasMore: chapters.length >= pageSize };
}

/** 听书搜索：返回章节音频，可直接播放 */
export async function searchAudiobooks(keyword: string, page = 1, pageSize = 30): Promise<Song[]> {
  const body = await callModuleBody('/longaudio/search', { keywords: keyword, page, pagesize: pageSize });
  return arrayFrom(body, 'data.lists', 'data.list').map((item) => normalizeSong(item, 'audiobook'));
}

/** 一次加载每日 + 每周 + VIP，任一失败不影响其它区块 */
export async function getAudiobookHome(): Promise<{
  daily: Audiobook[];
  weekly: Audiobook[];
  vip: Audiobook[];
}> {
  const [daily, weekly, vip] = await Promise.all([
    fallback(getAudiobookDaily, []),
    fallback(getAudiobookWeekly, []),
    fallback(getAudiobookVip, []),
  ]);
  return { daily, weekly, vip };
}
