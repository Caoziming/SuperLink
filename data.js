// 链接数据（分类 + 颜色 + 链接，统一在本文件维护）
// ALL_TAB: 「全部」标签配置（name 标签名 + color 标签色）
// group: 分类名（即标签名，同时作为搜索匹配字段）
// color: 分类颜色（标签彩点 + 分组标题条）
// platform: 'pc' PC端 | 'wechat' 微信H5 | null 不限
// accounts: [{ label, username, password }]

const ALL_TAB = { name: '全部', color: '#6a8dff' };

// 在此添加自己的分组与链接，示例：
// const LINK_GROUPS = [
//   {
//     group: '常用工具',              // 分类名（即标签名，同时作为搜索匹配字段）
//     color: '#4facfe',               // 分类颜色（标签彩点 + 分组标题条）
//     items: [
//       {
//         name: '示例站点',            // 条目名称（必填，最多显示 20 字）
//         platform: 'pc',             // 平台：'pc' PC端 | 'wechat' 微信H5 | null 不显示（可选）
//         url: 'https://example.com/', // 链接地址（必填）
//         note: '备注信息',            // 特殊提示，橙色提示条展示（可选）
//         accounts: [                // 账号密码列表，没有则留空数组 []
//           { label: '账户', username: 'user', password: 'pass' }
//         ]
//       }
//     ]
//   }
// ];
const LINK_GROUPS = [];
