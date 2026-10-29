// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/rank_top.js
 * 接口路由：/rank/top
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取排行榜推荐列表

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/mobileservice/api/v5/rank/rec_rank_list',
    method: 'get',
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

