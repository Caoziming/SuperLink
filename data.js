// 链接数据（分类 + 颜色 + 链接，统一在本文件维护）
// ALL_TAB: 「全部」标签配置（name 标签名 + color 标签色）
// group: 分类名（即标签名，同时作为搜索匹配字段）
// color: 分类颜色（标签彩点 + 分组标题条）
// platform: 'pc' PC端 | 'wechat' 微信H5 | null 不限
// accounts: [{ label, username, password }]

const ALL_TAB = { name: '全部', color: '#6a8dff' };

const LINK_GROUPS = [
  {
    group: '默认分组',
    color: '#6a8dff',
    items: [
      // 在此添加自己的链接，示例：
      // {
      //   name: '示例站点',
      //   platform: 'pc',
      //   url: 'https://example.com/',
      //   note: '备注（可选）',
      //   accounts: [{ label: '账户', username: 'user', password: 'pass' }]
      // }
    ]
  }
];
