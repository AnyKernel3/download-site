/* =========================================================================
 * 文件下载站 · app.js
 * 主数据源：同域 data.json（不占 GitHub API 额度，不会 403 限流）。
 * 备用：GitHub Contents API（data.json 缺失时自动回退）。
 * 部署在 GitHub Pages 时自动检测 owner/repo；也可在 CONFIG 手动指定。
 * ========================================================================= */

// ---------- 可配置项（按需修改） ----------
const CONFIG = {
  owner: "",      // 留空 = 自动检测；否则填你的 GitHub 用户名
  repo: "",       // 留空 = 自动检测；否则填仓库名
  branch: "main", // 文件所在分支（main 或 master）
  folder: "e",    // 要展示/下载的目录
  dataFile: "data.json", // 主数据文件（与站点同域）
  // 可选：仅用于 API 回退时提高额度。公开仓库请保持只读 token 或留空。
  GITHUB_TOKEN: "",
};

// 自动检测 owner/repo（https://<owner>.github.io/<repo>/）
function detectRepo() {
  const host = location.hostname;
  const m = host.match(/^(?:www\.)?([^\s.]+)\.github\.io$/i);
  if (m) {
    const owner = m[1];
    let repo = owner + ".github.io";
    const seg = location.pathname.split("/").filter(Boolean)[0];
    if (seg && seg !== owner.toLowerCase()) repo = seg;
    return { owner, repo };
  }
  return { owner: "River-af", repo: "download-site" };
}

const detected = detectRepo();
const OWNER = CONFIG.owner || detected.owner;
const REPO = CONFIG.repo || detected.repo;
const BRANCH = CONFIG.branch;
const FOLDER = CONFIG.folder;

const DATA_URL = `${CONFIG.dataFile}`;
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FOLDER}?ref=${BRANCH}&recursive=1`;

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

// 把 e/ 里的文件条目整理成统一结构
function normalize(items) {
  return items
    .filter(it => it.type === "file" || it.type === "dir" || it.name)
    .map(it => ({
      name: it.name,
      path: it.path || FOLDER + "/" + it.name,
      size: it.size || 0,
      type: it.type === "dir" ? "dir" : "file",
    }));
}

// ---------- 渲染 ----------
function render(files, sourceLabel) {
  window.__loadedFiles = files; window.__source = sourceLabel;
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
        <p style="font-size:13px">在仓库 <code>${FOLDER}/</code> 里放些文件后，点「⟳ 刷新」（新文件需同步到 data.json）。</p>
      </div>`;
    return;
  }

  list.forEach(f => {
    const rawPath = (f.path || FOLDER + "/" + f.name).replace(/^\/+/, "");
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${FOLDER}/${rawPath.replace(/^\/+/,'')}`;
    const blobUrl = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${FOLDER}/${rawPath}`;
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="filetop">
        <div class="ficon">${fileIcon(f.name)}</div>
        <div style="min-width:0">
          <div class="fname"></div>
          <div class="fpath">${FOLDER}/${rawPath}</div>
        </div>
      </div>
      <div class="fsize">${humanSize(f.size)} · ${f.type === "dir" ? "文件夹" : "文件"}</div>
      <div class="actions">
        <a class="btn primary dl" href="${rawUrl}" download="${f.name}" target="_blank" rel="noopener">
          <span class="label">⬇ 下载</span>
          <span class="raw">打开 raw</span>
        </a>
        <a class="btn ghost dl" href="${blobUrl}" target="_blank" rel="noopener">
          <span class="label">👁 预览</span>
        </a>
      </div>`;
    card.querySelector(".fname").textContent = f.name;
    $list.appendChild(card);
  });

  $hint.textContent = `共 ${files.length} 个条目（${list.length} 项显示）· 来自 ${FOLDER}/ · 数据源：${sourceLabel || "未知"}`;
}

// ---------- 数据加载（先本地 data.json，再回退 API） ----------
async function loadFromData() {
  const res = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("data.json HTTP " + res.status);
  const j = await res.json();
  if (!j || !Array.isArray(j.files)) throw new Error("data.json 结构不对");
  return normalize(j.files);
}

async function loadFromApi() {
  const headers = { Accept: "application/vnd.github+json" };
  if (CONFIG.GITHUB_TOKEN) headers.Authorization = "token " + CONFIG.GITHUB_TOKEN;
  const res = await fetch(API_URL, { headers });
  let msg = "HTTP " + res.status;
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (res.status === 404) throw new Error("仓库/目录不存在（" + msg + "）");
  if (!res.ok) throw new Error(msg + "（API 限流或出错）");
  if (!Array.isArray(data)) throw new Error("无法解析目录");
  return normalize(data);
}

async function load() {
  setStatus("", "正在加载 " + FOLDER + " 目录…");
  $list.innerHTML = `<div class="empty"><div class="spinner"></div><p>正在加载…</p></div>`;
  if ($repoBadge) $repoBadge.textContent = `${OWNER}/${REPO} · ${BRANCH} · ${FOLDER}/`;
  if ($footRepo) $footRepo.textContent = `${OWNER}/${REPO}`;

  try {
    const files = await loadFromData();
    setStatus("ok", `已加载 ${files.length} 个条目（本地 data.json）`);
    render(files, "data.json");
  } catch (e1) {
    // data.json 不可用 → 回退到 API
    try {
      const files = await loadFromApi();
      setStatus("ok", `已加载 ${files.length} 个条目（GitHub API）`);
      render(files, "GitHub API");
    } catch (e2) {
      const detail = e1 && e1.message ? e1.message : "data.json 缺失";
      setStatus("err", "未能加载：" + detail + "。API 回退也失败：" + (e2 && e2.message ? e2.message : "未知") + "。");
    }
  }
}

// ---------- 事件 ----------
$search.addEventListener("input", () => {
  if (window.__loadedFiles) render(window.__loadedFiles, window.__source);
});
$refresh.addEventListener("click", load);

load();