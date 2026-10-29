// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/ip_zone_home.js
 * 接口路由：/ip/zone/home
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取今日推荐信息，有可能为空
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    id: params?.id,
    share: 0,
  };

  return useAxios({
    url: '/v1/zone/home',
    encryptType: 'android',
    method: 'GET',
    params: dataMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'yuekucategory.kugou.com' },
  });
};

