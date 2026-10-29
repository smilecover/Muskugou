// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_listen.js
 * 接口路由：/user/listen
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoRSAEncrypt } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const token = params?.token || params?.cookie?.token || '';
  const userid = params?.userid || params?.cookie?.userid || '0';

  const clienttime = Math.floor(Date.now() / 1000);

  const p = cryptoRSAEncrypt({ clienttime, token }).toUpperCase();
  const dataMap = {
    t_userid: userid,
    userid,
    list_type: params.type || 0,
    area_code: 1,
    cover: 2,
    p,
  };

  return useAxios({
    baseURL: 'https://listenservice.kugou.com',
    url: '/v2/get_list',
    data: dataMap,
    params: { clienttime, plat: 0 },
    method: 'POST',
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

