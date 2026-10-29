// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/top_card_youth.js
 * 接口路由：/top/card/youth
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 热门好歌精选
// 3006: VIP专属推荐
// 3001: 私人专属好歌
// 3004: 小众宝藏佳作
// 3014: 喜欢这首歌的TA也喜欢
// 3102: 喜欢「欧美」的TA也喜欢
// 3101:  概念er新推
// 3005: 潮流尝鲜
// 3103: 曲风盲盒·随机心动

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    tagid: params.tagid ?? '',
    u_info: '',
    source_mixsong: ''
  };

  const reqUrl = (Number(params?.card_id) === 3103 && typeof params?.tagid === 'undefined') ? 'tag_card_recommend' : 'single_card_recommend';

  

  return useAxios({
    url: `youth/v1/song/${reqUrl}`,
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    params: { 'card_id': params?.card_id || 3005, area_code: 1, platform: 'ios', module_id: 1, ver: 'v2', pagesize: params.pagesize ?? 30 , module_id: 1,  clientver: 12500 },
    cookie: params?.cookie || {},
  });
};

