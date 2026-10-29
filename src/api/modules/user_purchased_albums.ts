// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_purchased_albums.js
 * 接口路由：/user/purchased/albums
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 已购专辑
import { appid, clientver } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    appid,
    userid: Number(params?.cookie?.userid) || 0,
    token: params?.cookie?.token || '',
    page: Number(params?.page) || 1,
    pagesize: Number(params?.pagesize) || 15,
    clientver: String(clientver),
    deleted: 0,
  };

  return useAxios({
    url: '/openapi/v1/copyright/get_album_goods',
    method: 'POST',
    data: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

