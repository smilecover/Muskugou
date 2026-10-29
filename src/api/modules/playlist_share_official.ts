// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_share_official.js
 * 接口路由：/playlist/share/official
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoMd5, userid } from '../core/compat';
const fail = (status, msg) => ({ status, body: { status: 0, msg }, cookie: [], headers: {} });

// md5 = cryptoMd5('kgclientshare' + cryptoMd5(link))
const buildMd5 = (link) => {
  const first = cryptoMd5(link);              // 1. 对整个 url 做 md5
  return cryptoMd5(`kgclientshare${first}`);  // 2. 前缀 kgclientshare 后再 md5
};

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const id = params?.id || '';
  if (id === undefined || id === null || id === '') {
    throw fail(400, '歌单id不得为空！请检查重试。');
  }
  const type =  params?.type || 1;
  const isType1 = Number(type) === 1; //自建歌单type为1，反之为0，实测可不强制要求。
  const specialid = isType1 ? '-2147483648' : '0';
  const cType = isType1 ? '0' : '1';
  const uid = params?.cookie?.userid || params?.userid || 0;

  const link =
    'https://activity.kugou.com/share/v-a00a45b0/index.html' +
    `?u=${uid}` +
    '&h1=143298444507010930495471534764048014549' +
    '&h2=406dd14b2efd5e51affd6da64c84d0f6' +
    `&specialid=${specialid}` +
    `&global_specialid=${id}` +
    `&cType=${cType}`;

  const md5 = buildMd5(link);

  return useAxios({
    baseURL: 'http://t.service.kugou.com/',
    url: '/app',
    method: 'GET',
    encryptType: 'android',
    params: {
      caller: 'mlist',
      url: link,        // 不要手动 encodeURIComponent，axios 自动编码
      cmid: 5,
      md5,
    },
    cookie: params?.cookie || {},
    notSignature: true,
    clearDefaultParams: true,
    clearDefaultHeaders: true,
    headers: {'User-Agent': 'Android9-1070-10597-18-0-Share-wifi',
      'KG-THash': Math.floor(Math.random() * 0xfffffff)
      .toString(16)
      .padStart(7, '0')
  }
  });
};
