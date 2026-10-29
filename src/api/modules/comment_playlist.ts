// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/comment_playlist.js
 * 接口路由：/comment/playlist
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 歌曲评论
export default (params: any, useAxios: UseAxios): Promise<any> => {

  const paramsMap = {
    childrenid: params.id,
    need_show_image: 1,
    p: params.page || 1,
    pagesize: params.pagesize || 30,
    show_classify: params.show_classify || 1,
    show_hotword_list: params.show_hotword_list || 1,
    code: 'ca53b96fe5a1d9c22d71c8f522ef7c4f',
    content_type: 0,
    tag: 5
  }

  return useAxios({
    url: '/m.comment.service/v1/cmtlist',
    encryptType: 'android',
    method: 'POST',
    params: paramsMap,
    cookie: params?.cookie || {},
  });
};

