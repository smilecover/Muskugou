// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_tracks_del.js
 * 接口路由：/playlist/tracks/del
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 对歌单删除歌曲

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || 0;
  const token = params?.token || params.cookie?.token || '';

  const resource = (params.fileids || '').split(',').map((s) => ({ fileid: Number(s) }));

  const dataMap = {
    listid: params.listid,
    userid,
    data: resource,
    type: 0,
    token,
    list_ver: 0,
  };

  return useAxios({
    url: '/v4/delete_songs',
    data: dataMap,
    method: 'post',
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'cloudlist.service.kugou.com' },
  });
};

