// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/song_auth.js
 * 接口路由：/song/auth
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const authorization = params.auth || params.cookie.auth || '';

  const dataMap = {
    authorization,
    module_id: 51,
    album_audio_id: Number(params.album_audio_id ?? 0),
    clientver: 11561,
    hash: (params?.hash || '').toLowerCase(),
  };

  return useAxios({
    baseURL: 'http://gateway.kugou.com/',
    url: '/v1/authorization',
    method: 'GET',
    params: dataMap,
    encryptType: 'android',
    // 同 user_verify.js：走网关 + x-router，与官方客户端抓包一致。
    headers: { 'x-router': 'trackercdngz.kugou.com' },
    cookie: Object.assign({}, params?.cookie),
  });
};

