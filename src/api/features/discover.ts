/**
 * 发现 / 每日推荐 / 主题 / 场景 / IP 专区 / 电台 / 乐库。
 *
 * 全部走概念版可用的公开接口；个别接口（如 IP 专区首页）在上游不稳定，
 * 这里用 `fallback` 隔离，页面仍然可以展示其它区块。
 */

import { callModuleBody } from '../registry';
import { normalizePlaylist, normalizeSong, type Playlist, type Song } from '../normalize';
import { arrayFrom, fallback, image, num, pick, text } from './common';
import { normalizeMv, type Mv } from './video';

// ---------------------------------------------------------------------------
// 每日推荐
// ---------------------------------------------------------------------------

export interface DailyRecommend {
  /** 推荐日期，YYYYMMDD */
  date: string;
  cover: string;
  subtitle: string;
  songs: Song[];
}

/** 今日推荐（概念版每日 30 首） */
export async function getDailyRecommend(): Promise<DailyRecommend> {
  const body = await callModuleBody('/everyday/recommend');
  const data = body?.data || {};
  const songs = arrayFrom(data, 'song_list').map((item) => normalizeSong(item, 'daily'));
  return {
    date: text(data.creation_date),
    cover: image(data.cover_img_url),
    subtitle: text(data.sub_title) || '根据你的口味生成，每天更新',
    songs,
  };
}

export interface DailyHistoryItem {
  /** 历史日期，YYYYMMDD */
  date: string;
  title: string;
  name: string;
  songCount: number;
}

/** 每日推荐历史（只返回日期列表，歌曲按需加载） */
export async function getDailyHistory(): Promise<DailyHistoryItem[]> {
  const body = await callModuleBody('/everyday/history', { mode: 'list' });
  const list = arrayFrom(body, 'data.lists', 'data.list', 'lists');
  return list.map((item) => ({
    date: text(pick(item.date, item.history_name)),
    title: text(pick(item.history_title, item.history_name, item.date)),
    name: text(pick(item.history_name, item.date)),
    songCount: arrayFrom(item, 'song_list').length,
  }));
}

/** 某一天的推荐歌曲 */
export async function getDailyHistorySongs(date: string): Promise<Song[]> {
  const body = await callModuleBody('/everyday/history', { mode: 'song', date });
  const data = body?.data || {};
  const candidates = [
    ...arrayFrom(data, 'song_list'),
    ...arrayFrom(data, 'lists.0.song_list'),
    ...arrayFrom(body, 'song_list'),
  ];
  return candidates.map((item) => normalizeSong(item, 'daily-history'));
}

export interface StyleTag {
  name: string;
  id: string;
  children: { name: string; id: string }[];
}

export interface StyleRecommend {
  title: string;
  tagIds: string;
  songs: Song[];
  tags: StyleTag[];
}

/** 风格推荐（/everyday/style/recommend） */
export async function getStyleRecommend(tagids = 'S14'): Promise<StyleRecommend> {
  const body = await callModuleBody('/everyday/style/recommend', { tagids });
  const data = body?.data || {};
  const tags: StyleTag[] = arrayFrom(data, 'tag_info').map((item) => ({
    name: text(item.name),
    id: text(item.tagids),
    children: arrayFrom(item, 'child').map((child) => ({
      name: text(child.name),
      id: text(child.tagids),
    })),
  }));
  return {
    title: text(data.title) || '风格推荐',
    tagIds: text(data.tagids) || tagids,
    songs: arrayFrom(data, 'song_list').map((item) => normalizeSong(item, 'style')),
    tags,
  };
}

// ---------------------------------------------------------------------------
// 概念卡片 / AI 推荐
// ---------------------------------------------------------------------------

export interface ConceptTag {
  id: string;
  name: string;
  desc: string;
  cover: string;
  songs: Song[];
}

export interface ConceptCard {
  id: number;
  title: string;
  songs: Song[];
  tags: ConceptTag[];
}

/**
 * 概念版推荐卡片。
 *
 * 3005 / 3006 / 3001 等卡片返回 `song_list`；
 * 3103「曲风盲盒」返回 `tag_list`，每个标签下各有一组歌曲。
 */
export async function getConceptCard(cardId = 3005, pagesize = 30, tagid = ''): Promise<ConceptCard> {
  const body = await callModuleBody('/top/card/youth', { card_id: cardId, pagesize, tagid });
  const data = body?.data || {};
  return {
    id: num(pick(data.card_info?.card_id, cardId)),
    title: text(data.card_info?.card_title) || '概念推荐',
    songs: arrayFrom(data, 'song_list').map((item) => normalizeSong(item, 'concept-card')),
    tags: arrayFrom(data, 'tag_list').map((tag) => ({
      id: text(tag.label_id),
      name: text(tag.label_name),
      desc: text(tag.label_desc),
      cover: image(pick(tag.cover_pic, tag.top_cover_pic)),
      songs: arrayFrom(tag, 'song_list').map((item) => normalizeSong(item, 'concept-card')),
    })),
  };
}

/** 基于某首歌的 AI 推荐（用于播放页“相似歌曲”） */
export async function getAiRecommendSongs(albumAudioId: string): Promise<Song[]> {
  const body = await callModuleBody('/ai/recommend', { album_audio_id: albumAudioId });
  return arrayFrom(body, 'data.song_list', 'data.lists', 'data.songs', 'data.info').map((item) =>
    normalizeSong(item?.song_info || item?.audio_info || item, 'ai'),
  );
}

// ---------------------------------------------------------------------------
// 主题音乐
// ---------------------------------------------------------------------------

export interface Theme {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  intro: string;
  cover: string;
  detailPic: string;
  type: string;
  titleColor: string;
  playCount: number;
}

function normalizeTheme(raw: any): Theme {
  return {
    id: text(pick(raw.id, raw.theme_id, raw.category_id)),
    title: text(pick(raw.title, raw.theme_list_title)) || '主题音乐',
    subtitle: text(pick(raw.sub_title, raw.rec_desc)),
    tag: text(raw.tag),
    intro: text(raw.intro),
    cover: image(pick(raw.card_pic, raw.pic, raw.imgurl), 480),
    detailPic: image(pick(raw.detail_pic, raw.pic), 960),
    type: text(raw.type),
    titleColor: text(raw.title_color_hex) || '#f3f6fb',
    playCount: num(pick(raw.play_count, raw.play_times)),
  };
}

/** 主题音乐列表 */
export async function getThemes(): Promise<Theme[]> {
  const body = await callModuleBody('/theme/music');
  const data = body?.data || {};
  return arrayFrom(data, 'all_theme_detail_list', 'theme_list').map(normalizeTheme);
}

export interface ThemeDetail {
  theme: Theme;
  songs: Song[];
}

/** 主题详情与歌曲 */
export async function getThemeDetail(id: string): Promise<ThemeDetail> {
  const body = await callModuleBody('/theme/music/detail', { id });
  const data = body?.data || {};
  const themeRaw = data.theme_detail || data.theme_info || data;
  return {
    theme: normalizeTheme(themeRaw),
    songs: arrayFrom(data, 'song_list').map((item) => normalizeSong(item, 'theme')),
  };
}

// ---------------------------------------------------------------------------
// 场景音乐
// ---------------------------------------------------------------------------

export interface SceneTag {
  id: string;
  name: string;
  cover: string;
}

export interface Scene {
  id: string;
  title: string;
  intro: string;
  popup: string;
  icon: string;
  cover: string;
  background: string;
  color: string;
  sceneType: number;
  songCount: number;
  viewCount: number;
  tags: SceneTag[];
}

/** 场景专区列表（助眠、通勤、运动…） */
export async function getScenes(): Promise<Scene[]> {
  const body = await callModuleBody('/scene/lists');
  return arrayFrom(body, 'data.list').map((item) => {
    const musicTag = item.music_tag || {};
    return {
      id: text(item.scene_id),
      title: text(item.title) || '场景',
      intro: text(item.intro),
      popup: text(item.popup),
      icon: image(item.icon, 200),
      cover: image(item.pic),
      background: image(item.bg_pic, 960),
      color: text(item.color) || '#38e1c6',
      sceneType: num(item.scene_type),
      songCount: num(item.extra?.song_count),
      viewCount: num(item.extra?.view_num),
      tags: arrayFrom(musicTag, 'module_extra').map((tag) => ({
        id: text(tag.tag_id),
        name: text(tag.tag_name),
        cover: image(tag.pic, 240),
      })),
    };
  });
}

export interface SceneSongs {
  songs: Song[];
  total: number;
  hasMore: boolean;
}

/** 场景下的歌曲；tagId 来自 Scene.tags[].id */
export async function getSceneSongs(
  sceneId: string,
  tagId: string,
  page = 1,
  pageSize = 30,
): Promise<SceneSongs> {
  const body = await callModuleBody('/scene/audio/list', {
    id: sceneId,
    tag: tagId,
    page,
    pagesize: pageSize,
  });
  const data = body?.data || {};
  const songs = arrayFrom(data, 'list').map((item) => normalizeSong(item?.song || item, 'scene'));
  const total = num(pick(data.total, data.count, songs.length));
  return { songs, total, hasMore: songs.length > 0 && page * pageSize < total };
}

// ---------------------------------------------------------------------------
// IP 专区
// ---------------------------------------------------------------------------

export interface IpZone {
  id: string;
  ipId: string;
  name: string;
  summary: string;
  icon: string;
  resourceType: number;
  resourceId: string;
}

/** IP 专区入口（影视 / 动漫 / 明星等） */
export async function getIpZones(): Promise<IpZone[]> {
  const body = await callModuleBody('/ip/zone');
  return arrayFrom(body, 'data.list').map((item) => ({
    id: text(pick(item.id, item.ip_id)),
    ipId: text(item.ip_id),
    name: text(item.name) || 'IP 专区',
    summary: text(item.summary),
    icon: image(pick(item.icon, item.pic), 240),
    resourceType: num(item.resource_type),
    resourceId: text(item.resource_id),
  }));
}

/** IP 下的歌单 */
export async function getIpPlaylists(ipId: string, page = 1, pageSize = 20): Promise<Playlist[]> {
  const body = await callModuleBody('/ip/playlist', { id: String(ipId), page, pagesize: pageSize });
  return arrayFrom(body, 'data.info').map((item) => normalizePlaylist(item));
}

// ---------------------------------------------------------------------------
// 电台 / FM
// ---------------------------------------------------------------------------

export interface FmStation {
  id: string;
  name: string;
  cover: string;
  banner: string;
  description: string;
  classId: string;
  className: string;
  heat: number;
}

export interface FmClass {
  id: string;
  name: string;
  count: number;
  stations: FmStation[];
}

function normalizeStation(raw: any): FmStation {
  return {
    id: text(pick(raw.fmid, raw.id)),
    name: text(pick(raw.fmname, raw.name)) || '电台',
    cover: image(pick(raw.banner, raw.imgurl, raw.pic, raw.cover), 480),
    banner: image(pick(raw.banner, raw.imgurl, raw.pic), 960),
    description: text(pick(raw.description, raw.rcm_text)),
    classId: text(pick(raw.classid, raw.class_id)),
    className: text(raw.classname),
    heat: num(raw.heat),
  };
}

/** 电台分类及分类下的电台 */
export async function getFmClasses(): Promise<FmClass[]> {
  const body = await callModuleBody('/fm/class');
  return arrayFrom(body, 'data.class_list').map((item) => ({
    id: text(item.classid),
    name: text(item.classname) || '电台',
    count: num(item.class_count),
    stations: arrayFrom(item, 'fmlist').map(normalizeStation),
  }));
}

/** 推荐电台 */
export async function getFmRecommend(): Promise<FmStation[]> {
  const body = await callModuleBody('/fm/recommend');
  const classes = arrayFrom(body, 'data');
  const stations: FmStation[] = [];
  for (const item of classes) {
    const list = arrayFrom(item, 'rcmdlist', 'fmlist');
    for (const station of list) {
      stations.push(normalizeStation({ ...station, classid: station.classid || item.classid, classname: item.classname }));
    }
  }
  return stations;
}

/** 电台歌曲（可分页） */
export async function getFmSongs(fmid: string, offset = 0, size = 30): Promise<Song[]> {
  const body = await callModuleBody('/fm/songs', { fmid: String(fmid), offset, size });
  const data = arrayFrom(body, 'data');
  const songs: Song[] = [];
  for (const group of data) {
    songs.push(...arrayFrom(group, 'songs').map((item) => normalizeSong(item, 'fm')));
  }
  return songs;
}

// ---------------------------------------------------------------------------
// 乐库
// ---------------------------------------------------------------------------

export interface YuekuData {
  songs: Song[];
  videos: Mv[];
  albums: { id: string; name: string; artist: string; cover: string; publishTime: string }[];
  ranks: { id: string; rankCid: string; name: string; cover: string; intro: string }[];
}

/** 乐库聚合页（歌曲 / 视频 / 专辑 / 榜单） */
export async function getYueku(): Promise<YuekuData> {
  const body = await callModuleBody('/yueku');
  const info = body?.data?.info || {};
  return {
    songs: arrayFrom(info, 'song').map((item) => normalizeSong(item, 'yueku')),
    videos: arrayFrom(info, 'video').map((item) => normalizeMv(item, 'yueku')),
    albums: arrayFrom(info, 'album').map((album) => ({
      id: text(pick(album.albumid, album.album_id)),
      name: text(pick(album.albumname, album.album_name)) || '未命名专辑',
      artist: text(pick(album.singername, album.author_name)),
      cover: image(pick(album.imgurl, album.cover, album.sizable_cover)),
      publishTime: text(pick(album.publishtime, album.publish_time)),
    })),
    ranks: arrayFrom(info, 'rank').map((rank) => ({
      id: text(pick(rank.rankid, rank.id)),
      rankCid: text(rank.rank_cid),
      name: text(pick(rank.rankname, rank.name)) || '榜单',
      cover: image(pick(rank.img_9, rank.imgurl, rank.banner_9, rank.album_img_9)),
      intro: text(rank.intro),
    })),
  };
}

/** 乐库首页聚合；任一子接口失败返回空数据 */
export async function getDiscoverData(): Promise<YuekuData> {
  return fallback(getYueku, { songs: [], videos: [], albums: [], ranks: [] });
}
