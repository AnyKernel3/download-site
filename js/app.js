/* =========================================================================
 * 文件下载站 · app.js
 * - 列表：同域 data.json（零 API 限流），缺失时回退 GitHub API。
 * - 下载：
 *    · Vercel（有 /api 后端）→ 同源 /api/download?p=&n=，后端加 attachment 头，必下。
 *    · GitHub Pages（无 /api）→ JS Blob（fetch raw → 本地 objectURL）下载。
 * ========================================================================= */

const CONFIG = {
  owner: "",
  repo: "",
  branch: "main",
  folder: "e",
  dataFile: "data.json",
  GITHUB_TOKEN: "", // 可选：GitHub API 回退时提高额度
};

// 是否 Vercel 部署（同源有 /api/download 后端）
function isVercel() {
  const h = location.hostname;
  return /\.vercel\.(app|me|ns)$/.test(h) || h === "localhost";
}

function detectRepo() {
  const m = location.hostname.match(/^(?:www\\.)?([^\\s.]+)\\.github\\.io$/i);
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
const OWNER  = CONFIG.owner || detected.owner;
const REPO   = CONFIG.repo   || detected.repo;
const BRANCH = CONFIG.branch;
const FOLDER = CONFIG.folder;
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FOLDER}?ref=${BRANCH}&recursive=1`;
const VERCEL   = isVercel();

// ---------- DOM ----------
const $repoBadge = document.getElementById("repoBadge");
const $footRepo  = document.getElementById("footRepo");
const $hint      = document.getElementById("hint");
const $status    = document.getElementById("status");
const $list      = document.getElementById("list");
const $search    = document.getElementById("search");
const $refresh   = document.getElementById("refresh");

// ---------- 工具 ----------
function humanSize(n) {
  if (!n) return "—";
  const u = ["B","KB","MB","GB","TB"]; let i=0,s=n;
  while(s>=1024&&i<u.length-1){s/=1024;i++;}
  return s.toFixed(i?1:0)+" "+u[i];
}
function fileIcon(name) {
  const ext = (name.split(".").pop()||"").toLowerCase();
  const map = { pdf:"📄",doc:"📄",docx:"📄",txt:"📄",md:"📝",jpg:"🖼️",jpeg:"🖼️",png:"🖼️",gif:"🖼️",webp:"🖼️",svg:"🖼️",mp3:"🎵",wav:"🎵",flac:"🎵",ogg:"🎵",mp4:"🎬",mov:"🎬",avi:"🎬",mkv:"🎬",webm:"🎬",zip:"🗜️",rar:"🗜️","7z":"🗜️",tar:"🗜️",gz:"🗜️",apk:"📱",exe:"⚙️",dmg:"⚙️",js:"📜",css:"🎨",html:"🌐",json:"🧾",xml:"🧾",yml:"🧾",yaml:"🧾",sh:"⌨️",py:"🐍" };
  return map[ext]||"📦";
}
function setStatus(cls, text) {
  $status.hidden = !text;
  $status.className = "status "+(cls||"");
  $status.textContent = text;
}

// ---------- 下载：同源 /api 优先，回退 JS Blob ----------
async function download(relPath, name, btn) {
  const label = btn ? btn.querySelector('.label') : null;
  const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${FOLDER}/${relPath}`;
  if (label) label.textContent = "⏳ 下载中…";
  if (btn) btn.disabled = true;

  // 1) Vercel：同源 /api/download（后端强制 attachment）
  if (VERCEL) {
    try {
      const api = `/api/download?p=${encodeURIComponent(relPath)}&n=${encodeURIComponent(name)}`;
      const a = document.createElement("a");
      a.href = api;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (label) label.textContent = "✅ 已下载";
      return;
    } catch (_) { /* fallthrough to blob */ }
  }

  // 2) 回退：JS Blob（fetch raw → 本地 objectURL）
  try {
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error("HTTP "+res.status);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(objUrl),5000);
    if (label) label.textContent = "✅ 已下载";
  } catch (e) {
    if (label) label.textContent = "⬇ 下载";
    window.open(rawUrl, "_blank");
    setStatus("err", "JS 下载失败（"+e.message+"），已在新标签页打开 raw，请长按/右键保存。");
    return;
  }
  if (btn) btn.disabled = false;
}

function normalize(items) {
  return items.filter(it => it.name).map(it => ({
    name: it.name, path: it.path||it.name, size: it.size||0, type: it.type==='dir'?'dir':'file'
  }));
}

// ---------- 渲染 ----------
function render(files, sourceLabel) {
  window.__loadedFiles = files; window.__source = sourceLabel;
  $list.innerHTML = "";
  const q = ($search.value||"").trim().toLowerCase();
  const list = files
    .filter(f => !q||f.name.toLowerCase().includes(q)||(f.path||"").toLowerCase().includes(q))
    .sort((a,b)=>(a.name||"").localeCompare(b.name||"",undefined,{numeric:true,sensitivity:"base"}));

  if (!list.length) {
    $list.innerHTML = `<div class="empty"><div style="font-size:40px">${files.length?"🔍":"📭"}</div><p>${files.length?"没有匹配的文件":"「"+FOLDER+"」目录还没有文件"}</p></div>`;
    return;
  }

  list.forEach(f => {
    if (f.type === "dir") return; // 文件夹不放下载按钮
    const relPath = (f.path||f.name).replace(/^\/+/,"");
    const blobUrl = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${FOLDER}/${relPath}`;
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="filetop">
        <div class="ficon">${fileIcon(f.name)}</div>
        <div style="min-width:0">
          <div class="fname"></div>
          <div class="fpath">${FOLDER}/${relPath}</div>
        </div>
      </div>
      <div class="fsize">${humanSize(f.size)} · 文件 · ${fileIcon(f.name)}</div>
      <div class="actions">
        <button class="btn primary dl" data-rel="${relPath}" data-name="${f.name}">
          <span class="label">⬇ 下载</span>
          <span class="raw">${VERCEL?"同源 API":"JS Blob"}</span>
        </button>
        <a class="btn ghost dl" href="${blobUrl}" target="_blank" rel="noopener">
          <span class="label">👁 预览</span>
        </a>
      </div>`;
    card.querySelector(".fname").textContent = f.name;
    card.querySelector("button.dl").addEventListener("click", function(){
      download(this.dataset.rel, this.dataset.name, this);
    });
    $list.appendChild(card);
  });

  $hint.textContent = `共 ${files.length} 个条目 · 来自 ${FOLDER}/ · 数据源：${sourceLabel||"未知"} · 下载：${VERCEL?"同源 /api"":"JS Blob"}`;
}

// ---------- 数据加载 ----------
async function loadFromData() {
  const res = await fetch(CONFIG.dataFile+"?t="+Date.now(),{cache:"no-store"});
  if (!res.ok) throw new Error("data.json HTTP "+res.status);
  const j = await res.json();
  if (!j||!Array.isArray(j.files)) throw new Error("data.json 结构不对");
  return normalize(j.files);
}
async function loadFromApi() {
  const h = { Accept:"application/vnd.github+json" };
  if (CONFIG.GITHUB_TOKEN) h.Authorization = "token "+CONFIG.GITHUB_TOKEN;
  const res = await fetch(API_URL,{headers:h});
  let data=null; try{data=await res.json();}catch(_){}
  if (res.status===404) throw new Error("仓库/目录不存在");
  if (!res.ok) throw new Error("HTTP "+res.status+"（API 限流）");
  if (!Array.isArray(data)) throw new Error("无法解析");
  return normalize(data);
}
async function load() {
  setStatus("","正在加载…");
  $list.innerHTML = `<div class="empty"><div class="spinner"></div><p>正在加载…</p></div>`;
  if ($repoBadge) $repoBadge.textContent = `${OWNER}/${REPO} · ${BRANCH} · ${FOLDER}/ · ${VERCEL?"Vercel":"GitHub Pages"}`;
  if ($footRepo) $footRepo.textContent = `${OWNER}/${REPO}`;
  try {
    const files = await loadFromData();
    setStatus("ok",`已加载 ${files.length} 个条目（data.json）`);
    render(files,"data.json");
  } catch(e1) {
    try {
      const files = await loadFromApi();
      setStatus("ok",`已加载 ${files.length} 个条目（API）`);
      render(files,"GitHub API");
    } catch(e2) {
      setStatus("err","加载失败："+(e1.message||"")+" / API："+(e2.message||""));
    }
  }
}

$search.addEventListener("input",()=>{ if(window.__loadedFiles) render(window.__loadedFiles,window.__source); });
$refresh.addEventListener("click", load);
load();