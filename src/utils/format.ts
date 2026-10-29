/** 通用格式化工具 */

/** 毫秒 -> mm:ss（超过 1 小时显示 h:mm:ss） */
export function formatDuration(milliseconds: number | undefined | null): string {
  const total = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** 播放量：1.2万 / 3.4亿 */
export function formatCount(value: number | undefined | null): string {
  const count = Number(value || 0);
  if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(1).replace(/\.0$/, '')}亿`;
  if (count >= 10_000) return `${(count / 10_000).toFixed(1).replace(/\.0$/, '')}万`;
  return String(count);
}

/** 秒 -> mm:ss */
export function formatSeconds(seconds: number | undefined | null): string {
  return formatDuration((seconds || 0) * 1000);
}

/** ISO/时间戳 -> YYYY-MM-DD */
export function formatDate(value: string | number | undefined | null): string {
  if (!value) return '';
  const date = typeof value === 'number' ? new Date(value * (value < 1e12 ? 1000 : 1)) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 截断文本 */
export function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

/** 简易防抖 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay = 300): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
