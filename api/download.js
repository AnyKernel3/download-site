// Vercel Serverless Function — same-origin download proxy
// GET /api/download?p=hello.txt&n=hello.txt
// 服务端拉取 GitHub raw 文件，加 Content-Disposition: attachment 后返回，
// 浏览器识别为同源下载，100% 直接存文件，不再跨域失效。

const OWNER = "River-af";
const REPO  = "download-site";
const BRANCH = "main";
const FOLDER = "e";

export default async function handler(req, res) {
  const { p, n } = req.query;
  if (!p || !n) {
    res.status(400).json({ error: "缺少参数 p（路径）或 n（文件名）" });
    return;
  }

  // 安全：路径只允许 e/ 目录内，禁止 .. 等
  const safePath = String(p).replace(/\.\./g, "").replace(/^\//, "");
  const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${FOLDER}/${safePath}`;

  try {
    const upstream = await fetch(rawUrl);
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `GitHub raw 返回 ${upstream.status}` });
      return;
    }

    const buf = await upstream.arrayBuffer();
    const ct  = upstream.headers.get("content-type") || "application/octet-stream";
    const cl  = upstream.headers.get("content-length") || String(buf.byteLength);

    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Length", cl);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(n)}"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(Buffer.from(buf));
  } catch (e) {
    res.status(502).json({ error: "代理失败: " + e.message });
  }
}
