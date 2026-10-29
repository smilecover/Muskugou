// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/login_device.js
 * 接口路由：/login/device
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoAesEncrypt, cryptoRSAEncrypt } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const clienttime_ms = parseInt(new Date().getTime());
  const encrypt = cryptoAesEncrypt({ token: params.token || params.cookie?.token });
  const dataMap = {
    plat: 1,
    userid: params.userid || params.cookie?.userid || 0,
    clienttime_ms,
    pk: cryptoRSAEncrypt({ clienttime_ms, key: encrypt.key }).toUpperCase(),
    params: encrypt.str,
  };

  return useAxios({
    baseURL: 'https://userinfoservice.kugou.com',
    url: '/v2/get_dev',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

