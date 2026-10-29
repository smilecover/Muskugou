// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_detail.js
 * 接口路由：/user/detail
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoRSAEncrypt } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const token = params?.token || params?.cookie?.token || '';
  const userid = Number(params?.userid || params?.cookie?.userid || '0');
  const clienttime_ms = Math.floor(Date.now() / 1000);
  const pk = cryptoRSAEncrypt({ token, clienttime: clienttime_ms }).toUpperCase();

  const dataMap = {
    visit_time: clienttime_ms,
    usertype: 1,
    p: pk,
    userid,
  };

  return useAxios({
    url: '/v3/get_my_info',
    method: 'POST',
    data: dataMap,
    params: { plat: 1 },
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'usercenter.kugou.com' },
  });
};

