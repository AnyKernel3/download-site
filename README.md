# 文件下载站（e/ 目录）

一个纯静态网页，部署在 GitHub Pages 后，会**实时**列出本仓库 `e/` 目录里的文件，并提供「下载 / 预览」。

## 结构
```
index.html        页面入口
css/style.css     样式
js/app.js         通过 GitHub Contents API 读取 e/ 目录并渲染
e/                你放下载文件的目录（网页自动展示这里的内容）
```

## 使用
1. 把你想提供的文件放进 `e/` 目录（可建子文件夹）。
2. 刷新网页，文件会自动出现并可直接下载。

## 配置
`js/app.js` 顶部的 `CONFIG`：
- `owner` / `repo`：留空则自动检测（部署在 `https://<owner>.github.io/<repo>/`）。否则手动填写。
- `branch`：默认 `main`，若你用 `master` 请改。
- `folder`：默认 `e`。

## 部署 GitHub Pages
仓库 → Settings → Pages → Source 选 `main` 分支 / 根目录（`/`）。访问：
`https://<owner>.github.io/<repo>/`

> 说明：网页用的是浏览器端 GitHub Contents API（匿名限流约 60 次/小时/IP）。放文件后点「刷新」即可。若需更高额度，可在 `app.js` 里加一个 `GITHUB_TOKEN` 常量并在 fetch 的 `Authorization` 头带上它。
