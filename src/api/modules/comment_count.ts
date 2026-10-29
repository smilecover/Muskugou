// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/comment_count.js
 * 接口路由：/comment/count
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 歌曲评论数
export default (params: any, useAxios: UseAxios): Promise<any> => {

  const paramsMap = {
    r: 'comments/getcommentsnum',
    code: 'fc4be23b4e972707f36b8a828a93ba8a',
  };

  if (params && params.hash) {
    paramsMap.hash = params.hash;
  } else if (params && params.special_id) {
    paramsMap.childrenid = params.special_id;
  }

  return useAxios({
    url: '/index.php',
    encryptType: 'web',
    method: 'GET',
    params: paramsMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'sum.comment.service.kugou.com' },
  });
};

