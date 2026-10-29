/**
 * 酷狗客户端固定常量。
 *
 * 这里的值全部来自原 `KuGouMusicApi/util/config.json` 以及抓包得到的
 * 客户端协议常量。它们不是用户隐私数据，也不包含账号信息。
 *
 * 命名全部使用大写，避免与运行时设置（appid/clientver 会随标准版/概念版切换）
 * 混淆；需要“跟随平台”的值请使用 `config.ts` 中的 `getPlatformConfig()`。
 */

/** 微信开放平台（小程序）相关常量，原库保留，供开放平台登录模块使用 */
export const WX_APPID = 'wx79f2c4418704b4f8';
export const WX_LITE_APPID = 'wx72b795aca60ad321';
export const WX_SECRET = '4efcab88b700769e376e3f6087b8abc9';
export const WX_LITE_SECRET = '33e486041e5e25729a4e3d2da7502f9a';

/** QQ 互联应用 ID */
export const QQ_APPID = '205141';
export const QQ_LITE_APPID = '101706348';

/** H5 / 二维码登录使用的来源应用 ID */
export const SRC_APPID = 2919;

/** 标准版客户端 */
export const APPID = 1005;
export const CLIENTVER = 20489;

/** 概念版（lite / Young）客户端 */
export const LITE_APPID = 3116;
export const LITE_CLIENTVER = 11440;

/** 搜索接口在标准版下使用的特殊 clientver */
export const SEARCH_CLIENTVER = 201;

/** 接口版本号 */
export const APIVER = 20;

/**
 * 签名盐值。
 * - STANDARD_SALT：标准版 Android 签名
 * - LITE_SALT：概念版 Android 签名
 * - SIGN_KEY_SALT：signKey 参数签名（标准版）
 * - LITE_SIGN_KEY_SALT：signKey 参数签名（概念版）
 * - WEB_SIGNATURE_SALT：H5 接口签名
 * - REGISTER_SALT：设备注册接口签名
 */
export const STANDARD_SALT = 'OIlwieks28dk2k092lksi2UIkp';
export const LITE_SALT = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA';
export const SIGN_KEY_SALT = '57ae12eb6890223e355ccfcb74edf70d';
export const LITE_SIGN_KEY_SALT = '185672dd44712f60bb1736df5a377e82';
export const WEB_SIGNATURE_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
export const REGISTER_SALT = '1014';

/** song_url 接口使用的页面标识（标准版 / 概念版） */
export const SONG_URL_PAGE_ID = 151369488;
export const LITE_SONG_URL_PAGE_ID = 967177915;
export const SONG_URL_PPAGE_ID = '463467626,350369493,788954147';
export const LITE_SONG_URL_PPAGE_ID = '356753938,823673182,967485191';
export const SONG_URL_PID = 2;
export const LITE_SONG_URL_PID = 411;

/** 默认请求网关 */
export const DEFAULT_BASE_URL = 'https://gateway.kugou.com';

/** Android 客户端默认 User-Agent */
export const DEFAULT_USER_AGENT = 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi';

/**
 * 每个请求都会携带的酷狗内部标识头。
 * 这些值来自客户端抓包，用于让服务端把请求识别为 Android 客户端。
 */
export const DEFAULT_KG_HEADERS: Record<string, string> = {
  'kg-rc': '1',
  'kg-thash': '5d816a0',
  'kg-rec': '1',
  'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
};

/** 本地存储键名前缀（统一放在这里，方便清理数据） */
export const STORAGE_KEYS = {
  settings: 'muskugou.settings.v1',
  device: 'muskugou.device.v1',
  cookies: 'muskugou.cookies.v1',
  player: 'muskugou.player.v1',
  queue: 'muskugou.queue.v1',
  history: 'muskugou.history.v1',
  favorites: 'muskugou.favorites.v1',
  searchHistory: 'muskugou.search-history.v1',
  /** 概念版 VIP 自动领取状态（按用户 + 日期去重） */
  membership: 'muskugou.membership.v1',
} as const;
