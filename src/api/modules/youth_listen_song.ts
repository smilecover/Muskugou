// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_listen_song.js
 * 接口路由：/youth/listen/song
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 听歌领取vip 需要登录
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    mixsongid: params?.mixsongid || 666075191
  }

  return useAxios({
    url: '/youth/v2/report/listen_song',
    data: dataMap,
    method: 'POST',
    encryptTyPe: 'android',
    params: { clientver: 10566 },
    cookie: params?.cookie,
    headers: {
      "user-agent": "Android13-1070-10566-201-0-ReportPlaySongToServerProtocol-wifi",
      "content-type": "application/json; charset=utf-8",
    },
  });
};

