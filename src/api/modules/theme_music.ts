// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/theme_music.js
 * 接口路由：/theme/music
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取主题音乐

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    platform: 'android',
    clienttime: Math.floor(Date.now() / 1000),
    show_theme_category_ids: params?.ids,
    userid: params?.userid || params?.cookie?.userid || 0,
    module_id: 508,
  };

  return useAxios({
    url: '/everydayrec.service/v1/mul_theme_category_recommend',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

