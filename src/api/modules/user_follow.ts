// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_follow.js
 * 接口路由：/user/follow
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoRSAEncrypt } from '../core/compat';
/**
 * 获取用户关注的歌手
 */
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const token = params?.token || params?.cookie?.token || '';
  const userid = params?.userid || params?.cookie?.userid || '0';
  const dateTime = Math.floor(Date.now() / 1000);
  const dataMap = {
    merge: 2,
    need_iden_type: 1,
    ext_params: 'k_pic,jumptype,singerid,score',
    userid,
    type: 0,
    id_type: 0,
    p: cryptoRSAEncrypt({ clienttime: dateTime, token }).toUpperCase(),
  };

  return useAxios({
    url: '/v4/follow_list',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    params: { plat: 1 },
    cookie: params?.cookie || {},
    headers: { 'x-router': 'relationuser.kugou.com' },
  });
};

