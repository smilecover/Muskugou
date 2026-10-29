// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_channel_song_detail.js
 * 接口路由：/youth/channel/song/detail
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    global_collection_id: params.global_collection_id,
    fileid: params.fileid
  }
  return useAxios({
    url: '/youth/v2/post/get_song_detail',
    encryptType: 'android',
    method: 'get',
    params: dataMap,
    cookie: params?.cookie,
  });
};

