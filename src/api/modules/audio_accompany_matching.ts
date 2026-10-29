// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/audio_accompany_matching.js
 * 接口路由：/audio/accompany/matching
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoMd5, appid } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {

  const dataMap = {
    isteen: 0,
    mixId: Number(params.mixId) || 0,
    usemkv: 1,
    platform: 2,
    fileName: params.fileName || '',
    hash: params.hash,
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
    baseURL: 'https://nsongacsing.kugou.com',
    url: '/sing7/accompanywan/json/v2/cdn/optimal_matching_accompany_2_listen.do',
    params: dataMap,
    method: 'get',
    encryptType: 'android',
    cookie: params?.cookie || {},
    clearDefaultParams: true,
    notSignature: true,
  });
};

