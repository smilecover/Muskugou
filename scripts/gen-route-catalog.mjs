/**
 * 生成接口目录（src/api/route-catalog.ts）。
 *
 * 协议模块由 scripts/port-modules.mjs 从参考库机械移植，模块里保留了原作者的
 * 中文注释。这里在构建期把这些注释、参数名和路由整理成一份静态目录，供
 * “接口中心”页面展示；运行时不需要读取模块源码，也不会把 234 个模块的源码
 * 打进前端包。
 *
 * 用法：pnpm api:catalog
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MODULE_DIR = join(process.cwd(), 'src', 'api', 'modules');
const OUTPUT = join(process.cwd(), 'src', 'api', 'route-catalog.ts');

/** 分组顺序也是页面上的展示顺序 */
const GROUPS = [
  { id: 'account', label: '账号与登录' },
  { id: 'cloud', label: '云盘' },
  { id: 'playlist', label: '歌单与乐谱' },
  { id: 'content', label: '音乐内容' },
  { id: 'discover', label: '发现与推荐' },
  { id: 'search', label: '搜索' },
  { id: 'audiobook', label: '听书' },
  { id: 'effects', label: '音效' },
  { id: 'social', label: '评论与社交' },
  { id: 'youth', label: '青少年' },
  { id: 'other', label: '其他' },
];

const GROUP_INDEX = new Map(GROUPS.map((group, index) => [group.id, index]));

/** 路由分段的中文名；用于没有原注释或注释过长时生成目录标题 */
const WORDS = {
  accompany: '伴奏',
  add: '添加',
  ai: 'AI',
  album: '专辑',
  albums: '专辑',
  all: '全部',
  amway: '安利',
  artist: '歌手',
  audio: '音频',
  audios: '单曲',
  auth: '授权',
  authorize: '授权',
  avatar: '头像',
  banner: '横幅',
  barrage: '弹幕',
  batch: '批量',
  blacklist: '黑名单',
  brand: '品牌',
  brush: '刷歌',
  captcha: '验证码',
  car: '车载',
  card: '卡片',
  cellphone: '手机号',
  channel: '频道',
  chat: '聊天',
  check: '状态',
  class: '分类',
  classify: '分类',
  climax: '高潮',
  cloud: '云盘',
  collect: '收藏',
  collection: '收藏',
  comment: '评论',
  complex: '综合',
  count: '数量',
  create: '创建',
  daily: '每日',
  dateil: '详情',
  day: '每日',
  default: '默认',
  del: '删除',
  detail: '详情',
  dev: '设备',
  device: '设备',
  diantai: '电台',
  discover: '发现',
  discovery: '发现',
  dycover: '动态封面',
  dynamic: '动态',
  effect: '音效',
  effects: '音效',
  everyday: '每日',
  explore: '探索',
  fans: '粉丝',
  favorite: '收藏',
  filter: '筛选',
  floor: '楼层',
  fm: '电台',
  follow: '关注',
  friend: '好友',
  friends: '好友',
  get: '获取',
  grade: '等级',
  history: '历史',
  home: '首页',
  honour: '荣誉',
  hot: '热门',
  hotword: '热词',
  image: '图片',
  images: '图片',
  import: '导入',
  info: '信息',
  ip: 'IP',
  join: '加入',
  key: '密钥',
  kick: '下线',
  kmr: 'KMR',
  krm: 'KRM',
  ktv: 'KTV',
  lastest: '最新',
  list: '列表',
  listen: '收听',
  lists: '列表',
  lite: '概念版',
  login: '登录',
  longaudio: '听书',
  love: '点赞',
  lyric: '歌词',
  match: '匹配',
  matching: '匹配',
  merge: '合并',
  message: '消息',
  mixed: '混合',
  mode: '模式',
  model: '模型',
  module: '模块',
  month: '每月',
  music: '音乐',
  mv: 'MV',
  my: '我的',
  new: '新版',
  newsongs: '新歌',
  now: '当前',
  official: '官方',
  openplat: '开放平台',
  pc: 'PC',
  period: '周期',
  personal: '私人',
  pic: '封面',
  playhistory: '播放历史',
  playlist: '歌单',
  preference: '偏好',
  privilege: '权限',
  purchased: '已购',
  qq: 'QQ',
  qr: '扫码',
  rank: '排行',
  ranking: '排行',
  recent: '最近',
  recommend: '推荐',
  record: '记录',
  register: '设备注册',
  related: '相关',
  report: '上报',
  room: '房间',
  scene: '场景',
  search: '搜索',
  send: '发送',
  sent: '发送',
  server: '服务器',
  share: '分享',
  sheet: '乐谱',
  shop: '唱片店',
  sidedt: '侧边栏',
  similar: '相似',
  singer: '歌手',
  song: '歌曲',
  songs: '歌曲',
  sort: '排序',
  status: '状态',
  study: '自习',
  style: '风格',
  sub: '订阅',
  suggest: '联想',
  tag: '标签',
  tags: '标签',
  team: '组队',
  theme: '主题',
  together: '一起听',
  token: '令牌',
  top: '榜单',
  total: '总数',
  track: '歌曲',
  tracks: '歌曲',
  unfollow: '取消关注',
  union: '联合',
  update: '更新',
  upgrade: '升级',
  upload: '上传',
  url: '地址',
  user: '用户',
  v2: 'V2',
  verify: '验证',
  video: '视频',
  videos: '视频',
  vip: 'VIP',
  vipinfo: 'VIP 信息',
  visitors: '访客',
  vol: '期数',
  week: '每周',
  wx: '微信',
  youth: '青少年',
  yueku: '乐库',
  zone: '专区',
};

/** 少数自动标题不理想的路由，单独覆盖 */
const LABEL_OVERRIDES = {
  '/album/dycover': '专辑动态封面',
  '/album/shop': '唱片店',
  '/audio': '音频信息',
  '/audio/accompany/matching': '伴奏匹配',
  '/audio/ktv/total': 'KTV 音频总数',
  '/audio/match': '听歌识曲',
  '/audio/related': '相关音频',
  '/artist/audios': '歌手单曲',
  '/artist/videos': '歌手 MV',
  '/blacklist': '黑名单编辑',
  '/blacklist/list': '黑名单列表',
  '/comment/album': '专辑评论',
  '/comment/floor/send': '发送楼层回复',
  '/comment/music/classify': '歌曲评论分类',
  '/comment/music/del': '删除我的评论',
  '/comment/music/hotword': '评论热词筛选',
  '/comment/music/send': '发送歌曲评论',
  '/comment/playlist': '歌单评论',
  '/comment/playlist/send': '发送歌单评论',
  '/get/mode/info': '耳机型号详情',
  '/get/model': '社区音效',
  '/effects/artist': '歌手音效',
  '/effects/brand': '耳机品牌',
  '/effects/brand/detail': '耳机品牌详情',
  '/effects/car/brand': '车载品牌',
  '/effects/car/brand/lists': '车载品牌列表',
  '/effects/match': '音效匹配',
  '/everyday/friend': '好友每日推荐',
  '/favorite/count': '收藏数量',
  '/fm/image': '电台图片',
  '/get/verify/info': '验证信息',
  '/images': '图片资源',
  '/images/audio': '歌曲图片',
  '/import/playlist': '导入歌单',
  '/ip/dateil': 'IP 详情',
  '/ip/playlist': 'IP 歌单',
  '/ip/zone': 'IP 专区',
  '/ip/zone/home': 'IP 专区首页',
  '/listen/together/chat': '一起听聊天',
  '/longaudio/album/list': '听书专辑列表',
  '/krm/audio': 'KRM 音频',
  '/kmr/audio/mv': 'KMR 音频 MV',
  '/lastest/songs/listen': '最新收听歌曲',
  '/listen/together/common': '一起听公共配置',
  '/listen/together/discovery': '一起听发现',
  '/listen/together/music': '一起听音乐',
  '/listen/together/room': '一起听房间',
  '/listen/together/study': '一起听自习',
  '/login/device': '登录设备列表',
  '/login/device/kick': '设备下线',
  '/mv/collect': '收藏 MV',
  '/mv/collect/del': '取消收藏 MV',
  '/pc/diantai': 'PC 电台',
  '/personal/fm': '私人电台',
  '/playhistory/upload': '上传播放历史',
  '/playlist/detail': '歌单详情',
  '/playlist/pic': '修改歌单封面',
  '/playlist/pic/upload': '上传歌单封面',
  '/playlist/share/official': '官方分享歌单',
  '/playlist/sort': '歌单排序',
  '/playlist/tags': '歌单分类',
  '/playlist/track/all': '歌单歌曲',
  '/playlist/track/all/new': '歌单歌曲（新版）',
  '/playlist/tracks/add': '添加歌曲到歌单',
  '/playlist/tracks/del': '从歌单删除歌曲',
  '/playlist/tracks/sort': '歌单内歌曲排序',
  '/playlist/update': '更新歌单',
  '/privilege/lite': '概念版歌曲权限',
  '/recommend/songs': '推荐歌曲',
  '/register/dev': '设备注册',
  '/scene/collection/list': '场景收藏列表',
  '/scene/lists/v2': '场景列表 V2',
  '/scene/module': '场景模块',
  '/scene/module/info': '场景模块详情',
  '/scene/music': '场景音乐',
  '/scene/video/list': '场景视频列表',
  '/search/complex': '综合搜索',
  '/search/default': '默认搜索',
  '/search/mixed': '混合搜索',
  '/server/now': '服务器时间',
  '/sheet/collection': '乐谱首页',
  '/sheet/detail': '乐谱详情',
  '/sheet/explore': '乐谱探索',
  '/sheet/rank': '乐谱排行',
  '/sheet/song': '乐谱歌曲',
  '/sheet/tags': '乐谱分类',
  '/sidedt': '登录侧边参数',
  '/singer/list': '歌手列表',
  '/song/barrage/send': '发送歌曲弹幕',
  '/song/ranking': '歌曲成绩单',
  '/song/ranking/filter': '歌曲成绩单筛选',
  '/song/url': '歌曲地址',
  '/song/url/auth': '歌曲地址（登录）',
  '/song/url/auth/merge': '歌曲地址（合并）',
  '/song/url/new': '歌曲地址（新版）',
  '/team/history': '组队历史',
  '/team/join': '加入队伍',
  '/team/my': '我的队伍',
  '/team/my/info': '我的队伍信息',
  '/team/my/status': '我的队伍状态',
  '/team/period/info': '队伍周期信息',
  '/theme/playlist': '主题歌单',
  '/theme/playlist/track': '主题歌单歌曲',
  '/top/card/youth': '青少年精选卡片',
  '/top/ip': 'IP 榜单',
  '/top/playlist': '推荐歌单',
  '/user/batch/union/vipinfo': '批量查询联合 VIP',
  '/user/cloud': '云盘歌曲',
  '/user/cloud/match': '云盘歌曲匹配',
  '/user/cloud/upload': '上传云盘歌曲',
  '/user/cloud/url': '云盘歌曲地址',
  '/user/follow': '关注列表',
  '/user/follow/chat': '关注用户聊天',
  '/user/follow/message': '关注用户消息',
  '/user/grade/info': '用户等级信息',
  '/user/history': '收听历史',
  '/user/info': '用户信息',
  '/user/listen': '听歌排行',
  '/user/listen/report': '上报收听记录',
  '/user/playlist': '用户歌单',
  '/user/preference': '用户偏好',
  '/user/preference/update': '更新用户偏好',
  '/user/update': '更新用户资料',
  '/user/update/avatar': '更新用户头像',
  '/user/video/collect': '收藏用户视频',
  '/user/video/love': '点赞用户视频',
  '/user/vip/detail': '用户 VIP 详情',
  '/verify/user/info': '验证用户信息',
  '/video/barrage/send': '发送视频弹幕',
  '/video/url': '视频地址',
  '/youth/channel/all': '青少年全部频道',
  '/youth/channel/amway': '青少年安利频道',
  '/youth/channel/detail': '青少年频道详情',
  '/youth/channel/similar': '青少年相似频道',
  '/youth/channel/song': '青少年频道歌曲',
  '/youth/channel/song/detail': '青少年频道歌曲详情',
  '/youth/channel/song/list': '青少年频道歌曲列表',
  '/youth/channel/sub': '订阅青少年频道',
  '/youth/day/vip': '青少年每日 VIP',
  '/youth/day/vip/upgrade': '升级青少年每日 VIP',
  '/youth/dynamic': '青少年动态',
  '/youth/dynamic/recent': '青少年最近动态',
  '/youth/listen/song': '青少年收听歌曲',
  '/youth/month/vip/record': '青少年月度 VIP 记录',
  '/youth/union/vip': '青少年联合 VIP',
  '/youth/user/song': '青少年用户歌曲',
  '/youth/vip': '青少年 VIP',
  '/yueku': '乐库推荐',
  '/yueku/banner': '乐库横幅',
  '/yueku/fm': '乐库电台',
};

/** 已知需要登录、但容易被误认为公开接口的读接口 */
const PUBLIC_ROUTES = new Set([
  '/comment/album',
  '/comment/count',
  '/comment/floor',
  '/comment/music',
  '/comment/music/classify',
  '/comment/music/hotword',
  '/comment/playlist',
  '/user/detail',
]);

/** 路径里没有 add/del 等动词、但确实会修改账号数据的接口 */
const WRITE_OVERRIDES = new Set(['/blacklist', '/playlist/pic', '/playlist/pic/upload', '/playlist/sort']);

const WRITE_PATTERN =
  /\/(add|del|delete|send|update|upload|kick|follow|unfollow|join|collect|love|sort|report|authorize|import|brush|create)(\/|$)/;

/** 每个分组内优先展示的常用接口 */
const ROUTE_PRIORITY = [
  '/search',
  '/song/url',
  '/playlist/detail',
  '/playlist/track/all',
  '/album/detail',
  '/artist/detail',
  '/rank/list',
  '/lyric',
  '/user/detail',
  '/user/info',
  '/user/playlist',
  '/user/cloud',
  '/user/preference',
  '/login/device',
  '/blacklist/list',
  '/user/update',
  '/effects/brand',
  '/scene/lists',
  '/sheet/rank',
  '/longaudio/album/list',
  '/youth/channel/all',
  '/team/my',
  '/listen/together/room',
  '/comment/music',
  '/comment/album',
  '/comment/playlist',
  '/top/playlist',
  '/fm/recommend',
  '/theme/music',
  '/ip/zone',
  '/recommend/songs',
];
const PRIORITY_INDEX = new Map(ROUTE_PRIORITY.map((route, index) => [route, index]));

/** 从源码中提取 `params.xxx`、`params?.xxx`、`params['xxx']` 和简单解构 */
function extractParams(source) {
  const names = new Set();
  for (const match of source.matchAll(/params\??\.([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of source.matchAll(/params\s*\[\s*['"]([^'"]+)['"]\s*\]/g)) names.add(match[1]);
  for (const match of source.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*params/g)) {
    for (const part of match[1].split(',')) {
      const name = part.split(':')[0].split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  names.delete('cookie');
  names.delete('token');
  const priority = ['page', 'pagesize', 'keyword', 'keywords', 'id', 'hash', 'album_id', 'album_audio_id', 'rankid', 'userid', 'type', 'label', 'source', 'quality'];
  return [...names].sort((a, b) => {
    const ai = priority.indexOf(a);
    const bi = priority.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b);
  });
}

/** 去除自动移植文件头，保留原作者注释 */
function stripPortedHeader(source) {
  return source.replace(/^\/\/ @ts-nocheck\s*\/\*\*[\s\S]*?\*\/\s*/, '');
}

/**
 * 提取 export default 之前的说明性中文注释。
 *
 * 优先使用紧挨着 `export default` 的短注释（模块说明通常写在这里）；
 * 没有时再退回文件顶部第一段中文注释。这样 `/login/device/kick` 不会
 * 把辅助函数的 “RSA 无填充加密…” 当成接口说明。
 */
function extractSummary(source) {
  const cleaned = stripPortedHeader(source);
  const exportIndex = cleaned.indexOf('export default');
  const head = exportIndex >= 0 ? cleaned.slice(0, exportIndex) : cleaned;

  const comments = [];
  const pattern = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  for (const match of head.matchAll(pattern)) {
    const raw = match[0];
    const block = raw.startsWith('/*');
    const rawText = block
      ? raw
          .replace(/^\/\*\*?/, '')
          .replace(/\*\/$/, '')
          .split('\n')
          .map((line) => line.replace(/^\s*\*?\s?/, ''))
          .find((line) => line.trim()) || ''
      : raw.slice(2);
    const normalized = rawText.replace(/\s+/g, ' ').trim().replace(/^[-*]\s*/, '');
    if (!/[一-龥]/.test(normalized)) continue;
    if (/自动移植|模块层关闭|接口路由|本文件由|^协议说明|^参数[:：]|^说明[:：]/.test(normalized)) continue;
    if (/^(import|const|let|var|return|export|http|https)\b/.test(normalized)) continue;
    comments.push({ text: normalized, end: match.index + raw.length, block });
  }

  // 模块说明通常是紧挨着 export default 的块注释；行注释块则取第一句标题
  const nearExportBlock = comments
    .filter((item) => item.block && exportIndex - item.end < 300)
    .reverse()
    .find((item) => item.text.length <= 40);
  const preferred = nearExportBlock || comments[0];

  if (!preferred) return '';
  let summary = preferred.text;
  // 协议注释经常在同一行继续写 “// 参数说明”，只保留前半句
  summary = summary.split(/\s+\/\/\s+/)[0].trim();
  if (summary.length > 80) summary = `${summary.slice(0, 80)}…`;
  return summary;
}

/** 把路由分段翻译成中文标题 */
function generatedLabel(route) {
  const parts = route.split('/').filter(Boolean);
  const words = [];
  for (const part of parts) {
    const word = WORDS[part] || part;
    if (words[words.length - 1] !== word) words.push(word);
  }
  return words.join('');
}

function labelFor(route, summary) {
  if (LABEL_OVERRIDES[route]) return LABEL_OVERRIDES[route];
  if (summary && summary.length <= 20 && !/[，。：；、（）()]/.test(summary)) return summary;
  return generatedLabel(route);
}

function groupFor(route) {
  if (route.startsWith('/user/cloud')) return 'cloud';
  if (
    /^\/(listen\/together|team|comment|user\/(follow|fans|friends|visitors|video|listen|history))/.test(
      route,
    )
  ) {
    return 'social';
  }
  if (/^\/(login|captcha|register|verify|user|blacklist|favorite|playhistory)/.test(route)) {
    return 'account';
  }
  if (/^\/(playlist|sheet|import\/playlist)/.test(route)) return 'playlist';
  if (route.startsWith('/longaudio')) return 'audiobook';
  if (route.startsWith('/effects')) return 'effects';
  if (route.startsWith('/youth')) return 'youth';
  if (route.startsWith('/search')) return 'search';
  if (
    /^\/(scene|theme|ip|top|home|everyday|recommend|fm|pc|personal|yueku|server|sidedt|get)/.test(
      route,
    )
  ) {
    return 'discover';
  }
  if (
    /^\/(album|artist|song|audio|lyric|rank|mv|video|images|krm|kmr|privilege|singer|ai|brush|lastest)/.test(
      route,
    )
  ) {
    return 'content';
  }
  return 'other';
}

/** 自动提取的说明不准确时，手工覆盖 */
const SUMMARY_OVERRIDES = {
  '/get/mode/info': '耳机的型号与音效详情',
  '/get/model': '社区音效列表',
  '/login/device': '当前账号的登录设备列表',
  '/login/device/kick': '将指定设备踢下线；目标设备参数来自设备列表',
  '/sheet/collection': '乐谱首页模块配置',
  '/sidedt': '登录辅助参数，一般由登录流程自动处理',
};

function authHint(route, group) {
  if (PUBLIC_ROUTES.has(route)) return false;
  return ['account', 'cloud', 'social', 'youth'].includes(group);
}

function writeHint(route) {
  return WRITE_OVERRIDES.has(route) || WRITE_PATTERN.test(route);
}

const files = readdirSync(MODULE_DIR)
  .filter((file) => file.endsWith('.ts') && !file.startsWith('_'))
  .sort();

const catalog = files.map((file) => {
  const source = readFileSync(join(MODULE_DIR, file), 'utf8');
  const name = file.replace(/\.ts$/, '');
  const route = `/${name.replace(/_/g, '/')}`;
  const summary = SUMMARY_OVERRIDES[route] ?? extractSummary(source);
  const group = groupFor(route);
  const label = labelFor(route, summary);
  const write = writeHint(route);
  return {
    route,
    label,
    group,
    summary: summary && summary !== label ? summary : '',
    params: extractParams(source),
    // 会修改账号数据的接口通常也需要登录；实际仍以服务端返回为准
    auth: authHint(route, group) || write,
    write,
    file: name,
  };
});

catalog.sort((a, b) => {
  const groupDiff = GROUP_INDEX.get(a.group) - GROUP_INDEX.get(b.group);
  if (groupDiff) return groupDiff;
  const priorityDiff =
    (PRIORITY_INDEX.get(a.route) ?? 999) - (PRIORITY_INDEX.get(b.route) ?? 999);
  return priorityDiff || a.route.localeCompare(b.route);
});

const lines = [];
lines.push('/**');
lines.push(' * 接口目录（由 scripts/gen-route-catalog.mjs 自动生成，请勿手工编辑）。');
lines.push(' *');
lines.push(' * 每条记录对应一个已注册的协议路由，供“接口中心”页面展示与调用。');
lines.push(' * 修改模块注释或新增模块后，运行 `pnpm api:catalog` 重新生成。');
lines.push(' */');
lines.push('');
lines.push('export type RouteGroupId =');
for (const group of GROUPS) lines.push(`  | '${group.id}'`);
lines[lines.length - 1] += ';';
lines.push('');
lines.push('export interface RouteGroup {');
lines.push('  id: RouteGroupId;');
lines.push('  label: string;');
lines.push('}');
lines.push('');
lines.push('export interface RouteInfo {');
lines.push('  /** 协议路由，如 `/song/url` */');
lines.push('  route: string;');
lines.push('  /** 页面展示标题 */');
lines.push('  label: string;');
lines.push('  group: RouteGroupId;');
lines.push('  /** 原库注释里的补充说明，可能为空 */');
lines.push('  summary: string;');
lines.push('  /** 从模块源码中提取的参数名，仅用于生成表单 */');
lines.push('  params: string[];');
lines.push('  /** 通常需要登录 */');
lines.push('  auth: boolean;');
lines.push('  /** 可能修改账号数据，调用前需要二次确认 */');
lines.push('  write: boolean;');
lines.push('}');
lines.push('');
lines.push('export const ROUTE_GROUPS: RouteGroup[] = [');
for (const group of GROUPS) {
  lines.push(`  { id: '${group.id}', label: '${group.label}' },`);
}
lines.push('];');
lines.push('');
lines.push('export const ROUTE_CATALOG: RouteInfo[] = [');
for (const item of catalog) {
  lines.push(
    `  { route: ${JSON.stringify(item.route)}, label: ${JSON.stringify(item.label)}, group: '${item.group}', summary: ${JSON.stringify(item.summary)}, params: ${JSON.stringify(item.params)}, auth: ${item.auth}, write: ${item.write} },`,
  );
}
lines.push('];');
lines.push('');

writeFileSync(OUTPUT, lines.join('\n'), 'utf8');

const counts = new Map();
for (const item of catalog) counts.set(item.group, (counts.get(item.group) || 0) + 1);
console.log(`已生成 ${OUTPUT}`);
console.log(`共 ${catalog.length} 个路由`);
for (const group of GROUPS) console.log(`  ${group.label}: ${counts.get(group.id) || 0}`);
