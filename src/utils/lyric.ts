/**
 * 歌词解析。
 *
 * 酷狗 `decodeContent` 有两种格式：
 *   1. KRC：[开始毫秒,持续毫秒]<逐字偏移,时长,0>字...
 *   2. LRC：[mm:ss.xx]歌词
 *
 * 解析后统一为按时间排序的 `LyricLine`；同一时间戳的第二行作为翻译。
 */

export interface LyricLine {
  /** 秒 */
  time: number;
  text: string;
  /** 翻译（酷狗部分歌词会以相同时间戳再给一行） */
  translation?: string;
}

const META_PATTERN = /^\[(ti|ar|al|by|offset|language|kana|hash|id|sign|qq|total):/i;
const LRC_PATTERN = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
const KRC_PATTERN = /^\[(\d+),(\d+)\](.*)$/;

/** 去掉 KRC 的逐字标签，并还原常见 HTML 实体 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** 解析 KRC / LRC 文本 */
export function parseLyric(raw: string): LyricLine[] {
  if (!raw) return [];
  const result: LyricLine[] = [];

  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || META_PATTERN.test(line)) continue;
    if (/^\[[a-z]{1,10}:\s*\]$/i.test(line)) continue;

    // KRC：[1234,567]<0,100,0>歌<100,100,0>词
    const krc = line.match(KRC_PATTERN);
    if (krc) {
      const time = Number(krc[1]) / 1000;
      const text = cleanText(krc[3]);
      if (!text) continue;
      result.push({ time, text });
      continue;
    }

    // LRC：可能一行有多个时间标签
    const tags = [...line.matchAll(new RegExp(LRC_PATTERN.source, 'g'))];
    if (tags.length) {
      const text = cleanText(line.replace(LRC_PATTERN, '').replace(/\[[^\]]*\]/g, ''));
      if (!text) continue;
      for (const tag of tags) {
        const minutes = Number(tag[1]);
        const seconds = Number(tag[2]);
        const fraction = tag[3] ? Number(`0.${tag[3]}`) : 0;
        result.push({ time: minutes * 60 + seconds + fraction, text });
      }
    }
  }

  result.sort((a, b) => a.time - b.time);

  // 合并同一时间戳的两行：第一行原文，第二行翻译
  const merged: LyricLine[] = [];
  for (const line of result) {
    const previous = merged[merged.length - 1];
    if (previous && Math.abs(previous.time - line.time) < 0.02 && previous.text !== line.text) {
      if (!previous.translation) previous.translation = line.text;
      continue;
    }
    merged.push({ ...line });
  }

  return merged;
}

/**
 * 二分查找当前时间对应的歌词行。
 * 返回 -1 表示还没到第一句。
 */
export function findActiveLine(lines: LyricLine[], time: number): number {
  if (!lines.length) return -1;
  let low = 0;
  let high = lines.length - 1;
  let answer = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].time <= time + 0.05) {
      answer = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return answer;
}
