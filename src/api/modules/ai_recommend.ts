// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/ai_recommend.js
 * 接口路由：/ai/recommend
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { appid, clientver, signParamsKey, cryptoMd5 } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || 0;
  const mid = params?.cookie?.KUGOU_API_MID; // 可以自定义
  const clienttime = Date.now();

  const recommend_source = (params?.album_audio_id || '').split(',').map((s) => ({ ID: Number(s) }));

  const dataMap = {
    platform: 'ios',
    clientver,
    clienttime: clienttime,
    userid,
    client_playlist: [],
    source_type: 2,
    playlist_ver: 2,
    area_code: 1,
    appid,
    key: signParamsKey(clienttime.toString()),
    mid,
    recommend_source,
  };

  return useAxios({
    url: '/recommend',
    data: dataMap,
    method: 'post',
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'songlistairec.kugou.com' },
    clearDefaultParams: true,
  });
};

