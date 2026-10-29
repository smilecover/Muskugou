// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/everyday_friend.js
 * 接口路由：/everyday/friend
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    baseURL: 'https://acsing.service.kugou.com',
    url: '/sing7/relation/json/v3/friend_rec_by_using_song_list',
    encryptType: 'android',
    method: 'POST',
    data: {list: [{user_id: 853927886, mixsong_ids: [290083753,251724346,571554587,250126644,208831644,40328518,250504076,581706850,318347675,585258401,288481998,407414475,28239430,280584633,291957521,64556644,243149863,488725103,32114153,39951172,29019580,40397606,327507651,32029382,32218359,340353127,276448762,177071956,100031397,249251602]}]},
    params: { channel: 130, isteen: 0, platform: 2, usemkv: 1 },
    cookie: params?.cookie || {},
    headers: { pid: 126556797 },
  });
};

