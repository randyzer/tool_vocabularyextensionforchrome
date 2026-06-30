import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: '语境生词本',
    description: '悬停查词、保存原句并生成每周本地复习周报。',
    permissions: [
      'storage',
      'alarms',
      'notifications',
      'tts',
      'sidePanel',
      'scripting',
    ],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_title: '打开语境生词本',
    },
  },
});
