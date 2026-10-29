// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_user_song.js
 * 接口路由：/youth/user/song
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    filter_video:	0,
    type:	params?.type || 0,
    userid: params.userid,
    pagesize: params.pagesize || 30,
    page: params.page || 1,
    is_filter: 0,
  }
  return useAxios({
    url: '/youth/v1/get_user_song_public',
    encryptType: 'android',
    method: 'get',
    params: dataMap,
    cookie: params?.cookie,
  });
};

