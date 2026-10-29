// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/listen_together_chat.js
 * 接口路由：/listen/together/chat
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */

import { GATEWAY_BASE, SELF_STUDY_BIZ, authBody, createDomainHandler } from './_listen_together_common';

export default createDomainHandler({
  send: {
    baseURL: GATEWAY_BASE,
    url: '/rmservice/v1/group/chat',
    method: 'POST',
    data: (p) => ({
      ...authBody(p),
      biz: p.biz || SELF_STUDY_BIZ,
      groupid: p.groupid || p.room_id || '',
      message: {
        msgtype: p.msgtype || 801,
        nickname: p.nickname || '',
        img: p.img || '',
        alert: p.alert || p.message || '',
      },
    }),
  },
  history: {
    baseURL: GATEWAY_BASE,
    url: '/rmservice/v1/group/msg_history',
    method: 'POST',
    data: (p) => ({
      ...authBody(p),
      biz: p.biz || SELF_STUDY_BIZ,
      groupid: p.groupid || p.room_id || '',
      maxid: p.maxid || '0',
      pagesize: p.pagesize || '20',
    }),
  },
});

