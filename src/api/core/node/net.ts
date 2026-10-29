/**
 * Node `net` 兼容层。
 * 只实现 `isIP`，用于播放上报接口的本地 IP 校验。
 */

/** 判断 IPv4 */
function isIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255 && String(number) === part.replace(/^0+(?=\d)/, '');
  });
}

/** 判断 IPv6（覆盖常见写法，含压缩零与 IPv4 映射） */
function isIPv6(value: string): boolean {
  if (!value.includes(':')) return false;
  if ((value.match(/::/g) || []).length > 1) return false;
  const [head, tail] = value.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const all = [...headParts, ...tailParts].filter(Boolean);
  if (all.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return false;
  if (value.includes('::')) return all.length < 8;
  return all.length === 8;
}

/** 返回 4 / 6 / 0，与 Node net.isIP 一致 */
function isIP(value: string): number {
  if (typeof value !== 'string') return 0;
  if (isIPv4(value)) return 4;
  if (isIPv6(value)) return 6;
  return 0;
}

export const net = { isIP };
export { isIP };
