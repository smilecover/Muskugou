// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/ip_playlist.js
 * 接口路由：/ip/playlist
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 根据 ip 获取相对于歌单
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    ip: params?.id,
    page: params?.page || 1,
    pagesize: params?.pagesize || 30,
  };

  return useAxios({
    url: '/ocean/v6/pubsongs/list_info_for_ip',
    encryptType: 'android',
    method: 'POST',
    params: dataMap,
    cookie: params?.cookie || {},
  });
};

