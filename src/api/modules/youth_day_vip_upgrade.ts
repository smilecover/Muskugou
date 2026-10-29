// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_day_vip_upgrade.js
 * 接口路由：/youth/day/vip/upgrade
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { srcappid } from '../core/compat';

//升级vip
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const paramsMap = {
    kugouid: Number(params?.userid || params?.cookie?.userid || 0),
    ad_type: 1,
  }


  

  return useAxios({
    url: '/youth/v1/listen_song/upgrade_vip_reward',
    encryptType: 'android',
    method: 'post',
    params: paramsMap,
    cookie: params?.cookie,
  });
};

