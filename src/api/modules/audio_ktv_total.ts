// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/audio_ktv_total.js
 * 接口路由：/audio/ktv/total
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoMd5, appid } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {

  const dataMap = {
    isteen: 0,
    songId: Number(params.songId),
    usemkv: 1,
    platform: 2,
    singerName: params.singerName,
    songHash: params.songHash,
    version: 12375,
    appid,
  }


  const str = '*s&iN#G70*';
  const paramsString = Object.keys(dataMap)
    .sort()
    .map((key) => `${key}=${typeof dataMap[key] === 'object' ? JSON.stringify(dataMap[key]) : dataMap[key]}`)
    .join('&');
  dataMap['sign'] = cryptoMd5(`${paramsString}${str}`).substring(8, 24);
  
  return useAxios({
    baseURL: 'https://acsing.service.kugou.com',
    url: '/sing7/listenguide/json/v2/cdn/listenguide/get_total_opus_num_v02.do',
    params: dataMap,
    method: 'get',
    encryptType: 'android',
    cookie: params?.cookie || {},
    clearDefaultParams: true,
    notSignature: true,
  });
};

