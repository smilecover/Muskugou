// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/search_default.js
 * 接口路由：/search/default
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { clientver } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || 0;
  const vip_type = params?.vip_type || params?.cookie?.vip_type || 65530;
  const dataMap = {
    'plat': 0,
    'userid': Number(userid),
    'tags': '{}',
    'vip_type': vip_type,
    'm_type': 0,
    'own_ads': {},
    'ability': '3',
    'sources': [],
    'bitmap': 2,
    'mode': 'normal',
  };

  return useAxios({
    url: '/searchnofocus/v1/search_no_focus_word',
    method: 'POST',
    data: dataMap,
    params: { clientver: 12329 },
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

