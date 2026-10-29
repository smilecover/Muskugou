// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/comment_music_hotword.js
 * 接口路由：/comment/music/hotword
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 歌曲评论-更具热词获取评论
export default (params: any, useAxios: UseAxios): Promise<any> => {

  const paramsMap = {
    mixsongid: params.mixsongid,
    need_show_image: 1,
    p: params.page || 1,
    pagesize: params.pagesize || 30,
    hot_word: params.hot_word,
    extdata: '0',
    code: 'fc4be23b4e972707f36b8a828a93ba8a',
  }

  return useAxios({
    url: '/mcomment/v1/get_hot_word',
    encryptType: 'android',
    method: 'POST',
    params: paramsMap,
    cookie: params?.cookie || {},
  });
};

