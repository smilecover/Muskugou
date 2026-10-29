/**
 * 协议层联调脚本（在 Node 中直接调用移植后的模块）。
 *
 * 说明：
 * - 不经过 Vite，因此不加载 registry.ts（那里用到 import.meta.glob）；
 * - 使用 Node 原生 fetch 作为传输层，验证签名、Cookie、设备注册是否正确；
 * - 不会调用 `/captcha/sent`，避免向真实手机号发送短信。
 *
 * 运行：pnpm api:check
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getCookieJar, setCookieStrings } from '../src/api/core/jar';
import { createRequest } from '../src/api/core/request';
import type { KuGouResponse, UseAxios } from '../src/api/core/types';
import { ROUTE_CATALOG } from '../src/api/route-catalog';

import registerDev from '../src/api/modules/register_dev';
import search from '../src/api/modules/search';
import searchHot from '../src/api/modules/search_hot';
import songUrl from '../src/api/modules/song_url';
import searchLyric from '../src/api/modules/search_lyric';
import lyric from '../src/api/modules/lyric';
import topPlaylist from '../src/api/modules/top_playlist';
import playlistTags from '../src/api/modules/playlist_tags';
import playlistTrackAll from '../src/api/modules/playlist_track_all';
import rankList from '../src/api/modules/rank_list';
import rankAudio from '../src/api/modules/rank_audio';
import albumSongs from '../src/api/modules/album_songs';
import artistDetail from '../src/api/modules/artist_detail';
import artistAudiosNew from '../src/api/modules/artist_audios_new';
import loginQrKey from '../src/api/modules/login_qr_key';
import loginQrCreate from '../src/api/modules/login_qr_create';
import loginQrCheck from '../src/api/modules/login_qr_check';

type ModuleHandler = (params: any, useAxios: UseAxios) => Promise<KuGouResponse>;

let passed = 0;
let failed = 0;

/** 调用模块：注入当前 Cookie，并把模块返回的 Set-Cookie 持久化 */
async function call(handler: ModuleHandler, params: Record<string, any> = {}): Promise<KuGouResponse> {
  const response = await handler(
    { ...params, cookie: { ...getCookieJar(), ...(params.cookie || {}) } },
    createRequest
  );
  if (Array.isArray(response?.cookie) && response.cookie.length) {
    setCookieStrings(response.cookie);
  }
  return response;
}

/** 单个检查项 */
async function check(name: string, run: () => Promise<string | void>): Promise<void> {
  const started = Date.now();
  try {
    const detail = await run();
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''} (${Date.now() - started}ms)`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ ${name} — ${message}`);
  }
}

/** 取出响应体；协议层已经处理业务错误，这里只做兜底 */
function assertOk(response: KuGouResponse, label: string): any {
  const body = response?.body;
  if (!body || typeof body !== 'object') {
    throw new Error(`${label} 返回体不是对象：${JSON.stringify(body)}`);
  }
  if (body.status === 0) {
    throw new Error(
      `${label} 失败：status=0 error_code=${body.error_code ?? ''} msg=${body.msg || body.error_msg || body.message || ''}`
    );
  }
  return body;
}

/** 在常见响应结构中寻找数组 */
function findList(body: any): any[] {
  const candidates = [
    body?.data?.lists,
    body?.data?.info,
    body?.data?.list,
    body?.data?.songs,
    body?.data?.audios,
    body?.data?.special_list,
    body?.data?.special_recommend?.info,
    body?.data,
    body?.lists,
    body?.info,
    body?.songs,
    body?.audios,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  return [];
}

/** 递归寻找包含指定字段的对象（用于不同接口的嵌套结构） */
function findFirstWith(value: any, key: string, depth = 0): any {
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

async function main(): Promise<void> {
  console.log('Muskugou 协议层联调\n');

  await check('全量模块加载', async () => {
    const directory = join(process.cwd(), 'src', 'api', 'modules');
    const files = readdirSync(directory).filter((file) => file.endsWith('.ts'));
    const invalid: string[] = [];
    for (const file of files) {
      const mod: any = await import(`../src/api/modules/${file}`);
      // 下划线开头的是内部 helper，不注册路由，也没有 default
      if (!file.startsWith('_') && typeof mod.default !== 'function') {
        invalid.push(file);
      }
    }
    if (invalid.length) throw new Error(`以下模块没有导出处理函数：${invalid.join(', ')}`);
    return `${files.length} 个文件，全部可加载`;
  });

  await check('路由目录同步', async () => {
    const directory = join(process.cwd(), 'src', 'api', 'modules');
    const files = readdirSync(directory).filter(
      (file) => file.endsWith('.ts') && !file.startsWith('_')
    );
    const expected = new Set(
      files.map((file) => `/${file.replace(/\.ts$/i, '').replace(/_/g, '/')}`)
    );
    const catalogued = new Set(ROUTE_CATALOG.map((entry) => entry.route));
    const missing = [...expected].filter((route) => !catalogued.has(route));
    const extra = [...catalogued].filter((route) => !expected.has(route));
    if (missing.length || extra.length) {
      throw new Error(
        `目录与模块文件不一致：缺少 ${missing.join(', ') || '无'}；多余 ${extra.join(', ') || '无'}。请运行 pnpm api:catalog`
      );
    }
    return `${ROUTE_CATALOG.length} 个路由与模块文件一致`;
  });

  await check('设备注册 /register/dev', async () => {
    const response = await call(registerDev);
    const body = assertOk(response, '设备注册');
    const dfid = body?.data?.dfid || getCookieJar().dfid;
    if (!dfid) throw new Error('响应中没有 dfid');
    setCookieStrings([`dfid=${dfid}`]);
    return `dfid=${String(dfid).slice(0, 8)}…`;
  });

  let firstSong: any = null;
  let playlist: any = null;
  let rank: any = null;
  let lyricCandidate: any = null;
  let qrKey = '';

  await check('歌曲搜索 /search', async () => {
    const response = await call(search, { keywords: '周杰伦', page: 1, pagesize: 10 });
    const body = assertOk(response, '搜索');
    const lists = body?.data?.lists || [];
    if (!lists.length) throw new Error(`搜索无结果：${JSON.stringify(body).slice(0, 300)}`);
    firstSong = lists[0];
    return `${lists.length} 条，首条：${firstSong.SongName || firstSong.songname || firstSong.FileName}`;
  });

  await check('免费歌曲 URL /song/url', async () => {
    const listResponse = await call(search, { keywords: '轻音乐', page: 1, pagesize: 20 });
    const listBody = assertOk(listResponse, '免费歌曲搜索');
    const free = (listBody?.data?.lists || []).find((song: any) => song.PayType === 0 && song.FileHash);
    if (!free) throw new Error('没有找到免费歌曲');
    const response = await call(songUrl, {
      hash: free.FileHash,
      album_id: free.AlbumID,
      album_audio_id: free.MixSongID,
      quality: '128',
    });
    const body = assertOk(response, '歌曲 URL');
    const url = body?.url?.[0] || body?.data?.url?.[0] || body?.data?.play_url;
    if (!url) throw new Error(`没有播放地址：${JSON.stringify(body).slice(0, 400)}`);
    return `${free.SongName}：${String(url).startsWith('https') ? 'https' : 'http'} ${String(url).slice(0, 50)}…`;
  });

  await check('VIP 试听 URL /song/url（free_part）', async () => {
    if (!firstSong) throw new Error('缺少搜索歌曲');
    const response = await call(songUrl, {
      hash: firstSong.FileHash,
      album_id: firstSong.AlbumID,
      album_audio_id: firstSong.MixSongID,
      quality: '128',
      free_part: true,
    });
    const body = assertOk(response, '试听 URL');
    const url = body?.url?.[0] || body?.data?.url?.[0];
    if (!url) throw new Error(`没有试听地址：${JSON.stringify(body).slice(0, 400)}`);
    return `${firstSong.SongName}：${body?.timeLength || '?'}s`;
  });

  await check('歌词搜索 /search/lyric', async () => {
    if (!firstSong) throw new Error('缺少搜索歌曲');
    const response = await call(searchLyric, {
      hash: firstSong.FileHash,
      album_audio_id: firstSong.MixSongID,
      duration: firstSong.Duration,
      keywords: firstSong.SongName,
    });
    const body = assertOk(response, '歌词搜索');
    const candidates = body?.candidates || body?.data?.candidates || [];
    if (!candidates.length) throw new Error(`没有歌词候选：${JSON.stringify(body).slice(0, 300)}`);
    lyricCandidate = candidates[0];
    return `id=${lyricCandidate.id} accesskey=${String(lyricCandidate.accesskey).slice(0, 8)}…`;
  });

  await check('歌词解码 /lyric', async () => {
    if (!lyricCandidate) throw new Error('缺少歌词候选');
    const response = await call(lyric, {
      id: lyricCandidate.id,
      accesskey: lyricCandidate.accesskey,
      fmt: 'krc',
      decode: true,
    });
    const body = assertOk(response, '歌词');
    const decoded = body?.decodeContent || '';
    if (!decoded) throw new Error(`没有解码歌词：${JSON.stringify(body).slice(0, 300)}`);
    return `${decoded.split('\n').length} 行`;
  });

  await check('热门搜索 /search/hot', async () => {
    const response = await call(searchHot);
    const body = assertOk(response, '热门搜索');
    const item = findFirstWith(body, 'keyword');
    if (!item) throw new Error(`没有热词：${JSON.stringify(body).slice(0, 300)}`);
    return String(item.keyword);
  });

  await check('歌单分类 /playlist/tags', async () => {
    const response = await call(playlistTags);
    const body = assertOk(response, '歌单分类');
    const tags = findFirstWith(body, 'tag_name');
    if (!tags) throw new Error(`没有分类：${JSON.stringify(body).slice(0, 300)}`);
    return String(tags.tag_name);
  });

  await check('推荐歌单 /top/playlist', async () => {
    const response = await call(topPlaylist, { category_id: 0, pagesize: 10 });
    const body = assertOk(response, '推荐歌单');
    const list = findList(body);
    if (!list.length) throw new Error(`没有歌单：${JSON.stringify(body).slice(0, 400)}`);
    playlist = findFirstWith(body, 'global_collection_id') || list[0];
    return `${list.length} 个，首个：${playlist.specialname || playlist.name || playlist.global_collection_id}`;
  });

  await check('歌单歌曲 /playlist/track/all', async () => {
    if (!playlist) throw new Error('缺少歌单');
    const id = playlist.global_collection_id || playlist.global_collection_id_str;
    if (!id) throw new Error(`歌单没有 global_collection_id：${JSON.stringify(playlist).slice(0, 200)}`);
    const response = await call(playlistTrackAll, { id, page: 1, pagesize: 10 });
    const body = assertOk(response, '歌单歌曲');
    const songs = body?.songs || findList(body);
    if (!songs.length) throw new Error(`没有歌曲：${JSON.stringify(body).slice(0, 300)}`);
    return `${songs.length} 首，首曲：${songs[0].name || songs[0].filename || songs[0].FileName}`;
  });

  await check('排行榜 /rank/list', async () => {
    const response = await call(rankList);
    const body = assertOk(response, '排行榜');
    const list = findList(body);
    if (!list.length) throw new Error(`没有排行榜：${JSON.stringify(body).slice(0, 300)}`);
    rank = findFirstWith(body, 'rankid') || list[0];
    return `${list.length} 个，首个：${rank.rankname || rank.name || rank.rankid}`;
  });

  await check('排行歌曲 /rank/audio', async () => {
    if (!rank) throw new Error('缺少排行榜');
    const rankid = rank.rankid || rank.rank_id || rank.id;
    const response = await call(rankAudio, { rankid, page: 1, pagesize: 10 });
    const body = assertOk(response, '排行歌曲');
    const audios = body?.data?.songlist || body?.data?.audio_list || body?.data?.audios || findList(body);
    if (!audios.length) throw new Error(`没有歌曲：${JSON.stringify(body).slice(0, 300)}`);
    return `${audios.length} 首`;
  });

  await check('专辑歌曲 /album/songs', async () => {
    if (!firstSong) throw new Error('缺少搜索歌曲');
    const response = await call(albumSongs, { id: firstSong.AlbumID, page: 1, pagesize: 10 });
    const body = assertOk(response, '专辑歌曲');
    const songs = findList(body);
    if (!songs.length) throw new Error(`没有歌曲：${JSON.stringify(body).slice(0, 400)}`);
    return `${songs.length} 首`;
  });

  await check('歌手详情 /artist/detail', async () => {
    if (!firstSong) throw new Error('缺少搜索歌曲');
    const artistId = firstSong.SingerId?.[0] || firstSong.Singers?.[0]?.id;
    if (!artistId) throw new Error('搜索歌曲没有歌手 id');
    const response = await call(artistDetail, { id: artistId });
    const body = assertOk(response, '歌手详情');
    const name = findFirstWith(body, 'author_name');
    if (!name) throw new Error(`没有歌手信息：${JSON.stringify(body).slice(0, 300)}`);
    return String(name.author_name);
  });

  await check('歌手单曲 /artist/audios/new', async () => {
    if (!firstSong) throw new Error('缺少搜索歌曲');
    const artistId = firstSong.SingerId?.[0] || firstSong.Singers?.[0]?.id;
    const response = await call(artistAudiosNew, { id: artistId, page: 1, pagesize: 10 });
    const body = assertOk(response, '歌手单曲');
    const songs = findList(body);
    if (!songs.length) throw new Error(`没有歌曲：${JSON.stringify(body).slice(0, 400)}`);
    return `${songs.length} 首`;
  });

  await check('扫码登录 key /login/qr/key', async () => {
    const response = await call(loginQrKey, { type: 'web' });
    const body = assertOk(response, '扫码 key');
    const key = body?.data?.qrcode || body?.data?.key;
    if (!key) throw new Error(`没有 qrcode key：${JSON.stringify(body).slice(0, 300)}`);
    qrKey = key;
    return String(key);
  });

  await check('扫码二维码 /login/qr/create', async () => {
    if (!qrKey) throw new Error('缺少 qrcode key');
    const response = await call(loginQrCreate, { key: qrKey, qrimg: true });
    const body = assertOk(response, '二维码');
    const dataUrl = body?.data?.base64;
    if (!dataUrl || !String(dataUrl).startsWith('data:image')) throw new Error('二维码图片生成失败');
    return `base64 ${Math.round(String(dataUrl).length / 1024)}KB`;
  });

  await check('扫码状态 /login/qr/check（仅轮询一次）', async () => {
    if (!qrKey) throw new Error('缺少 qrcode key');
    const response = await call(loginQrCheck, { key: qrKey });
    const body = assertOk(response, '扫码状态');
    const status = body?.data?.status;
    if (status === undefined) throw new Error(`没有状态：${JSON.stringify(body).slice(0, 300)}`);
    return `status=${status}（1=等待扫码）`;
  });

  console.log(`\n通过 ${passed} 项，失败 ${failed} 项`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
