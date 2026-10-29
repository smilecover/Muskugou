// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_cloud_url.js
 * 接口路由：/user/cloud/url
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取云盘音乐url
import { signCloudKey } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const hash = String(params.hash).toLocaleLowerCase();
  const paramsMap = {
    hash: hash,
    ssa_flag: 'is_fromtrack',
    version: '20102',
    ssl: 0,
    album_audio_id: params.album_audio_id ?? 0,
    pid: 20026,
    audio_id: params.audio_id ?? 0,
    kv_id: 2,
    key: signCloudKey(hash, 20026),
    bucket: 'musicclound',
    name: params.name ?? '',
    with_res_tag: 0,
  };

  return useAxios({
    url: '/bsstrackercdngz/v2/query_musicclound_url',
    encryptType: 'android',
    method: 'get',
    params: paramsMap,
    cookie: params?.cookie,
  });
};

