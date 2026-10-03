/* =========================================================================
 * 文件下载站 · app.js
 * 通过 GitHub Contents API 实时读取「e/」目录下的文件，渲染成可下载卡片。
 * 部署在 GitHub Pages 时会自动检测当前 owner/repo；也可用下方 CONFIG 手动指定。
 * ========================================================================= */

// ---------- 可配置项（按需修改） ----------
const CONFIG = {
  owner: "",   // 留空 = 自动检测（部署在 github.io 时）；否则填你的 GitHub 用户名
  repo: "",    // 留空 = 自动检测；否则填仓库名
  branch: "main", // 文件所在分支（Pages 一般用 main 或 master）
  folder: "e", // 要展示/下载的目录
  defaultOwner: "YOUR_USERNAME",
  defaultRepo: "download-site",
};

// 自动检测 owner/repo（当站点部署在 https://<owner>.github.io/<repo>/ 时）
function detectRepo() {
  const host = location.hostname;
  // 形如 myuser.github.io 或 myuser.github.io/myrepo
  const m = host.match(/^(?:www\.)?([^.\s]+)\.github\.io$/i);
  if (m) {
    const owner = m[1];
    // 子域名即仓库？GitHub Pages 用户站点仓库名是 owner.github.io，这里无法直接知道，
    // 退而用 location.pathname 第一段（/repo/...）
    let repo = owner + ".github.io";
    const seg = location.pathname.split("/").filter(Boolean)[0];
    if (seg && seg !== owner.toLowerCase()) repo = seg;
    return { owner, repo };
  }
  // 用户自定义域名部署：直接用默认值
  return { owner: CONFIG.defaultOwner, repo: CONFIG.defaultRepo };
}

const detected = detectRepo();
const OWNER = CONFIG.owner || detected.owner;
const REPO = CONFIG.repo || detected.repo;
const BRANCH = CONFIG.branch;
const FOLDER = CONFIG.folder;

// raw / api 端点
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FOLDER}?ref=${BRANCH}&recursive=1`;
const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${FOLDER}`;

// ---------- DOM ----------
const $repoBadge = document.getElementById("repoBadge");
const $footRepo = document.getElementById("footRepo");
const $hint = document.getElementById("hint");
const $status = document.getElementById("status");
const $list = document.getElementById("list");
const $search = document.getElementById("search");
const $refresh = document.getElementById("refresh");

// ---------- 工具 ----------
function humanSize(n) {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, s = n;
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
  return s.toFixed(i ? 1 : 0) + " " + u[i];
}

function fileIcon(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    pdf: "📄", doc: "📄", docx: "📄", txt: "📄", md: "📝",
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
    mp3: "🎵", wav: "🎵", flac: "🎵", ogg: "🎵",
    mp4: "🎬", mov: "🎬", avi: "🎬", mkv: "🎬", webm: "🎬",
    zip: "🗜️", rar: "🗜️", "7z": "🗜️", tar: "🗜️", gz: "🗜️",
    apk: "📱", exe: "⚙️", dmg: "⚙️",
    js: "📜", css: "🎨", html: "🌐", json: "🧾", xml: "🧾", yml: "🧾", yaml: "🧾",
    sh: "⌨️", py: "🐍",
  };
  return map[ext] || "📦";
}

function setStatus(cls, text) {
  $status.hidden = !text;
  $status.className = "status " + (cls || "");
  $status.textContent = text;
}

// ---------- 渲染 ----------
function render(files) {
  $list.innerHTML = "";
  const q = ($search.value || "").trim().toLowerCase();

  const list = files
    .filter(f => !q || f.name.toLowerCase().includes(q) || (f.path || "").toLowerCase().includes(q))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));

  if (!list.length) {
    $list.innerHTML = `
      <div class="empty">
        <div style="font-size:40px">${files.length ? "🔍" : "📭"}</div>
        <p>${files.length ? "没有匹配的文件" : "「" + FOLDER + "」目录还没有文件"}</p>
        <p style="font-size:13px">在 GitHub 仓库的 <code>${FOLDER}/</code> 目录里放些文件，然后点「刷新」即可。</p>
      </div>`;
    return;
  }

  list.forEach(f => {
    const rawPath = (f.path || FOLDER + "/" + f.name).replace(/^\/+/, "");
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${rawPath}`;
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="filetop">
        <div class="ficon">${fileIcon(f.name)}</div>
        <div style="min-width:0">
          <div class="fname"></div>
          <div class="fpath">${rawPath}</div>
        </div>
      </div>
      <div class="fsize">${humanSize(f.size)} · ${f.type === "dir" ? "文件夹" : "文件"}</div>
      <div class="actions">
        <a class="btn primary dl" href="${rawUrl}" download="${f.name}" target="_blank" rel="noopener">
          <span class="label">⬇ 下载</span>
          <span class="raw">打开 raw</span>
        </a>
        <a class="btn ghost dl" href="https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${rawPath}" target="_blank" rel="noopener">
          <span class="label">👁 预览</span>
        </a>
      </div>`;
    card.querySelector(".fname").textContent = f.name;
    $list.appendChild(card);
  });

  $hint.textContent = `共 ${files.length} 个条目（${list.length} 项显示）· 来自 ${FOLDER}/ 目录`;
}

// ---------- 加载 ----------
async function load() {
  setStatus("", "正在加载 " + FOLDER + " 目录…");
  $list.innerHTML = `<div class="empty"><div class="spinner"></div><p>正在加载…</p></div>`;
  try {
    const res = await fetch(API_URL, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 404) {
      setStatus("err", `仓库或目录不存在：${OWNER}/${REPO} 的 ${FOLDER}/（分支 ${BRANCH}）。请修改 js/app.js 顶部的 CONFIG。`);
      return;
    }
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try { const j = await res.json(); if (j.message) msg += " — " + j.message; } catch (_) {}
      setStatus("err", "加载失败：" + msg + "（匿名访问可能遇到限流，稍后再试）");
      return;
    }
    let data = await res.json();
    // recursive 对目录会返回子项；若返回的是单个目录对象则提示
    if (!Array.isArray(data)) {
      setStatus("err", "未能解析目录内容（该路径可能是单个文件而非目录）。");
      return;
    }
    // 过滤掉目录本身条目，保留文件（也保留子目录名展示）
    const files = data.filter(item => item.type === "file" || item.type === "dir");
    if ($repoBadge) $repoBadge.textContent = `${OWNER}/${REPO} · ${BRANCH} · ${FOLDER}/`;
    if ($footRepo) $footRepo.textContent = `${OWNER}/${REPO}`;
    setStatus("ok", `已加载 ${files.length} 个条目 · 来自 ${FOLDER}/`);
    render(files);
  } catch (e) {
    setStatus("err", "网络错误：" + e.message + "（可能是跨域或网络问题，稍后刷新）");
  }
}

// ---------- 事件 ----------
$search.addEventListener("input", () => {
  // 重新渲染（基于当前已加载文件，保留在内存里）
  if (window.__loadedFiles) render(window.__loadedFiles);
});
$refresh.addEventListener("click", load);

// 缓存已加载文件供搜索用
const _origRender = render;
render = function (files) { window.__loadedFiles = files; _origRender(files); };

load();