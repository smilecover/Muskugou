// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/listen_together_discovery.js
 * 接口路由：/listen/together/discovery
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */

import { YOUTH_BASE, createDomainHandler } from './_listen_together_common';

export default createDomainHandler({
  channel_search: {
    baseURL: YOUTH_BASE,
    url: '/v1/search/channel',
    method: 'GET',
    params: (p) => ({ keyword: p.keyword || '', page: p.page || 1, position: p.position || 1 }),
  },
  kugroup_square: {
    baseURL: YOUTH_BASE,
    url: '/v1/kugroup/square',
    method: 'GET',
    params: (p) => ({ page: p.page || 1, pagesize: p.pagesize || 20, order_type: p.order_type || 1 }),
  },
  genting_square: {
    baseURL: YOUTH_BASE,
    url: '/v1/genting/square',
    method: 'GET',
    params: (p) => ({ page: p.page || 1, pagesize: p.pagesize || 20, order_type: p.order_type || 1 }),
  },
  kugroup_streamers: {
    baseURL: YOUTH_BASE,
    url: '/v1/kugroup/get_streamer_list',
    method: 'GET',
    params: (p) => ({ longitude: p.longitude || 0, latitude: p.latitude || 0 }),
  },
  genting_streamers: {
    baseURL: YOUTH_BASE,
    url: '/v1/genting/get_streamer_list',
    method: 'GET',
    params: (p) => ({ page: p.page || 1, pagesize: p.pagesize || 20 }),
  },
  recent_rooms: {
    baseURL: YOUTH_BASE,
    url: '/v3/user/recent_room_dynamic',
    method: 'GET',
    params: () => ({}),
  },
  privilege: {
    baseURL: YOUTH_BASE,
    url: '/v1/privilege/operate',
    method: 'GET',
    params: (p) => ({ event_type: p.event_type || 4 }),
  },
  genting_recommend: {
    baseURL: 'https://concepts.kugou.com',
    url: '/v1/genting/recommend',
    method: 'POST',
    params: (p) => ({ page: p.page || 1, pagesize: p.pagesize || 20, room_biz: p.room_biz || 1006 }),
  },
});

