// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/yueku_banner.js
 * 接口路由：/yueku/banner
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取乐库下的 banner

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    plat: 0,
    channel: 201,
    operator: 7,
    networktype: 2,
    userid: params?.userid || params?.cookie?.userid || 0,
    vip_type: 0,
    m_type: 0,
    tags: [],
    apiver: 5,
    ability: 2,
    mode: 'normal',
  };

  return useAxios({
    url: '/ads.gateway/v3/listen_banner',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

