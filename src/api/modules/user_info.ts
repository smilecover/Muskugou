// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_info.js
 * 接口路由：/user/info
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

//获取我的详细信息
import { cryptoRSAEncrypt, appid, clientver, signParamsKey } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const token = params?.token || params?.cookie?.token || '';
  const userid = Number(params?.userid || params?.cookie?.userid || '0');
  const clienttime = Date.now();
  const mid = params?.mid || params?.cookie?.mid || params?.cookie?.KUGOU_API_MID || '';
  const p = cryptoRSAEncrypt({ clienttime:clienttime,token:token  }).toUpperCase();

  const dataMap = {
    p,
    appid,
    mid,
    clientver,
    source: 0,
    clienttime,
    uuid: "-",
    userid,
    key: signParamsKey(clienttime),
  };

  return useAxios({
    baseURL: 'http://relation.user.kugou.com',
    url: '/v1/get_my_userinfo',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
    headers: { 'Host': 'relation.user.kugou.com' },
  });
};
