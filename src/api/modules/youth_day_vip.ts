// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_day_vip.js
 * 接口路由：/youth/day/vip
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 领取vip(领取一天) 需要登录
import { srcappid } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/youth/v1/recharge/receive_vip_listen_song',
    encryptType: 'android',
    method: 'post',
    params: { source_id: 90139, receive_day: params.receive_day },
    headers: {'content-type': 'application/x-www-form-urlencoded'  },
    cookie: params?.cookie,
  });
};

