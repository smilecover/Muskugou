// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_pic.js
 * 接口路由：/playlist/pic
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 修改「我的歌单」封面（自建/收藏歌单）
// 使用云歌单服务加密协议（cloudlist.service.kugou.com）
// total_ver: 歌单总版本号（用户歌单接口返回的 total_ver）
// type: 歌单类别，0=自建歌单，1=收藏歌单
// data: 封面数据，格式为 listid|type|pic，多个用逗号分隔
// pic 可为完整封面 URL（http://imge.kugou.com/stdmusic/{size}/xxx.jpg）
// 或相对路径（stdmusic/xxx.jpg），完整 URL 会自动取最后一段并补上 stdmusic/ 前缀
import { createCloudRequest } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const resource = (params.data || '').split(',').map((s) => {
    const [listid, type, pic] = s.split('|');
    const cover = !String(pic || '').startsWith('stdmusic/') ? 'stdmusic/' + String(pic).split('/').pop() : pic;
    return { listid: Number(listid), type: Number(type || 0), pic: cover };
  });

  const dataMap = {
    total_ver: Number(params.total_ver || 0),
    data: resource,
  };

  return createCloudRequest({
    url: '/v1/modify_list_pic',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

