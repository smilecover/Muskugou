// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/team_my.js
 * 接口路由：/team/my
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import { Buffer } from '../core/buffer';
import type { UseAxios } from '../core/types';

//创建我的队伍
import * as crypto from '../core/node/crypto';
import { cryptoMd5, appid, clientver, srcappid, publicLiteRasKey } from '../core/compat';

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

//携带请求体进行签名
function signatureWebParamsWithBody(params, bodyStr) {
    const SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
    const paramsString = Object.keys(params)
        .sort()
        .map(k => `${k}=${params[k]}`)
        .join('');
    const input = SALT + paramsString + bodyStr + SALT;
    return cryptoMd5(input);
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
    const paramsMap = {
        srcappid,
        clientver,
        clienttime,
        mid,
        uuid,
        dfid,
        appid,
        userid,
        token,
    };

    const dataMap = { period_id: params.period_id };
    //转为字符串参与签名
    const dataStr = JSON.stringify(dataMap);

    const signature = signatureWebParamsWithBody(paramsMap, dataStr);
    const finalParams = { ...paramsMap, signature };

    return useAxios({
        url: '/youth/v1/ut/create_team',
        method: 'POST',
        data: dataMap,
        params: finalParams,
        cookie: params?.cookie || {},
        headers: { 'Host': 'gateway.kugou.com' },
    });
};

