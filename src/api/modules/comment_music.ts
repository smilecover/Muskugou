// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/comment_music.js
 * 接口路由：/comment/music
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import { processEnv as process } from '../core/node/env';
import type { UseAxios } from '../core/types';

// 歌曲评论
export default (params: any, useAxios: UseAxios): Promise<any> => {

  const paramsMap = {
    ver: Number(process.env.CMT_VER || 6),
    mixsongid: params.mixsongid,
    need_show_image: 1,
    p: params.page || 1,
    pagesize: params.pagesize || 30,
    show_classify: params.show_classify || 1,
    show_hotword_list: params.show_hotword_list || 1,
    extdata: '0',
    code: 'fc4be23b4e972707f36b8a828a93ba8a'
  }

  return useAxios({
    url: '/mcomment/v1/cmtlist',
    encryptType: 'android',
    method: 'POST',
    params: paramsMap,
    cookie: params?.cookie || {},
  });
};

