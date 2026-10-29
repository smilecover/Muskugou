// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/rank_list.js
 * 接口路由：/rank/list
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取排行榜列表

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const parmasMap = {
    plat: 2,
    withsong: params.withsong || 1,
    parentid: 0,
  };

  return useAxios({
    url: '/ocean/v6/rank/list',
    method: 'get',
    encryptType: 'android',
    params: parmasMap,
    cookie: params?.cookie || {},
  });
};

