// 启动模式配置：sidepanel（默认，点击图标直接开侧边栏）| popup（弹窗）| window（独立窗口，默认 800px 宽并记住上次尺寸）
// 配置存 chrome.storage.local（页面与 Service Worker 共享），变更即时重新应用
const OPEN_MODE_KEY = 'superLinkOpenMode';
const WIN_SIZE_KEY = 'superLinkWinSize';

async function readOpenMode() {
  try {
    const got = await chrome.storage.local.get(OPEN_MODE_KEY);
    const v = got[OPEN_MODE_KEY];
    return (v === 'popup' || v === 'window') ? v : 'sidepanel';
  } catch (err) {
    console.warn('read open mode failed:', err);
    return 'sidepanel';
  }
}

async function applyOpenMode() {
  const mode = await readOpenMode();
  try {
    // 侧边栏模式需清空 popup（否则弹窗优先）；弹窗/独立窗口模式恢复 popup 行为差异见下
    await chrome.action.setPopup({ popup: mode === 'popup' ? 'popup.html' : '' });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: mode === 'sidepanel' });
  } catch (err) {
    console.warn('apply open mode failed:', err);
  }
}

// 独立窗口模式：点击图标打开自由浮窗（默认 800×800，沿用上次记录的尺寸）
// 侧边栏模式由 openPanelOnActionClick 处理、弹窗模式有 default_popup，均不会进入本事件
chrome.action.onClicked.addListener(async () => {
  if ((await readOpenMode()) !== 'window') return;
  let width = 800, height = 800;
  try {
    const got = await chrome.storage.local.get(WIN_SIZE_KEY);
    const size = got[WIN_SIZE_KEY];
    if (size && size.w >= 400 && size.h >= 400) {
      width = size.w;
      height = size.h;
    }
  } catch (err) {
    console.warn('read window size failed:', err);
  }
  chrome.windows.create({
    url: chrome.runtime.getURL('sidepanel.html'),
    type: 'popup',
    width,
    height
  });
});

// Service Worker 随时可能被唤醒回收，顶层调用保证每次唤醒都重新应用
applyOpenMode();
chrome.runtime.onStartup.addListener(applyOpenMode);

// 页面里改配置后立即生效
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[OPEN_MODE_KEY]) applyOpenMode();
});

// 工具栏图标右键菜单：在侧边栏打开 Super Link（不受启动模式影响的手动入口）
// 上下文菜单点击对 chrome.sidePanel.open 的用户手势要求最宽松，作为兜底入口
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
