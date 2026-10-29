// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/top_album.js
 * 接口路由：/top/album
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 推荐专辑
import { apiver } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    apiver,
    token: params?.token || params?.cookie?.token || '',
    page: params?.page || 1,
    pagesize: params?.pagesize || 30,
    withpriv: 1,
  };

  return useAxios({
    url: '/musicadservice/v1/mobile_newalbum_sp',
    method: 'POST',
    data: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

