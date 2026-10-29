// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/top_song.js
 * 接口路由：/top/song
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

/**
 * 新歌速递
 */
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    rank_id: params?.type || 21608,
    userid: params?.userid || params?.cookie?.userid || 0,
    page: params?.page || 1,
    pagesize: params?.pagesize || 30,
    tags: [],
  };

  return useAxios({
    url: '/musicadservice/container/v1/newsong_publish',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

