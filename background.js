// 工具栏图标右键菜单：在侧边栏打开 Super Link
// 上下文菜单点击对 chrome.sidePanel.open 的用户手势要求最宽松，作为弹窗按钮的兜底入口
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'open-side-panel',
    title: '在侧边栏打开 Super Link',
    contexts: ['action']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-side-panel' && tab && tab.windowId != null) {
    // tab.windowId 来自事件本身（真实窗口 ID，无异步跳转），Chrome / Edge 通用
    // （与 Edge 官方文档「上下文菜单打开侧边栏」示例一致的调用方式）
    try {
      chrome.sidePanel.open({ windowId: tab.windowId })
        .catch(err => console.warn('sidePanel.open failed:', err));
    } catch (err) {
      console.warn('sidePanel.open threw:', err);
    }
  }
});
