// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_video_collect.js
 * 接口路由：/user/video/collect
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
  const token = params?.token || params?.cookie?.token || '';
  const userid = params?.userid || params?.cookie?.userid || '0';
  const dataMap = {
    userid,
    token,
    page: params?.page ?? 1,
    pagesize: params?.pagesize ?? 30,
  };

  return useAxios({
    url: '/collectservice/v2/collect_list_mixvideo',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    params: { plat: 1 },
    cookie: params?.cookie || {},
  });
};

