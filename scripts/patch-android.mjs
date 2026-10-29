/**
 * Android manifest 补丁。
 *
 * 酷狗部分媒体/封面地址历史上是 http；虽然客户端会尽量升级到 https，
 * 仍可能有少数 CDN 只返回 http。Android 9+ 默认禁止明文流量，因此这里在
 * `tauri android init` 生成工程后，为 <application> 打开 usesCleartextTraffic。
 *
 * 用法：
 *   pnpm android:init   # tauri android init + 自动打补丁
 *   pnpm android:patch  # 只重新打补丁
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!existsSync(manifestPath)) {
  console.error('未找到 Android 工程：' + manifestPath);
  console.error('请先安装 Android SDK/NDK 并运行：pnpm tauri android init');
  process.exit(1);
}

let manifest = readFileSync(manifestPath, 'utf8');
let changed = false;

// 1. 网络权限（Tauri 模板通常已包含，这里兜底）
if (!manifest.includes('android.permission.INTERNET')) {
  manifest = manifest.replace(
    /<application\b/,
    '  <uses-permission android:name="android.permission.INTERNET" />\n\n  <application',
  );
  changed = true;
}

// 2. 允许明文流量（兼容极少数 http 媒体地址）
if (!manifest.includes('android:usesCleartextTraffic')) {
  manifest = manifest.replace(/<application\b/, '<application\n        android:usesCleartextTraffic="true"');
  changed = true;
}

if (changed) {
  writeFileSync(manifestPath, manifest, 'utf8');
  console.log('✓ 已更新 AndroidManifest.xml（INTERNET + usesCleartextTraffic）');
} else {
  console.log('✓ AndroidManifest.xml 已包含所需配置，无需修改');
}

console.log('  ' + manifestPath);
