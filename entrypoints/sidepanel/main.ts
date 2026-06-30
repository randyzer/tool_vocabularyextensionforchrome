const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root');
}

root.textContent = '语境生词本正在初始化';
