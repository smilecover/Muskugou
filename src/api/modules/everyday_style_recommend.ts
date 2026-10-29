// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/everyday_style_recommend.js
 * 接口路由：/everyday/style/recommend
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    platform: params.platform || 'ios' 
  };

  return useAxios({
    url: '/everydayrec.service/everyday_style_recommend',
    encryptType: 'android',
    method: 'POST',
    data: {},
    params: { tagids: params.tagids ?? ''},
    cookie: params?.cookie || {},
  });
};

