// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/longaudio_tag_list.js
 * 接口路由：/longaudio/tag/list
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 听书分类标签列表
// 酷狗听书「分类」标签树（有声小说 906 及其 24 个子分类），走标准版
// gateway.kugou.com/v3/list_audiobook_tags（x-router: longaudio.kugou.com，
// appid=1005 + 标准签名盐）。
// 响应 data[0] 为有声小说(906)，其 son[] 为子分类（tag_id/tag_name/channel/show_vip），
// channel：0=通用 / 1=男频 / 2=女频。
export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/v3/list_audiobook_tags',
    method: 'get',
    params: {
      platform: 'android',
      clientver: 20789, // 覆盖为与官方 Android 客户端一致
    },
    encryptType: 'android',
    headers: { 'x-router': 'longaudio.kugou.com' },
    cookie: params?.cookie || {},
  });
};

