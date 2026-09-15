// 平台徽章
const PLATFORM_MAP = { pc: 'PC', wechat: '微信H5' };

// 分组类型图标：书签分组 = 文件夹，内置分组（data.js）= 链环，「全部」= 书签
const FOLDER_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const LINK_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const BOOKMARK_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

// 侧边栏模式（sidepanel.html 与 popup.html 共用本脚本）
const IS_SIDEPANEL = document.body.classList.contains('mode-sidepanel');
// Edge 浏览器（UA 含 Edg/），用于历史页地址、openPopup 提示等浏览器差异处理
const IS_EDGE = /Edg\//.test(navigator.userAgent);

// 分类名与颜色均来自 data.js（ALL_TAB / LINK_GROUPS），书签分组颜色见下方书签模块
// 取分类颜色：优先内置分组 color，其次书签分组 color，未命中回退「全部」标签色
function groupColor(name) {
  return (LINK_GROUPS.find(g => g.group === name) || {}).color
    || (bookmarkGroups.find(g => g.group === name) || {}).color
    || ALL_TAB.color;
}

// 当前可见分组：内置分组 + （开关开启时的）浏览器书签分组
function visibleGroups() {
  return state.showBookmarks ? [...LINK_GROUPS, ...bookmarkGroups] : LINK_GROUPS;
}

// 状态：当前标签 + 搜索关键字 + 书签开关 + 分组图标开关 + 标签折叠
const state = { tab: ALL_TAB.name, keyword: '', showBookmarks: false, tabsCollapsed: false, showGroupIcons: true };

// ---------- 工具函数 ----------

// 从 URL 提取简短显示（域名 + 路径）
function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.host + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 单个条目是否命中搜索词（支持空格分隔多词 AND 模糊匹配）
function matchItem(item, groupName, words) {
  const haystack = [
    item.name,
    item.url,
    shortUrl(item.url),
    item.note || '',
    groupName,
    PLATFORM_MAP[item.platform] || '',
    ...(item.accounts || []).flatMap(a => [a.label || '', a.username, a.password])
  ].join(' ').toLowerCase();

  return words.every(w => haystack.includes(w));
}

// ---------- 浏览器书签 ----------

const BOOKMARKS_KEY = 'superLinkShowBookmarks';
let bookmarkGroups = [];

// 书签分组配色：按分组名散列取色，同名同色、每次打开不变
const BOOKMARK_PALETTE = ['#8b5cf6', '#f97316', '#0ea5e9', '#84cc16', '#e11d48', '#14b8a6', '#d946ef', '#f59e0b'];
function bookmarkColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BOOKMARK_PALETTE[h % BOOKMARK_PALETTE.length];
}

// 遍历书签树：文件夹 → 分组，文件夹内书签 → 条目
// 嵌套文件夹以「父/子」路径命名（如 书签栏/工作/后台），因此不会与内置分组重名冲突
function walkBookmarkFolder(node, path, groups) {
  const children = node.children || [];
  const links = children.filter(c => c.url);
  const name = [...path, node.title].join('/').trim();

  if (links.length > 0 && name) {
    groups.push({
      group: name,
      color: bookmarkColor(name),
      isBookmark: true,
      items: links.map(b => ({
        name: b.title || shortUrl(b.url),
        url: b.url,
        platform: null,
        accounts: []
      }))
    });
  }
  children.filter(c => !c.url).forEach(f => walkBookmarkFolder(f, [...path, node.title], groups));
}

function loadBookmarks() {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.bookmarks || !chrome.bookmarks.getTree) return resolve([]);
    chrome.bookmarks.getTree(nodes => {
      const groups = [];
      (nodes[0].children || []).forEach(root => walkBookmarkFolder(root, [], groups));
      resolve(groups);
    });
  });
}

// ---------- 标签栏 ----------

function renderTabs() {
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = '';

  const groups = visibleGroups();
  const tabs = [ALL_TAB.name, ...groups.map(g => g.group)];
  tabs.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (state.tab === name && !state.keyword ? ' active' : '');
    btn.style.setProperty('--tab-color', groupColor(name));

    const count = name === ALL_TAB.name
      ? groups.reduce((n, g) => n + g.items.length, 0)
      : groups.find(g => g.group === name).items.length;

    // 分组图标开启时用类型图标（书签/文件夹/链环）代替彩点
    const lead = document.createElement('span');
    const typeIcon = state.showGroupIcons
      ? (name === ALL_TAB.name ? BOOKMARK_ICON : groupTypeIcon(name))
      : null;
    if (typeIcon) {
      lead.className = 'tab-ic';
      lead.innerHTML = typeIcon;
    } else {
      lead.className = 'tab-dot';
    }
    const label = document.createElement('span');
    label.textContent = name;
    const cnt = document.createElement('span');
    cnt.className = 'tab-count';
    cnt.textContent = count;

    btn.append(lead, label, cnt);
    btn.addEventListener('click', () => {
      state.tab = name;
      document.getElementById('searchInput').value = '';
      state.keyword = '';
      document.getElementById('clearBtn').hidden = true;
      backToTopQuietly();
      renderTabs();
      render();
    });
    tabsEl.appendChild(btn);
  });

  // 标签集变化后同步折叠状态与折叠按钮可见性
  applyTabsCollapse();
}

// 按分组名取类型图标：书签分组 → 文件夹；内置分组 → 链环；未命中（如「全部」）→ null
function groupTypeIcon(name) {
  const g = visibleGroups().find(gr => gr.group === name);
  return g ? (g.isBookmark ? FOLDER_ICON : LINK_ICON) : null;
}

// ---------- 渲染 ----------

function render() {
  const container = document.getElementById('groups');
  const resultBar = document.getElementById('resultBar');
  container.innerHTML = '';

  const words = state.keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);

  let groupsToShow;
  if (words.length > 0) {
    // 搜索模式：全局模糊匹配
    groupsToShow = visibleGroups()
      .map(g => ({ ...g, items: g.items.filter(item => matchItem(item, g.group, words)) }))
      .filter(g => g.items.length > 0);
    resultBar.hidden = false;
    resultBar.innerHTML = `找到 <span class="kw">${escapeHtml(state.keyword.trim())}</span> · 共 ${groupsToShow.reduce((n, g) => n + g.items.length, 0)} 条`;
  } else {
    // 标签模式（空分组不渲染，避免出现只有标题没有条目的区块）
    resultBar.hidden = true;
    groupsToShow = visibleGroups()
      .filter(g => (state.tab === ALL_TAB.name || g.group === state.tab) && g.items.length > 0);
  }

  if (groupsToShow.length === 0) {
    container.innerHTML = words.length > 0
      ? '<div class="empty"><span class="empty-icon">🔍</span>没有匹配的链接</div>'
      : '<div class="empty"><span class="empty-icon">🔗</span>暂无链接：可点击右上角「书签」按钮显示浏览器书签，或在 data.js 中添加自己的链接</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  groupsToShow.forEach(({ group, items, isBookmark }) => {
    const sec = document.createElement('section');
    sec.className = 'group';
    sec.style.setProperty('--group-color', groupColor(group));

    const title = document.createElement('div');
    title.className = 'group-title';
    const leadIcon = state.showGroupIcons
      ? `<span class="g-ic">${isBookmark ? FOLDER_ICON : LINK_ICON}</span>`
      : '';
    title.innerHTML = `${leadIcon}${escapeHtml(group)}<span class="group-count">${items.length}</span>`;
    sec.appendChild(title);

    items.forEach(item => sec.appendChild(renderItem(item)));
    frag.appendChild(sec);
  });
  container.appendChild(frag);
}

function renderItem(item) {
  const el = document.createElement('div');
  const isWechat = item.platform === 'wechat';
  el.className = 'item' + (isWechat ? ' item--wechat' : '');

  // 顶部：站点图标 + 名称 + 徽章
  const top = document.createElement('div');
  top.className = 'item-top';

  // 站点图标：优先读浏览器 favicon 缓存（_favicon），未命中则回退请求站点自身 favicon，均失败不占位
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    let origin = '';
    try { origin = new URL(item.url).origin; } catch { /* 非法 URL 不展示图标 */ }
    if (origin) {
      const favicon = document.createElement('img');
      favicon.className = 'item-favicon';
      favicon.alt = '';
      favicon.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(item.url)}&size=32`;
      favicon.addEventListener('error', () => {
        if (!favicon.dataset.fb) {
          favicon.dataset.fb = '1';
          favicon.src = origin + '/favicon.ico';
        } else {
          favicon.remove();
        }
      });
      top.appendChild(favicon);
    }
  }

  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = item.name;
  top.appendChild(name);

  if (item.platform && PLATFORM_MAP[item.platform]) {
    const pfBadge = document.createElement('span');
    pfBadge.className = `badge badge--${item.platform}`;
    pfBadge.textContent = PLATFORM_MAP[item.platform];
    top.appendChild(pfBadge);
  }

  el.appendChild(top);

  // 右上角复制链接按钮（所有条目，不限于微信 H5）
  const copyBtn = document.createElement('button');
  copyBtn.className = 'item-copy';
  copyBtn.title = '复制链接';
  copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  copyBtn.addEventListener('click', e => {
    e.stopPropagation();
    copyText(item.url, copyBtn, '✓ 复制成功');
  });
  el.appendChild(copyBtn);

  // URL（白色）
  const urlEl = document.createElement('div');
  urlEl.className = 'item-url';
  urlEl.textContent = shortUrl(item.url);
  urlEl.title = item.url;
  el.appendChild(urlEl);

  // 备注
  if (item.note) {
    const note = document.createElement('div');
    note.className = 'item-note';
    note.textContent = '⚠ ' + item.note;
    el.appendChild(note);
  }

  // 账号密码
  if (item.accounts && item.accounts.length > 0) {
    const box = document.createElement('div');
    box.className = 'accounts';
    item.accounts.forEach(acc => {
      const row = document.createElement('div');
      row.className = 'account';

      const label = document.createElement('span');
      label.className = 'account-label';
      label.textContent = acc.label || '账户';
      row.appendChild(label);

      const userChip = document.createElement('button');
      userChip.className = 'chip';
      userChip.textContent = acc.username;
      userChip.title = `账号：${acc.username}（点击复制）`;
      userChip.addEventListener('click', e => {
        e.stopPropagation();
        copyText(acc.username, userChip, `已复制账号：${acc.username}`);
      });
      row.appendChild(userChip);

      const pwdChip = document.createElement('button');
      pwdChip.className = 'chip chip--pwd';
      pwdChip.textContent = '••••••';
      pwdChip.title = `密码：${acc.password}（点击复制）`;
      pwdChip.addEventListener('click', e => {
        e.stopPropagation();
        copyText(acc.password, pwdChip, `已复制密码：${acc.password}`);
      });
      row.appendChild(pwdChip);

      box.appendChild(row);
    });
    el.appendChild(box);
  }

  // 点击交互：
  // 微信H5 条目 → 复制链接（用于在微信环境打开）
  // 其他条目 → 新标签页打开
  el.addEventListener('click', () => {
    if (isWechat) {
      copyText(item.url, null, '链接已复制，请在微信中打开');
    } else {
      openUrl(item.url);
    }
  });

  return el;
}

// ---------- 交互 ----------

function openUrl(url) {
  chrome.tabs.create({ url, active: true });
  // 侧边栏模式保持常驻；弹窗模式打开链接后自动关闭
  if (!IS_SIDEPANEL) window.close();
}

async function copyText(text, chipEl, toastMsg) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
  }

  if (ok) {
    showToast(toastMsg || `已复制：${text}`);
    if (chipEl) {
      chipEl.classList.add('copied');
      // 有文字的 chip（账号/密码）短暂替换为「✓ 已复制」，纯图标按钮只做高亮
      if (chipEl.textContent.trim()) {
        const original = chipEl.textContent;
        chipEl.textContent = '✓ 已复制';
        setTimeout(() => { chipEl.textContent = original; }, 1000);
      }
      setTimeout(() => { chipEl.classList.remove('copied'); }, 1000);
    }
  } else {
    showToast('复制失败，请手动复制');
  }
}

let toastTimer = null;
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
}

// ---------- 搜索框绑定 ----------

const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');

searchInput.addEventListener('input', () => {
  state.keyword = searchInput.value;
  clearBtn.hidden = !searchInput.value;
  renderTabs();
  render();
});

// Escape 清空搜索
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    state.keyword = '';
    clearBtn.hidden = true;
    backToTopQuietly();
    renderTabs();
    render();
  }
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  state.keyword = '';
  clearBtn.hidden = true;
  searchInput.focus();
  backToTopQuietly();
  renderTabs();
  render();
});

// ---------- 底部置顶按钮 ----------

const backTopBtn = document.getElementById('backTop');

// 页面滚动超过一屏的三分之一时显示按钮，回到顶部附近隐藏
window.addEventListener('scroll', () => {
  backTopBtn.classList.toggle('show', window.scrollY > window.innerHeight / 3);
}, { passive: true });

// 一键平滑回到顶部
backTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// 切换标签 / 清空搜索后回到顶部并隐藏按钮
function backToTopQuietly() {
  window.scrollTo({ top: 0 });
  backTopBtn.classList.remove('show');
}

// ---------- 主题色自定义 ----------

const THEME_KEY = 'superLinkTheme';
const DEFAULT_THEME = '#3370ff';
const PRESET_THEMES = [
  { name: '静谧蓝', color: '#3370ff' },
  { name: '梦幻紫', color: '#7c5cff' },
  { name: '翡翠绿', color: '#10b981' },
  { name: '青碧色', color: '#06b6d4' },
  { name: '活力橙', color: '#f97316' },
  { name: '玫瑰粉', color: '#ec4899' },
  { name: '石榴红', color: '#ef4444' },
  { name: '石墨灰', color: '#5b6472' }
];

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const v = m.length === 3
    ? m.split('').map(c => c + c).join('')
    : m;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16)
  };
}

// 两个颜色按权重混合（w 为 color1 占比），用于派生浅色边框
function mixHex(color1, color2, w) {
  const a = hexToRgb(color1);
  const b = hexToRgb(color2);
  const mix = k => Math.round(a[k] * w + b[k] * (1 - w));
  const toHex = n => n.toString(16).padStart(2, '0');
  return '#' + toHex(mix('r')) + toHex(mix('g')) + toHex(mix('b'));
}

let currentTheme = DEFAULT_THEME;

function applyTheme(color, save = true) {
  const { r, g, b } = hexToRgb(color);
  const root = document.documentElement.style;
  root.setProperty('--accent', color);
  root.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  root.setProperty('--link', color);
  // 悬浮边框色的混合基色随显示模式变化（浅色亮基 / 深色暗基）
  root.setProperty('--border-hover', mixHex(color, isDarkMode() ? '#2e3138' : '#e6e8ec', 0.35));

  currentTheme = color;
  if (save) {
    try { localStorage.setItem(THEME_KEY, color); } catch { /* 忽略存储异常 */ }
  }

  // 同步面板显示状态
  document.getElementById('themeCurrent').textContent = color;
  document.getElementById('themeColorInput').value = color;
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === color);
  });
}

function renderSwatches() {
  const box = document.getElementById('themeSwatches');
  PRESET_THEMES.forEach(({ name, color }) => {
    const s = document.createElement('button');
    s.className = 'swatch';
    s.style.background = color;
    s.style.setProperty('--swatch-color', color);
    s.dataset.color = color;
    s.title = `${name} ${color}`;
    s.addEventListener('click', () => applyTheme(color));
    box.appendChild(s);
  });
}

const themePanel = document.getElementById('themePanel');
const themeBtn = document.getElementById('themeBtn');

themeBtn.addEventListener('click', e => {
  e.stopPropagation();
  themePanel.hidden = !themePanel.hidden;
});

themePanel.addEventListener('click', e => e.stopPropagation());

// 点击面板外任意位置关闭
document.addEventListener('click', () => {
  if (!themePanel.hidden) themePanel.hidden = true;
  if (colsPanel && !colsPanel.hidden) colsPanel.hidden = true;
});

// 自定义取色器：拖动实时预览，确认后自动保存
document.getElementById('themeColorInput').addEventListener('input', e => {
  applyTheme(e.target.value);
});

document.getElementById('themeReset').addEventListener('click', () => {
  applyTheme(DEFAULT_THEME);
});

function initTheme() {
  renderSwatches();
  let saved = DEFAULT_THEME;
  try { saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME; } catch { /* 忽略存储异常 */ }
  applyTheme(saved, false);
}

// ---------- 深浅色模式（跟随系统 / 白天 / 夜晚） ----------

const MODE_KEY = 'superLinkMode';
const DARK_MQ = window.matchMedia('(prefers-color-scheme: dark)');
let colorMode = 'auto'; // 'auto' | 'light' | 'dark'

function isDarkMode() {
  return document.documentElement.dataset.theme === 'dark';
}

// auto 模式下解析系统偏好，light / dark 直接采用
function resolvedMode() {
  return colorMode === 'auto' ? (DARK_MQ.matches ? 'dark' : 'light') : colorMode;
}

function applyMode(save = true) {
  document.documentElement.dataset.theme = resolvedMode();
  if (save) {
    try { localStorage.setItem(MODE_KEY, colorMode); } catch { /* 忽略存储异常 */ }
  }
  // 悬浮边框色依赖模式基色，切换后重新派生（不重复写存储）
  applyTheme(currentTheme, false);
  document.querySelectorAll('.seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === colorMode);
  });
}

// 跟随系统时，系统深浅色变化实时生效
DARK_MQ.addEventListener('change', () => {
  if (colorMode === 'auto') applyMode(false);
});

document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    colorMode = btn.dataset.mode;
    applyMode();
  });
});

function initMode() {
  let saved = 'auto';
  try { saved = localStorage.getItem(MODE_KEY) || 'auto'; } catch { /* 忽略存储异常 */ }
  colorMode = ['auto', 'light', 'dark'].includes(saved) ? saved : 'auto';
  applyMode(false);
}

// ---------- 浏览器书签开关 ----------

const bmBtn = document.getElementById('bmBtn');

function applyBookmarkToggle() {
  bmBtn.classList.toggle('on', state.showBookmarks);
  bmBtn.title = state.showBookmarks ? '隐藏浏览器书签' : '显示浏览器书签';
}

bmBtn.addEventListener('click', () => {
  state.showBookmarks = !state.showBookmarks;
  try { localStorage.setItem(BOOKMARKS_KEY, state.showBookmarks ? '1' : '0'); } catch { /* 忽略存储异常 */ }

  // 关闭开关后当前标签已不存在（如停留在书签标签）时，回到「全部」
  if (!visibleGroups().some(g => g.group === state.tab)) {
    state.tab = ALL_TAB.name;
  }
  applyBookmarkToggle();
  renderTabs();
  render();
});

function initBookmarks() {
  try { state.showBookmarks = localStorage.getItem(BOOKMARKS_KEY) === '1'; } catch { /* 忽略存储异常 */ }
  applyBookmarkToggle();
  // 异步读取书签树，完成后若开关开启则刷新展示
  loadBookmarks().then(groups => {
    bookmarkGroups = groups;
    if (state.showBookmarks) {
      renderTabs();
      render();
    }
  });
}

// ---------- 分组图标开关 ----------

const GROUP_ICONS_KEY = 'superLinkGroupIcons';
const giBtn = document.getElementById('groupIconBtn');

function applyGroupIconToggle() {
  giBtn.classList.toggle('on', state.showGroupIcons);
  giBtn.title = state.showGroupIcons ? '隐藏分组图标' : '显示分组图标';
}

giBtn.addEventListener('click', () => {
  state.showGroupIcons = !state.showGroupIcons;
  try { localStorage.setItem(GROUP_ICONS_KEY, state.showGroupIcons ? '1' : '0'); } catch { /* 忽略存储异常 */ }
  applyGroupIconToggle();
  renderTabs();
  render();
});

function initGroupIcons() {
  try { state.showGroupIcons = localStorage.getItem(GROUP_ICONS_KEY) !== '0'; } catch { /* 忽略存储异常 */ }
  applyGroupIconToggle();
}

// ---------- 列表列数（仅侧边栏模式，popup.html 无此控件） ----------

const COLS_KEY = 'superLinkCols';
const colsBtn = document.getElementById('colsBtn');
const colsPanel = document.getElementById('colsPanel');

function applyCols(cols) {
  document.body.classList.remove('cols-1', 'cols-2', 'cols-3');
  document.body.classList.add(`cols-${cols}`);
  document.querySelectorAll('.col-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.cols) === cols);
  });
}

function initCols() {
  let cols = 1;
  try { cols = Number(localStorage.getItem(COLS_KEY)) || 1; } catch { /* 忽略存储异常 */ }
  if (![1, 2, 3].includes(cols)) cols = 1;
  applyCols(cols);
}

if (colsBtn) {
  colsBtn.addEventListener('click', e => {
    e.stopPropagation();
    colsPanel.hidden = !colsPanel.hidden;
  });

  colsPanel.addEventListener('click', e => e.stopPropagation());

  document.querySelectorAll('.col-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cols = Number(btn.dataset.cols);
      try { localStorage.setItem(COLS_KEY, String(cols)); } catch { /* 忽略存储异常 */ }
      applyCols(cols);
    });
  });
}

// ---------- 标签折叠 / 帮助 ----------

const TABS_COLLAPSED_KEY = 'superLinkTabsCollapsed';
const tabsToggleBtn = document.getElementById('tabsToggle');
const tabsToggleLabel = document.getElementById('tabsToggleLabel');

// 单行标签的最大高度，超出即视为多行
const TABS_ROW_HEIGHT = 30;

function applyTabsCollapse() {
  const tabsEl = document.getElementById('tabs');
  tabsEl.classList.toggle('collapsed', state.tabsCollapsed);
  tabsToggleBtn.classList.toggle('expanded', !state.tabsCollapsed);

  // 收起时统计被隐藏的标签数（超出第一行的），显示在按钮上
  let hidden = 0;
  if (state.tabsCollapsed) {
    const firstRowTop = tabsEl.children[0] ? tabsEl.children[0].offsetTop : 0;
    hidden = [...tabsEl.children].filter(b => b.offsetTop > firstRowTop + 5).length;
  }
  tabsToggleLabel.textContent = state.tabsCollapsed ? `展开 +${hidden}` : '收起';

  // 标签只有一行时无需折叠，隐藏按钮
  tabsToggleBtn.hidden = tabsEl.scrollHeight <= TABS_ROW_HEIGHT;
}

// 平滑高度过渡：先固定当前高度为起点，再切换到目标高度触发 transition
function animateTabsTo(targetPx) {
  const tabsEl = document.getElementById('tabs');
  tabsEl.style.maxHeight = tabsEl.scrollHeight + 'px';
  void tabsEl.offsetHeight; // 强制回流，锁定动画起点
  tabsEl.style.maxHeight = targetPx + 'px';
  const done = e => {
    if (e.propertyName !== 'max-height') return;
    tabsEl.removeEventListener('transitionend', done);
    tabsEl.style.maxHeight = ''; // 交还给 collapsed class / 自然高度
  };
  tabsEl.addEventListener('transitionend', done);
}

tabsToggleBtn.addEventListener('click', () => {
  state.tabsCollapsed = !state.tabsCollapsed;
  try { localStorage.setItem(TABS_COLLAPSED_KEY, state.tabsCollapsed ? '1' : '0'); } catch { /* 忽略存储异常 */ }
  const tabsEl = document.getElementById('tabs');
  animateTabsTo(state.tabsCollapsed ? TABS_ROW_HEIGHT - 2 : tabsEl.scrollHeight);
  applyTabsCollapse();
});

function initTabsCollapse() {
  try { state.tabsCollapsed = localStorage.getItem(TABS_COLLAPSED_KEY) === '1'; } catch { /* 忽略存储异常 */ }
}

// 帮助说明：新标签页打开 help.html
document.getElementById('helpBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
  if (!IS_SIDEPANEL) window.close();
});

// 打开浏览器历史记录页（Chrome/Edge 地址不同，按 UA 自动选择）
document.getElementById('historyBtn').addEventListener('click', () => {
  const historyUrl = IS_EDGE ? 'edge://history/' : 'chrome://history/';
  chrome.tabs.create({ url: historyUrl });
  if (!IS_SIDEPANEL) window.close();
});

// 弹窗模式：切换到侧边栏常驻模式（sidepanel.html 中无此按钮）
const sidePanelBtn = document.getElementById('sidePanelBtn');
if (sidePanelBtn) {
  sidePanelBtn.addEventListener('click', () => {
    if (typeof chrome === 'undefined' || !chrome.sidePanel) {
      showToast('当前浏览器不支持侧边栏 API（需 Chrome/Edge 116+）');
      return;
    }
    const fail = err => {
      const msg = (err && err.message) || String(err);
      console.warn('sidePanel.open failed:', err);
      showToast(`侧边栏打开失败：${msg}；可右键工具栏图标打开`);
    };
    // 统一把「同步抛错」转成被拒 Promise，避免中断点击处理器（Edge 对不支持的
    // windowId 可能同步 throw 而非 reject）
    const safeOpen = opts => {
      try {
        return Promise.resolve(chrome.sidePanel.open(opts));
      } catch (err) {
        return Promise.reject(err);
      }
    };
    const closePopup = () => window.close();

    // 主路径：手势内同步调用（Chrome 支持 WINDOW_ID_CURRENT 常量）
    const constWid = chrome.windows && chrome.windows.WINDOW_ID_CURRENT != null
      ? chrome.windows.WINDOW_ID_CURRENT
      : -2;
    safeOpen({ windowId: constWid })
      .then(closePopup)
      .catch(() => {
        // Edge 兜底：改用真实窗口 ID 重试（Promise 链保留用户激活状态）
        if (!chrome.windows || !chrome.windows.getCurrent) { fail('no chrome.windows'); return; }
        chrome.windows.getCurrent()
          .then(win => safeOpen({ windowId: win.id }))
          .then(closePopup)
          .catch(fail);
      });
  });
}

// 侧边栏模式：切换回弹窗模式（popup.html 中无此按钮）
// 注：浏览器未提供关闭侧边栏的 API，切换后侧边栏保持打开，需手动收起
const popupBtn = document.getElementById('popupBtn');
if (popupBtn) {
  // Edge 对 action.openPopup 可能仍保留旧限制（Chrome 127 起才对所有扩展开放）
  popupBtn.addEventListener('click', () => {
    if (typeof chrome === 'undefined' || !chrome.action || !chrome.action.openPopup) {
      showToast(IS_EDGE
        ? 'Edge 暂不支持自动打开弹窗，请点击工具栏图标打开'
        : '当前浏览器不支持，请点击工具栏图标打开弹窗');
      return;
    }
    // 同步 throw 防护（与侧边栏打开逻辑一致）
    const safeOpen = () => {
      try {
        return Promise.resolve(chrome.action.openPopup());
      } catch (err) {
        return Promise.reject(err);
      }
    };
    safeOpen()
      .catch(err => {
        const msg = (err && err.message) || String(err);
        console.warn('action.openPopup failed:', err);
        showToast(`打开弹窗失败：${msg}${IS_EDGE ? '（Edge 可能不支持此 API，请点击工具栏图标）' : '；请点击工具栏图标'}`);
      });
  });
}

// ---------- 初始化 ----------

initMode();
initTheme();
initBookmarks();
initGroupIcons();
initCols();
initTabsCollapse();
renderTabs();
render();
