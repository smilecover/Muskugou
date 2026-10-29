// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_video_love.js
 * 接口路由：/user/video/love
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoRSAEncrypt } from '../core/compat';
/**
 * 获取用户关注的歌手
 */
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || '0';
  const paramsMap = {
    kugouid: userid,
    pagesize: params?.pagesize ?? 30,
    load_video_info: 1,
    p: 1,
    plat: 1
  };

  return useAxios({
    url: '/m.comment.service/v1/get_user_like_video',
    encryptType: 'android',
    method: 'get',
    params: paramsMap,
    cookie: params?.cookie || {},
  });
};

