// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_track_all.js
 * 接口路由：/playlist/track/all
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取歌单所有歌曲
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const pagesize = params?.pagesize || 30;
  const paramsMap = {
    area_code: 1,
    begin_idx: (Number(params.page || 1) - 1) * pagesize,
    plat: 1,
    type: 1,
    // module: 'NONE',
    mode: 1,
    personal_switch: 1,
    extend_fields: 'abtags,hot_cmt,popularization',
    // page: params?.page || 1,
    pagesize ,
    global_collection_id: params?.id,
  };

  return useAxios({
    url: '/pubsongs/v2/get_other_list_file_nofilt',
    method: 'GET',
    encryptType: 'android',
    params: paramsMap,
    cookie: params?.cookie || {},
    // headers: { 'x-router': 'pubsongscdn.kugou.com' },
  });
};

