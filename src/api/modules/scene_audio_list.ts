// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/scene_audio_list.js
 * 接口路由：/scene/audio/list
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { appid, clientver } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || 0;
  const token = params?.token || params.cookie?.token || '';

  const dataMap = {
    appid,
    clientver,
    token,
    userid,
  };

  return useAxios({
    url: '/scene/v1/scene/audio_list',
    method: 'POST',
    encryptType: 'android',
    params: { scene_id: params.id, module_id: params.module_id, tag: params.tag, page: params.page || 1, page_size: params.pagesize || 30 },
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

