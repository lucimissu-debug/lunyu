# 《论语》多维探索 · 静态站点

> 498 章原文 + 34 位登场人物 + 杨伯峻风格白话译文（AI 综合生成版）
> 双端入口：桌面版 + 手机版独立，互不影响。

## 🌐 打开方式

部署完成后，在浏览器访问：

| 入口 | URL（把下面的 USER / REPO 换成你自己的） |
|---|---|
| 📱 **手机版（推荐给朋友 / 移动端看）** | `https://USER.github.io/REPO/lunyu-mvp/lunyu-mvp-mobile.html` |
| 🖥  桌面版 | `https://USER.github.io/REPO/lunyu-mvp/lunyu-mvp.html` |

举个例子：如果你的 GitHub 叫 `zhangsan`，仓库叫 `lunyu-site`，那手机版地址就是：
```
https://zhangsan.github.io/lunyu-site/lunyu-mvp/lunyu-mvp-mobile.html
```

> 💡 小技巧：如果想让访问 `https://USER.github.io/REPO/` 直接进手机版，
> 把 `lunyu-mvp/lunyu-mvp-mobile.html` 复制一份到仓库根目录改名 `index.html` 即可。

## 📁 目录结构

```
lunyu-mvp/
├── .nojekyll                      # GitHub Pages 放行所有静态文件（必须有）
├── 404.html                       # hash 路由兜底 + 首页入口跳转
├── lunyu-mvp.html                 # 桌面版入口
├── lunyu-mvp-mobile.html          # 手机版入口（分享用这个）
└── assets/
    ├── app.css / app-mobile.css   # 桌面 / 手机 样式
    ├── app.js  / app-mobile.js    # 桌面 / 手机 交互逻辑
    ├── data-bundle.js             # 498 章原文 + 34 位人物
    ├── translations_yangbojun.json  # 杨伯峻风格白话译文（498 / 498）
    └── commentaries.json          # 名家解读（占位，校对中）
```

## 🛠  本地调试（可选）

```bash
# 进入仓库根目录
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000/lunyu-mvp/lunyu-mvp-mobile.html
```

⚠️ **不要直接双击 HTML**（`file://` 协议会被浏览器拦截 JSON/JS 读取，表现为白屏 / 乱版）。
