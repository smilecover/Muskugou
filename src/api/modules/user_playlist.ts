// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_playlist.js
 * 接口路由：/user/playlist
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取用户歌单

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.cookie?.userid || params?.userid || 0;
  const token = params?.cookie?.token || params?.token || '';

  const dataMap = {
    userid,
    token,
    total_ver: 979,
    type: 2,
    page: params?.page || 1,
    pagesize: params?.pagesize || 30,
  };

  return useAxios({
    url: '/v7/get_all_list',
    encryptType: 'android',
    method: 'post',
    data: dataMap,
    params: { plat: 1, userid: Number(userid), token },
    cookie: params?.cookie,
    headers: { 'x-router': 'cloudlist.service.kugou.com' },
  });
};

