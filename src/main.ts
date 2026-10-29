/**
 * 应用入口。
 *
 * 启动时做三件事：
 *   1. 读取登录态并刷新用户资料（有 Cookie 才会请求）
 *   2. 静默完成设备注册（dfid），否则播放地址接口会要求安全验证
 *   3. 初始化概念版 VIP 状态，并按设置自动领取今日 VIP
 *
 * 播放器在第一次被组件使用时初始化，不会在启动时自动播放。
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { ensureDfid } from './api';
import { useMembershipStore } from './stores/membership';
import { useUserStore } from './stores/user';
import './styles/global.css';

const pinia = createPinia();
const app = createApp(App).use(pinia).use(router);

const user = useUserStore(pinia);
user.init();

// 会员状态依赖登录态；init() 内部会监听登录/退出并自动领取
const membership = useMembershipStore(pinia);
membership.init();

void ensureDfid().catch(() => null);

app.mount('#app');
