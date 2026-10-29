// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/artist_follow_newsongs.js
 * 接口路由：/artist/follow/newsongs
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取关注歌手新歌
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const last_album_id = params.last_album_id || 0;
  const page_size = params.pagesize || 30;
  const opt_sort = params.opt_sort === 2 ? 2 : 1;
 
  const paramsMap = {
    last_album_id,
    page_size,
    opt_sort,
  };

  return useAxios({
    url: '/feed/v1/follow/newsong_album_list',
    method: 'post',
    data: { last_album_id },
    params: paramsMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

