// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_tracks_sort.js
 * 接口路由：/playlist/tracks/sort
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 对歌单内歌曲排序（自定义排序，可对「我喜欢」歌单使用）
// 使用云歌单服务加密协议（cloudlist.service.kugou.com）
// listid: 歌单 listid
// type: 歌单类型，0=自建/我喜欢，1=收藏
// list_ver: 歌单列表版本号（歌单歌曲接口返回的 list_ver）
// data: 排序数据，格式为 fileid|sort，多个用逗号分隔
import { createCloudRequest } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const resource = (params.data || '').split(',').map((s) => {
    const [fileid, sort] = s.split('|');
    return { fileid: Number(fileid), sort: Number(sort || 0) };
  });

  const dataMap = {
    listid: Number(params.listid),
    list_ver: Number(params.list_ver || 0),
    type: Number(params.type || 0),
    data: resource,
  };

  return createCloudRequest({
    url: '/v1/modify_song_sort',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

