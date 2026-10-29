// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_vip.js
 * 接口路由：/youth/vip
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 领取vip 需要登录
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const time = Date.now();
  const dataMap = {
    ad_id: 12307537187,
    play_end: time,
    play_start: time - 30000,
  };

  return useAxios({
    url: '/youth/v1/ad/play_report',
    encryptType: 'android',
    method: 'post',
    data: dataMap,
    cookie: params?.cookie,
  });
};

