// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_channel_similar.js
 * 接口路由：/youth/channel/similar
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/youth/v1/channel/get_friendly_channel',
    encryptType: 'android',
    method: 'post',
    data: {
      area_code: 1,
      playlist_ver: 2,
      vip_type: params?.vip_type || params?.cookie?.vip_type || 0,
      platform: 'ios'
    },
    params: { channel_id: params.channel_id },
    cookie: params?.cookie,
  });
};

