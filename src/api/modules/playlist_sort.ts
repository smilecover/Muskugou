// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_sort.js
 * 接口路由：/playlist/sort
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 对「我的歌单」列表排序（自建歌单/收藏歌单）
// 使用云歌单服务加密协议（cloudlist.service.kugou.com）
// total_ver: 歌单总版本号（用户歌单接口返回的 total_ver）
// type: 歌单类别，0=自建歌单，1=收藏歌单（sort 按类别分开编号）
// data: 排序数据，格式为 listid|type|sort，多个用逗号分隔
import { createCloudRequest } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const resource = (params.data || '').split(',').map((s) => {
    const [listid, type, sort] = s.split('|');
    return { listid: Number(listid), type: Number(type || 0), sort: Number(sort || 0) };
  });

  const dataMap = {
    total_ver: Number(params.total_ver || 0),
    data: resource,
  };

  return createCloudRequest({
    url: '/v1/modify_list_sort',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

