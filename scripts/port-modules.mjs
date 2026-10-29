/**
 * 将参考资料 `src/KuGouMusicApi/module/*.js` 全量移植为 TypeScript 模块。
 *
 * 这是一个一次性 codemod，只做“结构转换”，不改写业务逻辑：
 *   - CommonJS require  -> ESM import（映射到 src/api/core 下的兼容实现）
 *   - module.exports    -> export default / 命名导出
 *   - 注入 UseAxios 参数类型、Buffer 与 process 兼容导入
 *   - 保留原文件的全部注释与实现
 *
 * 生成文件统一带 `// @ts-nocheck`：这批模块是原库的忠实镜像，类型标注
 * 集中维护在 `src/api/core` 与 App 层；模块层只保证语法与运行行为一致。
 *
 * 用法：node scripts/port-modules.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'src/KuGouMusicApi/module');
const OUTPUT_DIR = path.join(ROOT, 'src/api/modules');

/** require 说明符 -> 生成文件中的 import 说明符 */
const SPECIFIER_MAP = new Map([
  ['../util', '../core/compat'],
  ['../util/config.json', '../core/legacy-config'],
  ['../util/util', '../core/util'],
  ['../util/crypto', '../core/crypto'],
  ['../util/helper', '../core/helper'],
  ['../util/runtime', '../core/compat'],
  ['../util/request', '../core/request'],
  ['../util/generate_simulate', '../core/simulate'],
  ['crypto', '../core/node/crypto'],
  ['zlib', '../core/node/zlib'],
  ['net', '../core/node/net'],
  ['fs', '../core/node/fs'],
  ['form-data', '../core/node/form-data'],
  ['axios', '../core/node/axios'],
  ['qrcode', '../core/node/qrcode'],
]);

/**
 * Node 内置模块的兼容层只有命名导出（`export const crypto = {...}`），
 * 因此 `const crypto = require('crypto')` 要转成命名空间导入。
 */
const NAMESPACE_SPECIFIERS = new Set(['crypto', 'zlib', 'net', 'fs']);

/**
 * 把注释替换成等长空白（保留换行），这样正则只会命中真实代码。
 * 同时跳过字符串/模板字符串，避免误判字符串里的 `//`。
 */
function maskComments(text) {
  const chars = text.split('');
  let i = 0;
  let state = 'code';
  let quote = '';

  const blank = (start, end) => {
    for (let index = start; index < end; index += 1) {
      if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
    }
  };

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        const start = i;
        i += 2;
        while (i < text.length && text[i] !== '\n') i += 1;
        blank(start, i);
        continue;
      }
      if (char === '/' && next === '*') {
        const start = i;
        i += 2;
        while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
        i = Math.min(i + 2, text.length);
        blank(start, i);
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        state = 'string';
        quote = char;
      }
      i += 1;
      continue;
    }

    // 字符串内部：处理转义与结束引号
    if (char === '\\') {
      i += 2;
      continue;
    }
    if (char === quote) {
      state = 'code';
      quote = '';
    }
    i += 1;
  }

  return chars.join('');
}

/** 根据 masked 文本上的正则匹配，批量替换原始文本（从后往前，避免下标偏移） */
function replaceByMasked(text, regex, buildReplacement) {
  const masked = maskComments(text);
  const edits = [];
  for (const match of masked.matchAll(regex)) {
    const replacement = buildReplacement(match, text);
    if (replacement === null || replacement === undefined) continue;
    edits.push({ start: match.index, end: match.index + match[0].length, replacement });
  }
  edits.sort((a, b) => b.start - a.start);

  let output = text;
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  }
  return output;
}

/** 读取 module 目录，建立“小写文件名 -> 实际文件名”的映射（兼容 Windows 大小写） */
function buildLocalModuleMap() {
  const map = new Map();
  for (const file of fs.readdirSync(SOURCE_DIR)) {
    if (!file.endsWith('.js')) continue;
    map.set(file.replace(/\.js$/i, '').toLowerCase(), file.replace(/\.js$/i, ''));
  }
  return map;
}

/** 构造 import 语句 */
function buildImport(binder, specifier) {
  const trimmed = binder.trim();
  if (trimmed.startsWith('{')) {
    // 原库没有使用 `{ a: b }` 或默认值，直接保留解构内容
    const names = trimmed
      .slice(1, -1)
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .join(', ');
    return `import { ${names} } from '${specifier}';`;
  }
  if (NAMESPACE_SPECIFIERS.has(specifier.replace('../core/node/', ''))) {
    return `import * as ${trimmed} from '${specifier}';`;
  }
  return `import ${trimmed} from '${specifier}';`;
}

/** 转换 require -> import */
function convertRequires(text, localModuleMap) {
  const requireRegex = /const\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\);?/g;

  return replaceByMasked(text, requireRegex, (match) => {
    const binder = match[1];
    const originalSpecifier = match[3];
    let specifier = SPECIFIER_MAP.get(originalSpecifier);

    if (!specifier && originalSpecifier.startsWith('./')) {
      const base = originalSpecifier.slice(2);
      const actual = localModuleMap.get(base.toLowerCase());
      if (!actual) {
        throw new Error(`找不到本地模块：${originalSpecifier}`);
      }
      // 保证大小写与实际文件名一致（例如 ./sidEdt -> ./sidedt）
      specifier = `./${actual}`;
    }

    if (!specifier) {
      throw new Error(`未配置的 require 路径：${originalSpecifier}`);
    }

    return buildImport(binder, specifier);
  });
}

/** 转换 module.exports */
function convertExports(text) {
  // 1) 附加命名导出：module.exports.foo = foo;
  let output = replaceByMasked(
    text,
    /module\.exports\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;?/g,
    (match) => (match[1] === match[2] ? `export { ${match[1]} };` : `export { ${match[2]} as ${match[1]} };`)
  );

  // 2) 多命名导出对象：module.exports = { ... };
  output = replaceByMasked(output, /module\.exports\s*=\s*\{/g, () => 'export {');

  // 3) 标准接口模块：module.exports = (params, useAxios) => ...;
  output = replaceByMasked(
    output,
    /module\.exports\s*=\s*(async\s+)?\(\s*params(\s*=\s*\{\})?\s*,\s*useAxios\s*\)\s*=>/g,
    (match) => {
      const asyncKeyword = match[1] || '';
      const defaultValue = match[2] ? ' = {}' : '';
      return `export default ${asyncKeyword}(params: any${defaultValue}, useAxios: UseAxios): Promise<any> =>`;
    }
  );

  // 4) 其余情况（例如 module.exports = commentFloor;）
  output = replaceByMasked(output, /module\.exports\s*=\s*/g, () => 'export default ');

  return output;
}

/** 生成文件头注释 */
function buildHeader(fileName, route) {
  const isInternal = fileName.startsWith('_');
  const routeLine = isInternal ? '内部辅助模块（不注册为接口路由）' : `接口路由：${route}`;

  return `// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/${fileName}
 * ${routeLine}
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
`;
}

/** 主流程 */
function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const localModuleMap = buildLocalModuleMap();
  const files = fs.readdirSync(SOURCE_DIR).filter((file) => file.endsWith('.js'));
  let converted = 0;

  for (const fileName of files) {
    const sourcePath = path.join(SOURCE_DIR, fileName);
    let text = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');

    // 去掉 CommonJS 的严格模式声明（ESM 默认严格）
    text = text.replace(/^(['"])use strict\1;\s*$/m, '');

    text = convertRequires(text, localModuleMap);

    // require 转换后重新处理导出，保证下标基于最新文本
    text = convertExports(text);

    const baseName = fileName.replace(/\.js$/i, '');
    const route = `/${baseName.replace(/_/g, '/')}`;
    const header = buildHeader(fileName, route);

    // 兼容导入：Buffer / process / UseAxios 类型
    const extraImports = [];
    if (/\bBuffer\b/.test(text)) {
      extraImports.push("import { Buffer } from '../core/buffer';");
    }
    if (/\bprocess\s*\./.test(text)) {
      extraImports.push("import { processEnv as process } from '../core/node/env';");
    }
    if (/\bUseAxios\b/.test(text)) {
      extraImports.push("import type { UseAxios } from '../core/types';");
    }

    const output = `${header}${extraImports.length ? `${extraImports.join('\n')}\n` : ''}\n${text.trimStart()}\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName}.ts`), output, 'utf8');
    converted += 1;
  }

  console.log(`已转换 ${converted} 个模块 -> ${path.relative(ROOT, OUTPUT_DIR)}`);
}

main();
