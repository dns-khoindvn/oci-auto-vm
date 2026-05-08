# 📦 IPA Master V37 - Ultimate OTA Manager

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Version](https://img.shields.io/badge/Version-37.0-green.svg)
![Platform](https://img.shields.io/badge/Platform-Cloudflare_Workers-orange.svg)
![Storage](https://img.shields.io/badge/Storage-Cloudflare_R2-yellow.svg)

**IPA Master V37** là hệ thống quản lý và phân phối tệp tin IPA chuyên nghiệp cho iOS, sử dụng hạ tầng không máy chủ (Serverless) của Cloudflare. Hệ thống cho phép lưu trữ tệp lớn, bóc tách metadata tự động và cài đặt OTA (Over-the-Air) cực nhanh. Phiên bản V37 hỗ trợ **quản lý đa tài khoản (Multi-Account Hub)** trong cùng một dashboard.

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
ipa-master-v37/
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
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = env.WEB_DOMAIN ? "https://" + env.WEB_DOMAIN : url.origin;
    const authPass = env.ACCESS_PASSWORD;
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    if (url.pathname.startsWith("/v/")) {
      const id = url.pathname.split("/v/")[1];
      const meta = await (await env.MY_BUCKET.get(`meta/${id}.json`))?.json();
      if (!meta) return new Response("404 Not Found", { status: 404 });
      return new Response(generateV32View(meta, host), { headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } });
    }

    if (url.pathname.startsWith("/p/")) {
      const id = url.pathname.split(".plist")[0].split("/p/")[1];
      const meta = await (await env.MY_BUCKET.get(`meta/${id}.json`))?.json();
      return new Response(generatePlist(meta, host), { headers: { "Content-Type": "application/xml", ...corsHeaders } });
    }

    if (url.pathname.startsWith("/f/")) {
      const fileName = url.pathname.split("/f/")[1];
      const file = await env.MY_BUCKET.get(`files/${fileName}`);
      if (!file) return new Response("Not Found", { status: 404 });
      return new Response(file.body, { headers: { "Content-Type": "application/octet-stream", ...corsHeaders } });
    }

    if (url.pathname.startsWith("/i/")) {
      const id = url.pathname.split("/i/")[1];
      return Response.redirect(`itms-services://?action=download-manifest&url=${host}/p/${id}.plist`, 302);
    }

    if (url.pathname === "/login") {
      const body = await request.json();
      return new Response(JSON.stringify({ success: body.password === authPass }), { headers: corsHeaders });
    }

    if (url.pathname === "/storage") {
      let total = 0; const list = await env.MY_BUCKET.list();
      for (let obj of list.objects) total += obj.size;
      return new Response(JSON.stringify({ usedBytes: total }), { headers: corsHeaders });
    }

    const auth = request.headers.get("Authorization");
    if (auth !== authPass) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

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

    if (url.pathname === "/list") {
      const list = await env.MY_BUCKET.list({ prefix: "meta/" });
      const apps = [];
      for (const o of list.objects) { apps.push(await (await env.MY_BUCKET.get(o.key)).json()); }
      return new Response(JSON.stringify(apps), { headers: corsHeaders });
    }

    if (url.pathname === "/delete") {
      const id = url.searchParams.get("id");
      const m = await (await env.MY_BUCKET.get(`meta/${id}.json`)).json();
      await env.MY_BUCKET.delete(`files/${m.fileName}`); await env.MY_BUCKET.delete(`meta/${id}.json`);
      return new Response("OK", { headers: corsHeaders });
    }
    return new Response("Not Found", { status: 404 });
  }
};

function generatePlist(app, host) {
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>items</key><array><dict><key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key><string>${host}/f/${app.fileName}</string></dict></array><key>metadata</key><dict><key>bundle-identifier</key><string>${app.bundleId}</string><key>bundle-version</key><string>${app.version}</string><key>kind</key><string>software</string><key>title</key><string>${app.name}</string></dict></dict></array></dict></plist>`;
}

function generateV32View(app, host) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${app.name}</title>
    <style>:root{--blue:#007aff;--bg:#f5f5f7}body{background:var(--bg);color:#1c1c1e;font-family:-apple-system,sans-serif;margin:0;padding:20px;display:flex;justify-content:center}.container{width:100%;max-width:500px;background:#fff;border-radius:30px;box-shadow:0 10px 40px rgba(0,0,0,.05);overflow:hidden}.header{padding:40px 20px;text-align:center}.icon{width:110px;height:110px;border-radius:24px;box-shadow:0 8px 20px rgba(0,0,0,.1);margin-bottom:15px}.btn{display:block;text-decoration:none;padding:16px;border-radius:14px;font-weight:700;margin:10px 30px;text-align:center}.btn-in{background:var(--blue);color:#fff}.btn-ipa{background:#f2f2f7;color:#1c1c1e;font-size:14px;border:1px solid #e5e5ea}.st{background:#fafafa;padding:10px 20px;font-size:11px;font-weight:700;color:#86868b;text-transform:uppercase;border-top:1px solid #f2f2f2}.row{display:flex;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #f2f2f2;font-size:13px}.guide{padding:20px;font-size:13px;line-height:1.6}</style>
    </head><body><div class="container"><div class="header"><img src="${app.icon}" class="icon"><h1>${app.name}</h1><div style="background:#eef7ff;color:var(--blue);padding:5px 15px;border-radius:20px;font-size:11px;font-weight:700;display:inline-block">${app.certName}</div></div>
    <a href="${host}/i/${app.id}" class="btn btn-in">⬇ Download & Install</a><a href="${app.ipaLink}" class="btn btn-ipa">⬇ Tải .IPA (${app.size})</a>
    <div class="st">THÔNG TIN ỨNG DỤNG</div>
    <div class="row"><div>Ngày phát hành</div><b>${app.releaseDate}</b></div>
    <div class="row"><div>Phiên bản</div><b>${app.version} (${app.build})</b></div>
    <div class="row"><div>Yêu cầu iOS</div><b>${app.minOs}+</b></div>
    <div class="row" style="border:none"><div>Executable</div><b>${app.executable}</b></div>
    <div class="st">Hướng dẫn cài đặt</div><div class="guide">Sử dụng Safari. Sau khi cài, vào <b>Cài đặt > Cài đặt chung > VPN & Quản lý thiết bị</b>. Tin cậy <b>${app.certName}</b>.</div></div></body></html>`;
}
```

---

## 🖥️ Command Center — `index.html` (V37)

> Lưu đoạn code dưới đây thành file `index.html` để dùng làm trang quản trị đa tài khoản.

```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>IPA COMMAND CENTER V37</title>
    <script src="https://unpkg.com/app-info-parser@1.1.4/dist/app-info-parser.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <style>
        :root { --bg: #0b0e14; --card: #161b22; --blue: #007aff; --green: #28cd41; --red: #da373c; --gray: #8b949e; }
        body { background: var(--bg); color: #fff; font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 10px; line-height: 1.5; }
        
        /* HEADER */
        .header-main { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--card); border-radius: 15px; margin-bottom: 15px; border: 1px solid #30363d; position: sticky; top: 0; z-index: 99; }
        
        /* LAYOUT 3 TÀI KHOẢN */
        .grid-layout { display: flex; flex-direction: column; gap: 20px; }
        @media (min-width: 1024px) { .grid-layout { flex-direction: row; align-items: flex-start; } .account-block { flex: 1; } }

        .account-block { background: var(--card); border-radius: 20px; border: 1px solid #30363d; padding-bottom: 15px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        .acc-header { padding: 15px; background: rgba(255,255,255,0.03); border-bottom: 1px solid #30363d; }
        .acc-name { font-size: 16px; font-weight: bold; color: var(--blue); }
        
        /* STORAGE BAR */
        .storage-info { font-size: 11px; color: var(--gray); margin-top: 5px; display: flex; justify-content: space-between; }
        .storage-bar { height: 6px; background: #333; border-radius: 3px; margin: 8px 0; overflow: hidden; }
        .storage-fill { height: 100%; background: var(--green); width: 0%; transition: 0.8s ease-out; }

        /* UPLOAD ZONE */
        .drop-zone { border: 2px dashed #444; padding: 25px 15px; text-align: center; margin: 15px; border-radius: 12px; cursor: pointer; font-size: 13px; background: rgba(0,0,0,0.2); transition: 0.3s; }
        .drop-zone:active { background: rgba(0,122,255,0.1); border-color: var(--blue); }
        .p-bar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; margin-top: 10px; display: none; overflow: hidden; }
        .p-fill { height: 100%; background: var(--blue); width: 0%; box-shadow: 0 0 10px var(--blue); transition: 0.2s; }

        /* DANH SÁCH APP */
        .app-list { padding: 0 15px; }
        .app-item { background: #0d1117; padding: 15px; border-radius: 15px; margin-bottom: 12px; border: 1px solid #30363d; }
        .app-top { display: flex; gap: 12px; margin-bottom: 10px; align-items: center; }
        .app-icon { width: 55px; height: 55px; border-radius: 12px; object-fit: cover; border: 1px solid #333; background: #222; }
        .app-info-main { flex: 1; }
        .app-name-txt { font-size: 15px; font-weight: bold; color: #58a6ff; display: block; margin-bottom: 3px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: var(--gray); }
        .info-full { font-size: 9px; color: #555; margin-top: 8px; border-top: 1px solid #222; padding-top: 5px; }
        
        .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
        .btn-sm { padding: 10px 5px; font-size: 10px; border-radius: 8px; border: none; cursor: pointer; color: #fff; font-weight: bold; flex: 1; text-align: center; transition: 0.2s; }
        .btn-sm:active { opacity: 0.7; transform: scale(0.95); }
        
        /* MODAL */
        #edit-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .modal-content { background: var(--card); padding: 25px; border-radius: 20px; width: 100%; max-width: 400px; border: 1px solid #30363d; }
        input, .btn-main { width: 100%; padding: 14px; margin: 8px 0; border-radius: 10px; border: 1px solid #30363d; background: #0d1117; color: #fff; box-sizing: border-box; font-size: 14px; }
        .btn-main { background: var(--blue); font-weight: bold; cursor: pointer; border: none; margin-top: 15px; }
    </style>
</head>
<body>

    <div id="login-screen" style="max-width:350px; margin:20vh auto; padding:20px;">
        <div class="account-block" style="padding:25px;">
            <h2 style="text-align:center; margin-top:0;">IPA Master Hub</h2>
            <input type="password" id="admin-pass" placeholder="Mật khẩu hệ thống">
            <button class="btn-main" onclick="login()">Kích hoạt Dashboard</button>
        </div>
    </div>

    <div id="dashboard" style="display:none;">
        <div class="header-main">
            <b style="font-size:18px;">COMMANDER V37</b>
            <button onclick="logout()" style="background:none; border:1px solid var(--red); color:var(--red); padding:8px 15px; border-radius:10px; font-size:12px; font-weight:bold; cursor:pointer;">🚪 Thoát</button>
        </div>
        <div class="grid-layout" id="account-grid"></div>
    </div>

    <div id="edit-modal">
        <div class="modal-content">
            <h3 style="margin-top:0;">Sửa ứng dụng</h3>
            <center>
                <img id="edit-preview" style="width:75px; height:75px; border-radius:18px; border:2px solid #555; cursor:pointer;" onclick="document.getElementById('edit-icon-in').click()">
                <input type="file" id="edit-icon-in" style="display:none" onchange="previewIcon(this)">
                <div style="font-size:10px; color:var(--gray); margin:8px 0 15px;">Nhấn vào icon để đổi ảnh</div>
            </center>
            <input type="hidden" id="edit-id"><input type="hidden" id="edit-acc-idx">
            <label style="font-size:11px;">Tên hiển thị:</label><input type="text" id="edit-name">
            <label style="font-size:11px;">Tên file (.ipa):</label><input type="text" id="edit-filename">
            <label style="font-size:11px;">Team Cert:</label><input type="text" id="edit-cert">
            <button class="btn-main" onclick="saveEdit()">Lưu thay đổi</button>
            <button class="btn-main" style="background:#333;" onclick="closeEdit()">Hủy bỏ</button>
        </div>
    </div>

<script>
    // --- 🟢 CẤU HÌNH LINK WORKER CỦA BẠN TẠI ĐÂY ---
    const ACCOUNTS = [
        { name: "KhoiND - TK 01", api: "https://worker-1.ios-khoindvn.workers.dev" },
        { name: "KhoiND - TK 02", api: "https://worker-2.ios-khoindvn.workers.dev" },
        { name: "KhoiND - TK 03", api: "https://worker-3.ios-khoindvn.workers.dev" }
    ];

    let PASS = localStorage.getItem("ipa_master_pass") || "";
    if(PASS) showDashboard();

    function login(){ 
        PASS = document.getElementById('admin-pass').value; 
        localStorage.setItem("ipa_master_pass", PASS); 
        location.reload(); 
    }
    function logout(){ 
        if(confirm("Bạn muốn đăng xuất?")){
            localStorage.removeItem("ipa_master_pass"); 
            location.reload(); 
        }
    }

    function showDashboard(){
        document.getElementById('login-screen').style.display='none';
        document.getElementById('dashboard').style.display='block';
        const grid = document.getElementById('account-grid');
        ACCOUNTS.forEach((acc, idx) => {
            grid.innerHTML += `
                <div class="account-block">
                    <div class="acc-header">
                        <div class="acc-name">${acc.name}</div>
                        <div class="storage-info">
                            <span>Dung lượng đã dùng:</span>
                            <b id="st-txt-${idx}">0 MB</b>
                        </div>
                        <div class="storage-bar"><div id="st-fill-${idx}" class="storage-fill"></div></div>
                        <div style="font-size:9px; color:#555; text-align:right">Giới hạn: 10 GB</div>
                    </div>
                    <div class="drop-zone" onclick="document.getElementById('f-in-${idx}').click()">
                        <b id="status-${idx}">➕ Tải IPA lên ${acc.name}</b>
                        <input type="file" id="f-in-${idx}" style="display:none" accept=".ipa" onchange="upFile(this, ${idx})">
                        <div class="p-bar" id="p-box-${idx}"><div class="p-fill" id="p-fill-${idx}"></div></div>
                    </div>
                    <div class="app-list" id="list-${idx}">Đang tải ứng dụng...</div>
                </div>`;
            loadData(idx);
        });
    }

    async function loadData(idx){
        const acc = ACCOUNTS[idx];
        try {
            const s = await(await fetch(`${acc.api}/storage`, {headers:{"Authorization":PASS}})).json();
            const usedMB = (s.usedBytes/1024/1024).toFixed(1);
            document.getElementById(`st-txt-${idx}`).innerText = usedMB + " MB";
            document.getElementById(`st-fill-${idx}`).style.width = Math.min(100, (s.usedBytes / (10*1024*1024*1024)*100)) + "%";
            
            const apps = await(await fetch(`${acc.api}/list`, {headers:{"Authorization":PASS}})).json();
            let h = "";
            apps.sort((a,b)=>b.id-a.id).forEach(a=>{
                h += `
                <div class="app-item">
                    <div class="app-top">
                        <img src="${a.icon}" class="app-icon">
                        <div class="app-info-main">
                            <span class="app-name-txt">${a.name}</span>
                            <div class="info-grid">
                                <span>Ver: <b>${a.version}</b></span>
                                <span>Size: <b>${a.size}</b></span>
                                <span>iOS: <b>${a.minOs}+</b></span>
                                <span>Cert: <b>${a.certName}</b></span>
                            </div>
                        </div>
                    </div>
                    <div class="info-full">Exec: ${a.executable} | Build: ${a.build}</div>
                    <div class="actions">
                        <button class="btn-sm" style="background:#ff3b30" onclick="copy('${a.isgdLink}')">IS.GD</button>
                        <button class="btn-sm" style="background:#28cd41" onclick="copy('${a.webLink}')">WEB</button>
                        <button class="btn-sm" style="background:#007aff" onclick="window.open('${a.webLink}')">🔗 MỞ</button>
                        <button class="btn-sm" style="background:#d29922" onclick="reup(${idx}, '${a.id}')">🔄 UP</button>
                        <button class="btn-sm" style="background:#58a6ff" onclick='openEdit(${idx}, ${JSON.stringify(a).replace(/'/g,"&apos;")})'>🔧 SỬA</button>
                        <button class="btn-sm" style="background:var(--red)" onclick="del(${idx}, '${a.id}')">🗑 XÓA</button>
                    </div>
                </div>`;
            });
            document.getElementById(`list-${idx}`).innerHTML = h || "Chưa có ứng dụng nào.";
        } catch(e) { document.getElementById(`list-${idx}`).innerHTML = "⚠️ Lỗi kết nối tài khoản."; }
    }

    async function upFile(input, idx, appId=null){
        const file = input.files[0];
        if(!file) return;

        const acc = ACCOUNTS[idx];
        const status = document.getElementById(`status-${idx}`);
        const pBox = document.getElementById(`p-box-${idx}`);
        const pFill = document.getElementById(`p-fill-${idx}`);
        
        pBox.style.display = 'block';
        status.innerText = "🔄 Đang khởi tạo...";

        try {
            const info = await (new AppInfoParser(file)).parse();
            const zip = await JSZip.loadAsync(file);
            const prov = Object.keys(zip.files).find(f=>f.endsWith(".app/embedded.mobileprovision"));
            let team = "Enterprise"; 
            if(prov){ 
                const certContent = await zip.file(prov).async("string");
                team = certContent.match(/<key>TeamName<\/key>\s*<string>([^<]+)<\/string>/)?.[1] || "Enterprise"; 
            }

            const id = appId || Date.now().toString();
            const startReq = await fetch(`${acc.api}/upload/start`,{method:'POST',headers:{"Authorization":PASS},body:JSON.stringify({fileName:id+".ipa"})});
            const start = await startReq.json();
            
            const chunkSize = 5 * 1024 * 1024;
            const chunks = Math.ceil(file.size / chunkSize); 
            const parts = [];

            for(let i=0; i<chunks; i++){
                const chunk = file.slice(i * chunkSize, (i+1) * chunkSize);
                const res = await fetch(`${acc.api}/upload/part?uploadId=${start.uploadId}&partNumber=${i+1}&key=${start.key}`,{
                    method:'POST',
                    headers:{"Authorization":PASS},
                    body:chunk
                });
                const partData = await res.json();
                parts.push({partNumber:i+1, etag:partData.etag});
                
                let pc = Math.round((i+1)/chunks*100);
                pFill.style.width = pc + "%";
                status.innerText = `📤 Đang tải lên: ${pc}%`;
            }

            status.innerText = "⚙️ Đang xử lý metadata...";
            await fetch(`${acc.api}/upload/complete`,{
                method:'POST',
                headers:{"Authorization":PASS},
                body:JSON.stringify({
                    uploadId:start.uploadId,
                    key:start.key,
                    parts,
                    appData:{
                        id,
                        name:info.CFBundleDisplayName || info.CFBundleName,
                        bundleId:info.CFBundleIdentifier,
                        version:info.CFBundleShortVersionString,
                        build:info.CFBundleVersion,
                        executable:info.CFBundleExecutable,
                        minOs:info.MinimumOSVersion,
                        size:(file.size/1024/1024).toFixed(1)+" MB",
                        icon:info.icon,
                        certName:team
                    }
                })
            });
            
            pBox.style.display='none';
            status.innerText = "✅ Upload hoàn tất!";
            input.value = ""; // FIX: RESET INPUT ĐỂ CÓ THỂ CHỌN LẠI FILE ĐÓ
            setTimeout(() => { status.innerText = "➕ Tải IPA lên " + acc.name; }, 3000);
            loadData(idx);
        } catch(e) {
            alert("Lỗi Upload: " + e.message);
            status.innerText = "❌ Lỗi Upload!";
            pBox.style.display='none';
        }
    }

    let NEW_ICON = "";
    function previewIcon(i){ 
        const r=new FileReader(); 
        r.onload=(e)=>{
            NEW_ICON=e.target.result; 
            document.getElementById('edit-preview').src=NEW_ICON;
        }; 
        r.readAsDataURL(i.files[0]); 
    }

    function openEdit(idx, a){
        document.getElementById('edit-acc-idx').value = idx;
        document.getElementById('edit-id').value = a.id;
        document.getElementById('edit-name').value = a.name;
        document.getElementById('edit-filename').value = a.fileName;
        document.getElementById('edit-cert').value = a.certName;
        document.getElementById('edit-preview').src = a.icon; 
        NEW_ICON = "";
        document.getElementById('edit-modal').style.display = 'flex';
    }

    function closeEdit(){ document.getElementById('edit-modal').style.display = 'none'; }

    async function saveEdit(){
        const idx = document.getElementById('edit-acc-idx').value;
        const d = { 
            id: document.getElementById('edit-id').value, 
            name: document.getElementById('edit-name').value, 
            newFileName: document.getElementById('edit-filename').value, 
            certName: document.getElementById('edit-cert').value, 
            newIcon: NEW_ICON 
        };
        await fetch(`${ACCOUNTS[idx].api}/upload/edit`, {
            method:'POST', 
            headers:{"Authorization":PASS,"Content-Type":"application/json"}, 
            body:JSON.stringify(d)
        });
        location.reload();
    }

    function reup(idx, id){ 
        const i=document.createElement('input'); 
        i.type='file'; 
        i.accept='.ipa'; 
        i.onchange=(e)=>upFile(i, idx, id); 
        i.click(); 
    }

    async function del(idx, id){ 
        if(confirm("Xác nhận xóa ứng dụng này?")){ 
            await fetch(`${ACCOUNTS[idx].api}/delete?id=${id}`,{method:'DELETE',headers:{"Authorization":PASS}}); 
            loadData(idx); 
        } 
    }

    function copy(t){ 
        navigator.clipboard.writeText(t); 
        alert("Đã copy liên kết!"); 
    }
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

*Phát triển bởi **Gemini AI** & **KhoiNDVN***

> Nếu thấy hữu ích, hãy ⭐ Star repo này để ủng hộ!
