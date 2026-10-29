// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/effects_car_brand.js
 * 接口路由：/effects/car/brand
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 音效 - 汽车列表

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    baseURL: 'http://mobilecdngz.kugou.com',
    url: '/api/v5/car_sound/get_brand',
    method: 'GET',
    encryptType: 'android',
    clearDefaultParams: true,
    cookie: params?.cookie || {},
  });
};

