// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/artist_follow.js
 * 接口路由：/artist/follow
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoAesEncrypt, rsaEncrypt2 } from '../core/compat';
// 关注歌手
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const singerid = Number(params.id);
  const token = params?.token || params.cookie?.token || '';
  const userid = Number(params?.userid || params?.cookie?.userid || 0);
  const clienttime = Math.floor(Date.now() / 1000);

  const encrypt = cryptoAesEncrypt({ singerid, token });
  

  const paramsMap = {
    plat: 0,
    userid,
    singerid,
    source: 7,
    p: rsaEncrypt2({ clienttime, key: encrypt.key }),
    params: encrypt.str
  }

  

  return useAxios({
    url: '/followservice/v3/follow_singer',
    method: 'post',
    data: paramsMap,
    params: {clienttime},
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

