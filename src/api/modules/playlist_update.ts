// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_update.js
 * 接口路由：/playlist/update
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 修改「我的歌单」信息（名称/排序/标签/简介/封面）
// 使用云歌单服务加密协议（cloudlist.service.kugou.com）
// total_ver: 歌单总版本号（用户歌单接口返回的 total_ver）
// listid: 歌单 listid
// type: 歌单类别，0=自建/我喜欢，1=收藏
// name: 歌单名称（可选，缺省时不改动名称）
// sort: 歌单排序号
// tags: 歌单标签
// intro: 歌单简介
// pic: 自定义封面，格式为 custom/<FileName>（FileName 由 /playlist/pic/upload 返回）
import { createCloudRequest } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    total_ver: Number(params.total_ver || 0),
    listid: Number(params.listid),
    type: Number(params.type || 0),
    sort: Number(params.sort || 0),
    tags: params.tags || '',
    intro: params.intro || '',
  };

  if (params.name) {
    dataMap.name = params.name;
  }

  if (params.pic) {
    dataMap.pic = params.pic;
  }

  return createCloudRequest({
    url: '/v1/modify_list',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

