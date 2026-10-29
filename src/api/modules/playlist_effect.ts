// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_effect.js
 * 接口路由：/playlist/effect
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取音效歌单

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    page: params?.page || 1,
    pagesize: params?.pagesize || 30,
  };

  return useAxios({
    url: '/pubsongs/v1/get_sound_effect_list',
    method: 'POST',
    encryptType: 'android',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

