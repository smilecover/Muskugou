/**
 * MV / 视频相关接口。
 *
 * 概念版搜索接口用 type=mv 返回 MV；歌手页和歌曲详情也能拿到关联 MV。
 * 播放地址需要先取 `/video/detail` 的音质 hash，再调 `/video/url` 换取 mp4/mkv 地址。
 */

import { callModuleBody } from '../registry';
import { arrayFrom, image, num, pick, text } from './common';

/** 统一后的 MV / 视频结构 */
export interface Mv {
  /** 视频 id（/video/detail 使用） */
  id: string;
  videoId: string;
  name: string;
  artist: string;
  artistId: string;
  cover: string;
  /** 时长，毫秒 */
  duration: number;
  playCount: number;
  publishTime: string;
  /** 视频 hash（/video/url 使用；列表接口不一定返回） */
  hash: string;
  remark: string;
  audioId: string;
  albumAudioId: string;
  isUgc: boolean;
  source?: string;
}

function mvCover(raw: any): string {
  const direct = pick(
    raw.cover,
    raw.hdpic,
    raw.thumb,
    raw.img,
    raw.cover_url,
    raw.pic_url,
    raw.album_cover,
    raw.Pic,
  );
  if (direct && /^https?:\/\//.test(String(direct))) return image(direct);
  // 搜索接口的 Pic 只有文件名，需要拼 mv 图床
  const file = text(raw.Pic || raw.pic);
  return file ? image(`https://imge.kugou.com/mvhdpic/480/${file}`) : '';
}

/** 把各接口的 MV 对象统一成 `Mv` */
export function normalizeMv(raw: any, source = 'mv'): Mv {
  const authors = arrayFrom(raw, 'authors', 'Singers');
  const artist = text(
    pick(
      raw.SingerName,
      raw.singer,
      raw.author_name,
      raw.singername,
      raw.user_name,
      authors.map((item) => item?.name || item?.singername).join('、'),
    ),
  );
  return {
    id: text(pick(raw.video_id, raw.videoid, raw.MvID, raw.id, raw.mv_id)),
    videoId: text(pick(raw.video_id, raw.videoid, raw.MvID, raw.id, raw.mv_id)),
    name: text(pick(raw.MvName, raw.video_name, raw.videoname, raw.title, raw.name, raw.FileName)) || '未命名视频',
    artist: artist || '未知歌手',
    artistId: text(pick(raw.user_id, raw.singerid, arrayFrom(raw, 'Singers')[0]?.id)),
    cover: mvCover(raw),
    duration: num(
      pick(
        raw.duration,
        raw.timelength,
        raw.Duration ? Number(raw.Duration) * 1000 : undefined,
        raw.audio_timelength,
      ),
    ),
    playCount: num(pick(raw.play_times, raw.playcount, raw.PlayCount, raw.hit, raw.history_heat, raw.MvHot)),
    publishTime: text(pick(raw.publish_time, raw.publish_date, raw.publish, raw.PublishDate)),
    hash: text(pick(raw.MvHash, raw.mvhash, raw.hash, raw.audio_hash, raw.sd_hash)),
    remark: text(pick(raw.remark, raw.Remark, raw.desc, raw.description)),
    audioId: text(pick(raw.AudioID, raw.audio_id)),
    albumAudioId: text(pick(raw.album_audio_id, raw.MixSongID, raw.AlbumAudioID)),
    isUgc: Boolean(num(pick(raw.is_ugc, raw.IsUgc))),
    source,
  };
}

/** 搜索 MV（/search type=mv） */
export async function searchMvs(keyword: string, page = 1, pageSize = 20): Promise<{ videos: Mv[]; total: number }> {
  const body = await callModuleBody('/search', { type: 'mv', keywords: keyword, page, pagesize: pageSize });
  const videos = arrayFrom(body, 'data.lists', 'data.list').map((item) => normalizeMv(item, 'search'));
  return { videos, total: num(pick(body?.data?.total, body?.total, videos.length)) };
}

/** 歌手关联 MV */
export async function getArtistVideos(
  artistId: string,
  page = 1,
  pageSize = 20,
): Promise<{ videos: Mv[]; total: number }> {
  const body = await callModuleBody('/artist/videos', { id: artistId, page, pagesize: pageSize });
  const videos = arrayFrom(body, 'data').map((item) => normalizeMv(item, 'artist'));
  return { videos, total: num(pick(body?.total, body?.extra?.page_total, videos.length)) };
}

/** 某首歌的 MV（可能返回多个版本） */
export async function getSongMvs(albumAudioId: string): Promise<Mv[]> {
  const body = await callModuleBody('/kmr/audio/mv', { album_audio_id: albumAudioId });
  const data = body?.data;
  const groups = Array.isArray(data) ? data : [];
  const videos: Mv[] = [];
  for (const group of groups) {
    if (Array.isArray(group)) {
      videos.push(...group.map((item) => normalizeMv(item, 'song-mv')));
    } else if (group && typeof group === 'object') {
      videos.push(normalizeMv(group, 'song-mv'));
    }
  }
  return videos;
}

export interface VideoSource {
  quality: 'sd' | 'hd' | 'qhd' | 'fhd';
  label: string;
  hash: string;
  size: number;
  width: number;
  height: number;
}

const QUALITY_LABEL: Record<VideoSource['quality'], string> = {
  sd: '标清',
  hd: '高清',
  qhd: '超清',
  fhd: '蓝光',
};

export interface VideoDetail extends Mv {
  intro: string;
  sources: VideoSource[];
}

/** 视频详情（含各清晰度 hash） */
export async function getVideoDetail(id: string): Promise<VideoDetail> {
  const body = await callModuleBody('/video/detail', { id: String(id) });
  const raw = arrayFrom(body, 'data')[0] || body?.data || {};
  const sources: VideoSource[] = [];
  for (const quality of ['fhd', 'qhd', 'hd', 'sd'] as const) {
    const hash = text(raw[`${quality}_hash`]);
    if (!hash) continue;
    sources.push({
      quality,
      label: QUALITY_LABEL[quality],
      hash,
      size: num(raw[`${quality}_filesize`]),
      width: num(raw[`${quality}_width`]),
      height: num(raw[`${quality}_height`]),
    });
  }
  return {
    ...normalizeMv(raw, 'video-detail'),
    intro: text(raw.intro),
    sources,
  };
}

/**
 * 通过视频 hash 换取全部可用播放地址。
 * 返回的 data 以“小写 hash”为键，downurl 在前、备用 CDN 在后。
 */
export async function getVideoUrls(hash: string): Promise<string[]> {
  const body = await callModuleBody('/video/url', { hash });
  const data = body?.data;
  if (!data || typeof data !== 'object') return [];
  const targetKey = Object.keys(data).find((key) => key.toLowerCase() === hash.toLowerCase());
  const candidates = targetKey ? [data[targetKey]] : Object.values(data);
  const urls: string[] = [];
  for (const item of candidates as any[]) {
    for (const url of [
      item?.downurl,
      ...(Array.isArray(item?.backupdownurl) ? item.backupdownurl : []),
      ...(Array.isArray(item?.backup_down_url) ? item.backup_down_url : []),
    ]) {
      if (typeof url === 'string' && /^https?:\/\//.test(url) && !urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}

/** 首选视频播放地址 */
export async function getVideoUrl(hash: string): Promise<string> {
  return (await getVideoUrls(hash))[0] || '';
}

/** 视频播放权限（登录后可查询） */
export async function getVideoPrivilege(hash: string): Promise<any> {
  return callModuleBody('/video/privilege', { hash });
}
