# OTA Manager

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Version](https://img.shields.io/badge/Version-37.0-green.svg)
![Platform](https://img.shields.io/badge/Platform-Cloudflare_Workers-orange.svg)
![Storage](https://img.shields.io/badge/Storage-Cloudflare_R2-yellow.svg)

**OTA Manager** là hệ thống quản lý và phân phối tệp tin IPA chuyên nghiệp cho iOS, sử dụng hạ tầng không máy chủ (Serverless) của Cloudflare. Hệ thống cho phép lưu trữ tệp lớn, bóc tách metadata tự động và cài đặt OTA (Over-the-Air) cực nhanh. Phiên bản V37 hỗ trợ **quản lý đa tài khoản (Multi-Account Hub)** trong cùng một dashboard.

---

## ✨ Tính năng nổi bật

- 🚀 **Hỗ trợ tệp lớn:** Multipart Upload vượt qua giới hạn 100MB của Cloudflare Worker.
- 🔗 **Auto Domain:** Tự nhận diện tên miền, không bắt buộc Custom Domain cho R2.
- 🛡️ **Proxy Mode:** Tải file qua Worker, bảo mật link gốc của kho chứa.
- 🛠️ **Command Center:** Quản lý nhiều tài khoản Cloudflare cùng lúc trên 1 giao diện.
- 📊 **Storage Bar Trực Quan:** Hiển thị dung lượng đã dùng theo % cho từng tài khoản.
- 🏷️ **Auto Metadata:** Tự lấy Icon, Bundle ID, Version, iOS Min, Executable và Team Cert.
- 🚪 **Security:** Có chức năng Đăng nhập / Đăng xuất bảo mật.
- 🔄 **Update In-Place:** Cập nhật phiên bản mới mà giữ nguyên link cài đặt cũ.
- 📋 **One-Click Copy:** Sao chép nhanh link IS.GD, link Web, link IPA trực tiếp.
- 📱 **Responsive Mobile:** Tối ưu hiển thị cho cả desktop và mobile.

---

## 🧱 Kiến trúc hệ thống

```
┌─────────────────┐      ┌────────────────────┐      ┌──────────────────┐
│  Command Center │─────▶│  Cloudflare Worker │─────▶│  Cloudflare R2   │
│  (index.html)   │◀─────│    (worker.js)     │◀─────│   (MY_BUCKET)    │
└─────────────────┘      └────────────────────┘      └──────────────────┘
        │                          │
        │ (Multi-Account)          ▼
        │                 ┌────────────────────┐
        └────────────────▶│  iOS Device (OTA)  │
                          │  itms-services://  │
                          └────────────────────┘
```

---

## 🚀 Hướng dẫn cài đặt nhanh

### Bước 1: Cloudflare R2

1. Đăng nhập **Cloudflare Dashboard** → **R2** → **Create Bucket**.
2. Tạo Bucket tên là `MY_BUCKET`.
3. Vào tab **Settings** → **CORS Policy** → Dán JSON sau:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Bước 2: Cloudflare Worker

1. Vào **Workers & Pages** → **Create Worker**.
2. Mở **Settings** → **Variables and Secrets** → thêm các biến:
   - `ACCESS_PASSWORD` — Mật khẩu Admin (bắt buộc).
   - `WEB_DOMAIN` — Tên miền tùy chỉnh nếu có (tùy chọn).
3. Vào **Settings** → **Bindings** → **R2 Bucket Bindings**:
   - Variable name: `MY_BUCKET`
   - R2 Bucket: chọn bucket vừa tạo.
4. Dán toàn bộ mã nguồn từ `worker.js` vào editor và **Deploy**.
5. **Lặp lại bước 1–4** cho mỗi tài khoản Cloudflare nếu muốn dùng đa tài khoản.

### Bước 3: Command Center (Admin Panel)

1. Tải file `index.html` về máy.
2. Mở bằng trình soạn thảo và sửa mảng `ACCOUNTS`:

```javascript
const ACCOUNTS = [
    { name: "KhoiND - TK 01", api: "https://worker-1.ios-khoindvn.workers.dev" },
    { name: "KhoiND - TK 02", api: "https://worker-2.ios-khoindvn.workers.dev" },
    { name: "KhoiND - TK 03", api: "https://worker-3.ios-khoindvn.workers.dev" }
];
```

3. Mở `index.html` bằng trình duyệt → đăng nhập bằng `ACCESS_PASSWORD` chung và bắt đầu sử dụng.

> **Lưu ý:** Tất cả các Worker phải dùng chung 1 `ACCESS_PASSWORD` để hoạt động.

---

## 📂 Cấu trúc thư mục

```
OTA Manager/
├── README.md              # File hướng dẫn này
├── worker.js              # Mã nguồn Cloudflare Worker (Backend)
└── index.html             # Command Center - Multi-Account Dashboard
```

---

## 🔧 Mã nguồn Worker — `worker.js`

> Copy đoạn code dưới đây dán vào Cloudflare Worker của bạn.

```javascript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, PUT",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = env.WEB_DOMAIN ? "https://" + env.WEB_DOMAIN : url.origin;
    const authPass = env.ACCESS_PASSWORD;

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // ROUTE: Giao diện người dùng
    if (url.pathname.startsWith("/v/")) {
      const id = url.pathname.split("/v/")[1];
      const meta = await (await env.MY_BUCKET.get(`meta/${id}.json`))?.json();
      if (!meta) return new Response("404 Not Found", { status: 404, headers: corsHeaders });
      return new Response(generateV32View(meta, host), { 
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } 
      });
    }

    // ROUTE: Xử lý đếm lượt tải và Redirect cài đặt
    if (url.pathname.startsWith("/i/")) {
      const id = url.pathname.split("/i/")[1];
      try {
        const metaFile = await env.MY_BUCKET.get(`meta/${id}.json`);
        if (metaFile) {
          let meta = await metaFile.json();
          meta.downloads = (meta.downloads || 0) + 1;
          await env.MY_BUCKET.put(`meta/${id}.json`, JSON.stringify(meta));
        }
      } catch (e) {}
      return Response.redirect(`itms-services://?action=download-manifest&url=${host}/p/${id}.plist`, 302);
    }

    // Các Route hệ thống (Plist, File, Login, Storage, Admin Tasks...)
    if (url.pathname.startsWith("/p/")) {
      const id = url.pathname.split(".plist")[0].split("/p/")[1];
      const meta = await (await env.MY_BUCKET.get(`meta/${id}.json`))?.json();
      return new Response(generatePlist(meta, host), { headers: { "Content-Type": "application/xml", ...corsHeaders } });
    }

    if (url.pathname.startsWith("/f/")) {
      const fileName = url.pathname.split("/f/")[1];
      const file = await env.MY_BUCKET.get(`files/${fileName}`);
      if (!file) return new Response("Not Found", { status: 404, headers: corsHeaders });
      return new Response(file.body, { headers: { "Content-Type": "application/octet-stream", ...corsHeaders } });
    }

    if (url.pathname === "/login") {
      const body = await request.json();
      return new Response(JSON.stringify({ success: body.password === authPass }), { headers: corsHeaders });
    }

    if (url.pathname === "/storage") {
      try {
        let total = 0; const list = await env.MY_BUCKET.list();
        for (let obj of list.objects) total += obj.size;
        return new Response(JSON.stringify({ usedBytes: total }), { headers: corsHeaders });
      } catch (e) { return new Response(JSON.stringify({ usedBytes: 0 }), { headers: corsHeaders }); }
    }

    const auth = request.headers.get("Authorization");
    if (auth !== authPass) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    // Admin Routes: List/Upload/Edit/Delete
    if (url.pathname === "/list") {
      const list = await env.MY_BUCKET.list({ prefix: "meta/" });
      const apps = [];
      for (const o of list.objects) { apps.push(await (await env.MY_BUCKET.get(o.key)).json()); }
      return new Response(JSON.stringify(apps), { headers: corsHeaders });
    }

    if (url.pathname === "/upload/start") {
      const { fileName } = await request.json();
      const upload = await env.MY_BUCKET.createMultipartUpload(`files/${fileName}`);
      return new Response(JSON.stringify({ uploadId: upload.uploadId, key: upload.key }), { headers: corsHeaders });
    }

    if (url.pathname === "/upload/part") {
      const uploadId = url.searchParams.get("uploadId");
      const partNumber = parseInt(url.searchParams.get("partNumber"));
      const key = url.searchParams.get("key");
      const upload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
      const part = await upload.uploadPart(partNumber, request.body);
      return new Response(JSON.stringify(part), { headers: corsHeaders });
    }

    if (url.pathname === "/upload/complete") {
      const { uploadId, key, parts, appData } = await request.json();
      await (env.MY_BUCKET.resumeMultipartUpload(key, uploadId)).complete(parts);
      appData.fileName = key.replace('files/', '');
      appData.webLink = `${host}/v/${appData.id}`;
      appData.ipaLink = `${host}/f/${appData.fileName}`;
      appData.downloads = 0;
      appData.releaseDate = new Date().toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
      const bridgeUrl = `${host}/i/${appData.id}`;
      try {
        const isgd = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(bridgeUrl)}`);
        appData.isgdLink = (await isgd.json()).shorturl || bridgeUrl;
      } catch (e) { appData.isgdLink = bridgeUrl; }
      await env.MY_BUCKET.put(`meta/${appData.id}.json`, JSON.stringify(appData));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (url.pathname === "/upload/edit") {
      const { id, name, certName, newFileName, newIcon } = await request.json();
      let meta = await (await env.MY_BUCKET.get(`meta/${id}.json`)).json();
      if (newFileName && meta.fileName !== newFileName) {
        const old = await env.MY_BUCKET.get(`files/${meta.fileName}`);
        const newKey = `files/${newFileName.endsWith('.ipa') ? newFileName : newFileName + '.ipa'}`;
        await env.MY_BUCKET.put(newKey, old.body); await env.MY_BUCKET.delete(`files/${meta.fileName}`);
        meta.fileName = newKey.replace('files/', ''); meta.ipaLink = `${host}/f/${meta.fileName}`;
      }
      if (name) meta.name = name; if (certName) meta.certName = certName; if (newIcon) meta.icon = newIcon;
      await env.MY_BUCKET.put(`meta/${id}.json`, JSON.stringify(meta));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (url.pathname === "/delete") {
      const id = url.searchParams.get("id");
      const m = await (await env.MY_BUCKET.get(`meta/${id}.json`)).json();
      await env.MY_BUCKET.delete(`files/${m.fileName}`); await env.MY_BUCKET.delete(`meta/${id}.json`);
      return new Response("OK", { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};

function generatePlist(app, host) {
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>items</key><array><dict><key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key><string>${host}/f/${app.fileName}</string></dict></array><key>metadata</key><dict><key>bundle-identifier</key><string>${app.bundleId}</string><key>bundle-version</key><string>${app.version}</string><key>kind</key><string>software</string><key>title</key><string>${app.name}</string></dict></dict></array></dict></plist>`;
}

function generateV32View(app, host) {
  const downloadStr = app.downloads >= 1000 ? (app.downloads / 1000).toFixed(1) + 'k' : app.downloads || 0;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${app.name} - IPA Master</title>
    <style>
        :root { --primary: #007aff; --bg: #f2f2f7; --card-bg: rgba(255, 255, 255, 0.8); --text: #1c1c1e; --text-secondary: #8e8e93; --border: rgba(0, 0, 0, 0.05); }
        @media (prefers-color-scheme: dark) { :root { --bg: #000000; --card-bg: rgba(28, 28, 30, 0.8); --text: #ffffff; --text-secondary: #98989d; --border: rgba(255, 255, 255, 0.1); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 15px; display: flex; justify-content: center; background-attachment: fixed; }
        .container { width: 100%; max-width: 440px; background: var(--card-bg); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border-radius: 35px; border: 1px solid var(--border); box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; animation: fadeIn 0.6s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .header { padding: 35px 20px 25px; text-align: center; }
        .icon { width: 110px; height: 110px; border-radius: 25px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); margin-bottom: 15px; object-fit: cover; }
        h1 { margin: 0 0 8px; font-size: 24px; font-weight: 800; }
        .cert-tag { background: rgba(0, 122, 255, 0.1); color: var(--primary); padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-block; margin-bottom: 10px; }
        .stats-badge { background: rgba(52, 199, 89, 0.1); color: #34c759; padding: 5px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; display: block; width: fit-content; margin: 0 auto; }
        .actions { padding: 0 25px 25px; }
        .btn { display: flex; align-items: center; justify-content: center; text-decoration: none; padding: 16px; border-radius: 16px; font-weight: 700; margin-bottom: 10px; font-size: 15px; transition: 0.2s; }
        .btn-in { background: var(--primary); color: #fff; box-shadow: 0 8px 20px rgba(0, 122, 255, 0.3); }
        .btn-ipa { background: rgba(142, 142, 147, 0.12); color: var(--text); border: 1px solid var(--border); }
        .btn:active { transform: scale(0.96); }
        .st { padding: 15px 20px 10px; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; }
        .info-box { background: rgba(142, 142, 147, 0.05); margin: 0 20px 20px; border-radius: 24px; overflow: hidden; border: 1px solid var(--border); }
        .row { display: flex; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .row:last-child { border: none; }
        .row span { color: var(--text-secondary); }
        .guide { padding: 0 25px 30px; font-size: 13px; line-height: 1.6; color: var(--text-secondary); }
        .guide b { color: var(--primary); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${app.icon}" class="icon">
            <h1>${app.name}</h1>
            <div class="cert-tag">${app.certName}</div>
            <div class="stats-badge">🔥 ${downloadStr} Người Đã Tải Xuống</div>
        </div>

        <div class="actions">
            <a href="${host}/i/${app.id}" class="btn btn-in">⬇ Download & Install</a>
            <a href="${app.ipaLink}" class="btn btn-ipa">⬇ Tải .IPA (${app.size})</a>
        </div>

        <div class="st">THÔNG TIN ỨNG DỤNG</div>
        <div class="info-box">
            <div class="row"><span>Ngày phát hành</span><b>${app.releaseDate}</b></div>
            <div class="row"><span>Phiên bản</span><b>${app.version} (${app.build})</b></div>
            <div class="row"><span>Yêu cầu iOS</span><b>${app.minOs}+</b></div>
            <div class="row"><span>Executable</span><b>${app.executable}</b></div>
            <div class="row"><span>Ngưởi Đã Tải Xuống</span><b>${app.downloads || 0}</b></div>
        </div>

        <div class="st">Hướng dẫn cài đặt</div>
        <div class="guide">
            Sử dụng <b>Safari</b>. Sau khi cài, vào <b>Cài đặt > Cài đặt chung > VPN & Quản lý thiết bị</b>. Tin cậy <b>${app.certName}</b> để bắt đầu sử dụng.
        </div>
    </div>
</body>
</html>`;
}
```

---

## 🖥️ Command Center — `index.html` (V37)

> Lưu đoạn code dưới đây thành file `index.html` để dùng làm trang quản trị đa tài khoản.

```<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>BẢNG QUẢN TRỊ</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/app-info-parser@1.1.4/dist/app-info-parser.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <style>
        :root { 
            --bg: #050505; 
            --card: rgba(20, 20, 25, 0.7); 
            --accent: #007aff; 
            --accent-glow: rgba(0, 122, 255, 0.4);
            --success: #32d74b; 
            --danger: #ff453a; 
            --text: #ffffff; 
            --text-sec: #a1a1a6;
            --glass: blur(30px) saturate(180%);
            --border: rgba(255, 255, 255, 0.08);
        }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { 
            background-color: var(--bg);
            background-image: 
                radial-gradient(circle at 0% 0%, rgba(0, 122, 255, 0.15) 0%, transparent 30%),
                radial-gradient(circle at 100% 100%, rgba(0, 122, 255, 0.1) 0%, transparent 30%);
            color: var(--text); font-family: 'Outfit', -apple-system, sans-serif; margin: 0; padding: 20px; min-height: 100vh;
            background-attachment: fixed;
        }
        
        .glass { background: var(--card); backdrop-filter: var(--glass); -webkit-backdrop-filter: var(--glass); border: 1px solid var(--border); border-radius: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        
        /* Login Screen */
        #login-screen { max-width: 420px; margin: 12vh auto; padding: 50px 40px; text-align: center; }
        .login-logo { font-size: 50px; font-weight: 800; letter-spacing: -3px; margin-bottom: 5px; background: linear-gradient(to bottom, #fff, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        
        /* Dashboard */
        .header-main { display: flex; justify-content: space-between; align-items: center; padding: 20px 35px; margin-bottom: 30px; position: sticky; top: 15px; z-index: 1000; }
        .logo-txt { font-size: 22px; font-weight: 800; letter-spacing: -1px; }
        
        .grid-layout { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 25px; }
        
        .acc-block { transition: transform 0.3s; }
        .acc-block:hover { transform: translateY(-5px); }
        .acc-h { padding: 30px; border-bottom: 1px solid var(--border); }
        .acc-n { font-size: 18px; font-weight: 700; color: var(--accent); margin-bottom: 15px; letter-spacing: 0.5px; }
        
        .st-b { height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
        .st-f { height: 100%; background: linear-gradient(90deg, #007aff, #5ac8fa); width: 0%; transition: 1.5s cubic-bezier(0.2, 0, 0.2, 1); box-shadow: 0 0 15px var(--accent-glow); }
        
        .search-container { padding: 20px 30px 0; }
        .search-input { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 15px; padding: 12px 18px; color: #fff; outline: none; transition: 0.3s; }
        .search-input:focus { border-color: var(--accent); background: rgba(255,255,255,0.06); }
        
        .up-z { 
            margin: 20px 30px; border: 1px dashed rgba(255,255,255,0.15); border-radius: 25px; padding: 40px 15px; text-align: center; cursor: pointer; transition: 0.3s; background: rgba(255,255,255,0.01); 
        }
        .up-z:hover { background: rgba(0, 122, 255, 0.05); border-color: var(--accent); }
        
        .app-list { padding: 0 30px 25px; max-height: 600px; overflow-y: auto; }
        .app-item { background: rgba(255,255,255,0.02); border-radius: 25px; padding: 20px; border: 1px solid var(--border); margin-bottom: 15px; transition: 0.2s; }
        .app-item:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.04); }
        .app-icon { width: 70px; height: 70px; border-radius: 18px; object-fit: cover; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
        
        .acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 20px; }
        .btn-sm { padding: 12px 4px; font-size: 9px; font-weight: 700; border-radius: 12px; border: none; cursor: pointer; color: #fff; text-align: center; transition: 0.2s; text-transform: uppercase; }
        .btn-sm:active { transform: scale(0.95); }
        
        input, .btn-main { width: 100%; padding: 16px; border-radius: 18px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: #fff; margin-top: 12px; outline: none; font-size: 15px; transition: 0.3s; }
        .btn-main { background: var(--accent); border: none; font-weight: 800; cursor: pointer; margin-top: 25px; box-shadow: 0 10px 30px var(--accent-glow); }
        .btn-main:hover { transform: translateY(-2px); box-shadow: 0 15px 35px var(--accent-glow); opacity: 0.9; }

        #edit-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(20px); align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
        
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate { animation: slideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
    </style>
</head>
<body>

    <!-- TRANG LOGIN -->
    <div id="login-screen" class="glass animate">
        <div class="login-logo">ADMIN</div>
        <p style="color:var(--text-sec); font-size:11px; margin-bottom:40px; font-weight:600; letter-spacing:4px; text-transform:uppercase;">IPA Commander Pro V38</p>
        <input type="password" id="admin-pass" placeholder="MẬT MÃ QUẢN TRỊ" onkeypress="if(event.key==='Enter') login()">
        <button class="btn-main" onclick="login()">TRUY CẬP HỆ THỐNG</button>
    </div>

    <!-- TRANG DASHBOARD -->
    <div id="dashboard" style="display:none;">
        <div class="header-main glass animate">
            <div class="logo-txt">BẢNG ĐIỀU KHIỂN</div>
            <div style="display:flex; gap:12px;">
                <button onclick="clean()" style="background:rgba(255,255,255,0.06); border:1px solid var(--border); color:#a1a1a6; padding:10px 20px; border-radius:15px; font-size:11px; font-weight:700; cursor:pointer; transition:0.3s;">DỌN RÁC R2</button>
                <button onclick="logout()" style="background:var(--danger); border:none; color:#fff; padding:10px 20px; border-radius:15px; font-size:11px; font-weight:700; cursor:pointer; transition:0.3s;">ĐĂNG XUẤT</button>
            </div>
        </div>
        <div class="grid-layout" id="account-grid"></div>
    </div>

    <!-- MODAL SỬA -->
    <div id="edit-modal">
        <div class="glass animate" style="width:100%; max-width:440px; padding:40px; text-align:center;">
            <h3 style="margin:0 0 25px; font-size:22px; font-weight:800;">CHỈNH SỬA</h3>
            <center>
                <div style="position:relative; width:110px; height:110px; margin-bottom:25px;">
                    <img id="edit-preview" style="width:100%; height:100%; border-radius:24px; border:2px solid var(--accent); object-fit:cover; cursor:pointer;" onclick="document.getElementById('edit-icon-in').click()">
                    <div style="position:absolute; bottom:-5px; right:-5px; background:var(--accent); color:white; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">✎</div>
                </div>
                <input type="file" id="edit-icon-in" style="display:none" onchange="previewIcon(this)">
            </center>
            <input type="hidden" id="edit-id"><input type="hidden" id="edit-acc-idx">
            <input type="text" id="edit-name" placeholder="Tên hiển thị">
            <input type="text" id="edit-filename" placeholder="Tên file gốc">
            <input type="text" id="edit-cert" placeholder="Chứng chỉ app">
            <button class="btn-main" onclick="saveEdit()">CẬP NHẬT DỮ LIỆU</button>
            <button class="btn-main" style="background:rgba(255,255,255,0.06); margin-top:10px; box-shadow:none;" onclick="closeEdit()">ĐÓNG</button>
        </div>
    </div>

<script>
// --- DANH SÁCH MÁY CHỦ ĐÃ CẬP NHẬT ---
const ACCOUNTS = [
        { name: "Tài khoản 01", api: "https://khoindvn.workers.dev" },
        { name: "Tài khoản 02", api: "https://khoindvn.workers.dev" },
        { name: "Tài khoản 03", api: "https://khoindvn.workers.dev" }
    ];


    let PASS = localStorage.getItem("ipa_master_pass") || "";
    if(PASS) showDashboard();

    function login(){ 
        const val = document.getElementById('admin-pass').value;
        if(!val) return;
        localStorage.setItem("ipa_master_pass", val); 
        location.reload(); 
    }
    function logout(){ if(confirm("Bạn muốn đăng xuất?")){ localStorage.removeItem("ipa_master_pass"); location.reload(); } }

    function showDashboard(){
        document.getElementById('login-screen').style.display='none';
        document.getElementById('dashboard').style.display='block';
        const grid = document.getElementById('account-grid');
        ACCOUNTS.forEach((acc, idx) => {
            grid.innerHTML += `
                <div class="glass acc-block animate" style="animation-delay: ${idx*0.1}s">
                    <div class="acc-h">
                        <div class="acc-n">${acc.name}</div>
                        <div class="st-b"><div id="st-fill-${idx}" class="st-f"></div></div>
                        <div style="font-size:10px; color:var(--text-sec); display:flex; justify-content:space-between; font-weight:700; text-transform:uppercase;">
                            <span id="st-txt-${idx}">ĐANG TẢI...</span>
                            <span>GIỚI HẠN: 10 GB</span>
                        </div>
                    </div>
                    <div class="search-container"><input type="text" class="search-input" placeholder="TÌM KIẾM ỨNG DỤNG..." oninput="searchApps(${idx}, this.value)"></div>
                    <div class="up-z" onclick="document.getElementById('f-in-${idx}').click()">
                        <b id="status-${idx}" style="font-size:14px; letter-spacing:1px;">📤 TẢI LÊN IPA</b>
                        <input type="file" id="f-in-${idx}" style="display:none" accept=".ipa" onchange="upFile(this, ${idx})">
                        <div class="p-box" style="height:4px; background:rgba(255,255,255,0.05); border-radius:10px; margin-top:20px; display:none; overflow:hidden;" id="p-box-${idx}"><div style="height:100%; background:var(--accent); width:0%;" id="p-fill-${idx}"></div></div>
                    </div>
                    <div class="app-list" id="list-${idx}"></div>
                </div>`;
            loadData(idx);
        });
    }

    async function loadData(idx){
        const acc = ACCOUNTS[idx];
        try {
            const s = await(await fetch(`${acc.api}/storage`, {headers:{"Authorization":PASS}})).json();
            const usedMB = (s.usedBytes/1024/1024).toFixed(1);
            document.getElementById(`st-txt-${idx}`).innerText = usedMB + " MB ĐÃ DÙNG";
            document.getElementById(`st-fill-${idx}`).style.width = Math.min(100, (s.usedBytes / (10*1024*1024*1024)*100)) + "%";
            const apps = await(await fetch(`${acc.api}/list`, {headers:{"Authorization":PASS}})).json();
            window[`data_${idx}`] = apps.sort((a,b)=>b.id-a.id);
            renderApps(idx);
        } catch(e) { document.getElementById(`list-${idx}`).innerHTML = "<div style='color:var(--danger); text-align:center; padding:40px; font-size:12px; font-weight:700;'>⚠️ LỖI KẾT NỐI SERVER</div>"; }
    }

    function renderApps(idx, q = "") {
        const list = document.getElementById(`list-${idx}`);
        let apps = window[`data_${idx}`] || [];
        if (q) apps = apps.filter(a => a.name.toLowerCase().includes(q.toLowerCase()));
        let h = "";
        apps.forEach(a => {
            h += `
            <div class="app-item">
                <div style="display:flex; gap:18px; align-items:center;">
                    <img src="${a.icon}" class="app-icon">
                    <div style="flex:1; overflow:hidden;">
                        <div style="font-weight:800; color:#fff; font-size:16px; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${a.name}</div>
                        <div style="font-size:10px; color:var(--text-sec); font-weight:700; text-transform:uppercase;">${a.version} • ${a.size} • ${a.certName}</div>
                    </div>
                </div>
                <div class="acts">
                    <button class="btn-sm" style="background:rgba(255,255,255,0.08)" onclick="copy('${a.isgdLink}')">Link Rút Gọn</button>
                    <button class="btn-sm" style="background:var(--success)" onclick="copy('${a.webLink}')">Copy Link</button>
                    <button class="btn-sm" style="background:var(--accent)" onclick="window.open('${a.webLink}')">Xem</button>
                    <button class="btn-sm" style="background:#555" onclick="reup(${idx}, '${a.id}')">Update</button>
                    <button class="btn-sm" style="background:#444" onclick='openEdit(${idx}, ${JSON.stringify(a).replace(/'/g,"&apos;")})'>Sửa</button>
                    <button class="btn-sm" style="background:var(--danger)" onclick="del(${idx}, '${a.id}')">Xóa</button>
                </div>
            </div>`;
        });
        list.innerHTML = h || "<div style='color:var(--text-sec); text-align:center; padding:30px; font-size:12px;'>TRỐNG</div>";
    }

    function searchApps(idx, val) { renderApps(idx, val); }

    async function upFile(input, idx, appId=null){
        const file = input.files[0]; if(!file) return;
        const acc = ACCOUNTS[idx];
        const status = document.getElementById(`status-${idx}`);
        const pBox = document.getElementById(`p-box-${idx}`);
        const pFill = document.getElementById(`p-fill-${idx}`);
        pBox.style.display = 'block'; status.innerText = "⚡ ĐANG XỬ LÝ...";
        try {
            const info = await (new AppInfoParser(file)).parse();
            const zip = await JSZip.loadAsync(file);
            const prov = Object.keys(zip.files).find(f=>f.endsWith(".app/embedded.mobileprovision"));
            let team = "Enterprise"; 
            if(prov){ const content = await zip.file(prov).async("string"); team = content.match(/<key>TeamName<\/key>\s*<string>([^<]+)<\/string>/)?.[1] || "Enterprise"; }
            const id = appId || Date.now().toString();
            const startReq = await fetch(`${acc.api}/upload/start`,{method:'POST',headers:{"Authorization":PASS},body:JSON.stringify({fileName:id+".ipa"})});
            const start = await startReq.json();
            const chunkSize = 5 * 1024 * 1024; const chunks = Math.ceil(file.size / chunkSize); const parts = [];
            for(let i=0; i<chunks; i++){
                const chunk = file.slice(i * chunkSize, (i+1) * chunkSize);
                const res = await fetch(`${acc.api}/upload/part?uploadId=${start.uploadId}&partNumber=${i+1}&key=${start.key}`,{method:'POST', headers:{"Authorization":PASS}, body:chunk});
                const d = await res.json(); parts.push({partNumber:i+1, etag:d.etag});
                pFill.style.width = Math.round((i+1)/chunks*100) + "%";
                status.innerText = `📤 TẢI LÊN: ${Math.round((i+1)/chunks*100)}%`;
            }
            await fetch(`${acc.api}/upload/complete`,{method:'POST', headers:{"Authorization":PASS}, body:JSON.stringify({uploadId:start.uploadId, key:start.key, parts, appData:{id, name:info.CFBundleDisplayName || info.CFBundleName, bundleId:info.CFBundleIdentifier, version:info.CFBundleShortVersionString, build:info.CFBundleVersion, executable:info.CFBundleExecutable, minOs:info.MinimumOSVersion, size:(file.size/1024/1024).toFixed(1)+" MB", icon:info.icon, certName:team}})});
            pBox.style.display='none'; status.innerText = "✅ XONG!"; input.value = "";
            setTimeout(() => { status.innerText = "📤 TẢI LÊN IPA"; }, 3000); loadData(idx);
        } catch(e) { alert("Lỗi: " + e.message); status.innerText = "❌ LỖI!"; pBox.style.display='none'; }
    }

    function previewIcon(i){ const r=new FileReader(); r.onload=(e)=>document.getElementById('edit-preview').src=e.target.result; r.readAsDataURL(i.files[0]); }
    function openEdit(idx, a){ document.getElementById('edit-acc-idx').value = idx; document.getElementById('edit-id').value = a.id; document.getElementById('edit-name').value = a.name; document.getElementById('edit-filename').value = a.fileName; document.getElementById('edit-cert').value = a.certName; document.getElementById('edit-preview').src = a.icon; document.getElementById('edit-modal').style.display = 'flex'; }
    function closeEdit(){ document.getElementById('edit-modal').style.display = 'none'; }
    async function saveEdit(){
        const idx = document.getElementById('edit-acc-idx').value;
        const body = { id: document.getElementById('edit-id').value, name: document.getElementById('edit-name').value, newFileName: document.getElementById('edit-filename').value, certName: document.getElementById('edit-cert').value, newIcon: document.getElementById('edit-preview').src.startsWith('data:') ? document.getElementById('edit-preview').src : "" };
        await fetch(`${ACCOUNTS[idx].api}/upload/edit`, { method:'POST', headers:{"Authorization":PASS,"Content-Type":"application/json"}, body:JSON.stringify(body) });
        location.reload();
    }
    async function clean() { if(confirm("Dọn sạch các tệp rác trên R2?")) { for(let i=0; i<ACCOUNTS.length; i++) await fetch(`${ACCOUNTS[i].api}/cleanup`, {headers:{"Authorization":PASS}}); alert("ĐÃ DỌN DẸP!"); location.reload(); } }
    function reup(idx, id){ const i=document.createElement('input'); i.type='file'; i.accept='.ipa'; i.onchange=(e)=>upFile(i, idx, id); i.click(); }
    async function del(idx, id){ if(confirm("Bạn có chắc chắn muốn xóa vĩnh viễn app này?")){ await fetch(`${ACCOUNTS[idx].api}/delete?id=${id}`,{method:'DELETE',headers:{"Authorization":PASS}}); loadData(idx); } }
    function copy(t){ navigator.clipboard.writeText(t); alert("ĐÃ SAO CHÉP!"); }
</script>
</body>
</html>

```

---

## 📡 API Endpoints

| Method | Endpoint | Mô tả | Cần Auth |
|--------|----------|-------|----------|
| `POST` | `/login` | Xác thực mật khẩu Admin | ❌ |
| `GET`  | `/storage` | Lấy dung lượng đã sử dụng | ❌ |
| `GET`  | `/list` | Liệt kê tất cả ứng dụng | ✅ |
| `POST` | `/upload/start` | Khởi tạo Multipart Upload | ✅ |
| `POST` | `/upload/part` | Tải lên 1 chunk của file | ✅ |
| `POST` | `/upload/complete` | Hoàn tất upload và lưu metadata | ✅ |
| `POST` | `/upload/edit` | Chỉnh sửa metadata ứng dụng | ✅ |
| `DELETE` | `/delete?id=XXX` | Xóa ứng dụng | ✅ |
| `GET`  | `/v/{id}` | Trang xem chi tiết ứng dụng | ❌ |
| `GET`  | `/p/{id}.plist` | Manifest plist cho OTA | ❌ |
| `GET`  | `/f/{filename}` | Tải trực tiếp file IPA | ❌ |
| `GET`  | `/i/{id}` | Redirect tới `itms-services://` | ❌ |

---

## 📱 Quy trình cài đặt trên iPhone

1. Mở trang chi tiết ứng dụng bằng **Safari**.
2. Bấm nút **⬇ Download & Install** → iOS sẽ hỏi xác nhận → **Cài đặt**.
3. Sau khi cài xong, vào **Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị**.
4. Tin cậy chứng chỉ Team Cert tương ứng.
5. Mở app và sử dụng bình thường.

---

## 🆕 Thay đổi trong V37

- ✨ **Multi-Account Hub** — quản lý 3+ tài khoản Cloudflare cùng lúc.
- 📊 **Storage Bar** — thanh dung lượng trực quan cho từng tài khoản.
- 📱 **Mobile-first Design** — tối ưu cho mobile với layout responsive.
- 🐛 **Bug Fix** — reset input file để có thể chọn lại cùng 1 file.
- ⚡ **Better Error Handling** — hiển thị lỗi rõ ràng khi upload thất bại.
- 🎨 **UI Polish** — cải thiện animation, transition và hiệu ứng touch.

---

## ⚠️ Lưu ý quan trọng

- **R2 Free Plan** giới hạn 10GB lưu trữ cho mỗi tài khoản. Hãy theo dõi mục Storage trên Dashboard.
- **Multipart chunk size** mặc định là **5MB** — đây là giới hạn tối thiểu của S3-compatible API.
- File IPA cần được **ký chứng chỉ hợp lệ** (Enterprise / Developer / Ad-hoc) thì iOS mới cho phép cài.
- Nếu dùng chứng chỉ Enterprise đã bị thu hồi, ứng dụng sẽ không mở được kể cả đã cài thành công.
- Trang xem chi tiết (`/v/{id}`) **không được bảo vệ bằng mật khẩu**, ai có link đều xem được.
- Tất cả các Worker trong `ACCOUNTS` phải dùng **chung 1 mật khẩu** `ACCESS_PASSWORD`.

---

## 🛠️ Troubleshooting

| Vấn đề | Cách khắc phục |
|--------|----------------|
| `Unauthorized` khi upload | Kiểm tra `ACCESS_PASSWORD` trong Worker Variables. |
| `404 Not Found` khi mở `/v/{id}` | ID không tồn tại hoặc metadata bị xóa. |
| Cài OTA bị lỗi `Unable to Download App` | Kiểm tra HTTPS, plist phải truy cập được công khai. |
| Upload fail giữa chừng | Kiểm tra CORS Policy của R2 Bucket. |
| iOS báo `Untrusted Enterprise Developer` | Vào **Settings → General → VPN & Device Management** để tin cậy. |
| ⚠️ Lỗi kết nối tài khoản | Kiểm tra link Worker trong mảng `ACCOUNTS` và mật khẩu đồng bộ. |

---

## 🔐 Bảo mật

- Mật khẩu được lưu ở `localStorage` của trình duyệt — **không an toàn tuyệt đối**, không dùng chung máy.
- Nên đặt **Custom Domain** cho Worker để dễ ghi nhớ và chuyên nghiệp hơn.
- Có thể thêm **Cloudflare Access** (Zero Trust) trước Worker để bảo vệ Admin Panel.
- Khi dùng Multi-Account, nên đặt mật khẩu phức tạp vì 1 password mở khóa nhiều bucket cùng lúc.

---

## 📜 License

Phát hành theo [MIT License](https://opensource.org/licenses/MIT) — tự do sử dụng, chỉnh sửa và phân phối.

---

## 👤 Tác giả

*Phát triển bởi **KhoiNDVN**

> Nếu thấy hữu ích, hãy ⭐ Star repo này để ủng hộ!
