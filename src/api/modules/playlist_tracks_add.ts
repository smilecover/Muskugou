// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_tracks_add.js
 * 接口路由：/playlist/tracks/add
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 对歌单添加歌曲
// listid, 歌单listid
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || 0;
  const token = params?.token || params.cookie?.token || '';
  const clienttime = Math.floor(Date.now() / 1000);

  const resource = (params.data || '').split(',').map((s) => {
    const data = s.split('|');
    return {
      number: 1,
      name: data[0] || '',
      hash: data[1] || '',
      size: 0,
      sort: 0,
      timelen: 0,
      bitrate: 0,
      album_id: Number(data[2] || 0),
      mixsongid: Number(data[3] || 0),
    };
  });

  const dataMap = {
    userid,
    token,
    listid: params.listid,
    list_ver: 0,
    type: 0,
    slow_upload: 1,
    scene: 'false;null',
    data: resource,
  };

  return useAxios({
    url: '/cloudlist.service/v6/add_song',
    data: dataMap,
    params: { last_time: clienttime, last_area: 'gztx', userid, token },
    method: 'post',
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

