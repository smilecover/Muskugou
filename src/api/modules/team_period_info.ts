// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/team_period_info.js
 * 接口路由：/team/period/info
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import { Buffer } from '../core/buffer';
import type { UseAxios } from '../core/types';

//获取本期活动状态
import * as crypto from '../core/node/crypto';
import { signatureWebParams, appid, clientver, srcappid, publicLiteRasKey } from '../core/compat';

function rsaNoPadEncrypt(data, publicKeyPem) {
    const key = crypto.createPublicKey(publicKeyPem);
    const encrypted = crypto.publicEncrypt(
        {
            key: key,
            padding: crypto.constants.RSA_NO_PADDING,
        },
        data
    );
    return encrypted.toString('hex');
}

export default (params: any, useAxios: UseAxios): Promise<any> => {

    const rawToken = params?.token || params?.cookie?.token || '';
    const userid = Number(params?.userid || params?.cookie?.userid || '0');
    const mid = params?.cookie?.KUGOU_API_MID || params?.mid || '';
    const dfid = params?.dfid || params?.cookie?.dfid || '-';
    const uuid = params?.uuid || params?.cookie?.uuid || '-';

    let token = rawToken;
    const prefix = 'moc.uoguk.59::';                
    const input = Buffer.from(prefix + rawToken, 'utf8');
    const padded = Buffer.alloc(128);
    input.copy(padded);

    const encrypted = rsaNoPadEncrypt(padded, publicLiteRasKey).toUpperCase();
    token = 'h5' + encrypted;                       

    const clienttime = Date.now();
    const dataMap = {
        srcappid,
        clientver,
        clienttime,
        mid,
        uuid,
        dfid,
        appid,
        userid,
        token
    };

    const signature = signatureWebParams(dataMap);     
    const finalParams = { ...dataMap, signature };    

    return useAxios({
        url: '/youth/v1/ut/get_period_info',
        method: 'GET',
        params: finalParams,
        cookie: params?.cookie || {},
        headers: { 'Host':'gateway.kugou.com'}
    });
};
