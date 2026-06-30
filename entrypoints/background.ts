export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info('Context Vocabulary installed');
  });
});
