// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_channel_song_list.js
 * 接口路由：/youth/channel/song/list
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    global_collection_id: params.global_collection_id,
    pagesize: params.pagesize || 20,
    page: params.page || 1,
    types: 2,
    is_filter: 0,
    apiver: 3,
  };
  return useAxios({
    baseURL: 'https://youth.kugou.com',
    url: '/api/channel/v1/channel_get_song_list',
    encryptType: 'android',
    method: 'GET',
    params: dataMap,
    cookie: params?.cookie,
  });
};

