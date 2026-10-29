// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/lyric.js
 * 接口路由：/lyric
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import { Buffer } from '../core/buffer';
import type { UseAxios } from '../core/types';

// 歌词获取
import { decodeLyrics } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    ver: 1,
    client: params?.client || 'android',
    id: params?.id,
    accesskey: params?.accesskey,
    fmt: params.fmt || 'krc',
    charset: 'utf8',
  };

  return new Promise((resolve, reject) => {
    useAxios({
		  baseURL: 'https://lyrics.kugou.com',
		  url: '/download',
      method: 'GET',
      params: dataMap,
      cookie: params?.cookie || {},
      encryptType: 'android',
    })
      .then((res) => {
        if (params?.decode) {
          if (res.body?.content) {
            res.body['decodeContent'] = params?.fmt == 'lrc' || Number(res.body?.contenttype) !== 0 ? Buffer.from(res.body?.content, 'base64').toString() : decodeLyrics(res.body.content);
            resolve(res);
            return;
          }
        }
        resolve(res);
      })
      .catch((e) => reject(e));
  });
};

