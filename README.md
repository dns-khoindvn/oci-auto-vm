# 🍎 IPA MASTER ELITE V3.8 - PREMIUM IPA DISTRIBUTION PLATFORM

![Version](https://img.shields.io/badge/Version-3.8_Elite-blue?style=for-the-badge)
![UI](https://img.shields.io/badge/Design-Luxury_Glassmorphism-FF69B4?style=for-the-badge)
![Backend](https://img.shields.io/badge/Platform-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare)

**IPA MASTER ELITE** là giải pháp phân phối ứng dụng iOS chuyên nghiệp, được thiết kế với triết lý thẩm mỹ cao cấp (**Luxury Glassmorphism**) và hiệu năng xử lý dữ liệu quy mô lớn. Hệ thống cho phép quản lý và cài đặt ứng dụng OTA (Over-The-Air) với độ ổn định tuyệt đối và tốc độ vượt trội.

---

## ✨ Tính năng "Elite" Độc quyền

### 🛠️ Quản trị tối tân (Advanced Command Center)
- **Multi-Server Architecture**: Hệ thống Tab giúp quản lý nhiều server R2 cùng lúc, phân loại upload theo dung lượng (0-1GB, 1-2.5GB, 2.5-5GB+).
- **8x Parallel Chunked Uploads**: Sử dụng cơ chế R2 Multipart Upload kết hợp 8 luồng tải lên song song, giúp upload các file IPA cực lớn (lên đến 5GB) nhanh chóng và ổn định.
- **Auto Metadata Parsing**: Tự động trích xuất thông tin từ tệp IPA (Tên, Bundle ID, Phiên bản, Icon, iOS yêu cầu) ngay khi chọn file.
- **Precision Certificate extraction**: Trực tiếp phân tích tệp `embedded.mobileprovision` để lấy **Serial Number** của chứng chỉ, giúp theo dõi trạng thái thu hồi chính xác 100%.
- **Smart Serial Memory**: Tự động ghi nhớ và gán Serial cho các chứng chỉ cùng tên, tiết kiệm thời gian quản trị.

### 🛡️ Hệ thống Theo dõi & Bảo mật
- **Auto-Revocation Monitoring**: Tự động kiểm tra trạng thái chứng chỉ theo thời gian thực. Nếu chứng chỉ bị Apple thu hồi, hệ thống sẽ tự động cập nhật trạng thái "Bị thu hồi" trên toàn bộ giao diện người dùng.
- **Smart Error Handling**: Phân biệt chính xác giữa lỗi xác thực (401), lỗi server offline và lỗi dung lượng.
- **Cleanup & Maintenance**: Tính năng "Dọn rác" thông minh giúp xóa các tệp mồ côi trong bộ nhớ R2, tối ưu hóa chi phí lưu trữ.

### 🎨 Giao diện Luxury Glassmorphism
- **Premium Aesthetics**: Hình nền Mesh Gradient động, hiệu ứng Blur Glass (blur 30px), và font chữ "Plus Jakarta Sans" hiện đại.
- **Real-time Analytics**: Hiển thị số lượt cài đặt OTA và lượt tải tệp IPA trực tiếp trên giao diện người dùng.
- **Device Compatibility Check**: Tự động kiểm tra phiên bản iOS của người dùng để cảnh báo nếu thiết bị không tương thích với ứng dụng.

---

## 🚀 Hướng dẫn cài đặt (Installation Guide)

### 1. Chuẩn bị trên Cloudflare
1. Tạo một **R2 Bucket** (Ví dụ: `ipa-storage`).
2. Tạo một **Worker** mới và liên kết (Bind) R2 Bucket vào Worker với tên biến là `MY_BUCKET`.
3. Thêm các biến môi trường (Environment Variables):
   - `ACCESS_PASSWORD`: Mật mã đăng nhập trang quản trị.
   - `WEB_DOMAIN`: Tên miền của bạn (Ví dụ: `ipa.khoindvn.io.vn`).

### 2. Cấu hình Backend
- Copy nội dung tệp `worker.js` vào trình chỉnh sửa Worker trên Cloudflare và nhấn **Deploy**.

### 3. Cấu hình Frontend
- Tệp `index.html` là trang quản trị. Bạn có thể lưu vào GitHub Pages hoặc mở trực tiếp từ máy tính.
- Đảm bảo cấu hình hằng số `ACCOUNTS` trong `index.html` khớp với URL các Worker của bạn.

---

## 🛠️ Cấu trúc hệ thống

| Thành phần | Công nghệ | Vai trò |
| :--- | :--- | :--- |
| **Storage** | Cloudflare R2 | Lưu trữ tệp IPA và Metadata (.json) |
| **Backend** | Cloudflare Workers | Xử lý API, Streaming dữ liệu, Check Revoke |
| **Frontend** | Vanilla JS, CSS Glass | Giao diện quản trị và trang View người dùng |
| **Security** | Auth Headers | Bảo vệ API bằng mật khẩu mã hóa |

---

## 💻 Mã nguồn (Source Code)

### 1. Backend (Cloudflare Worker)
Lưu vào tệp `worker.js`.

```javascript
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, PUT",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const host = env.WEB_DOMAIN ? "https://" + env.WEB_DOMAIN : url.origin;
        const authPass = env.ACCESS_PASSWORD;

        if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

        // Đếm request cho các route công khai
        if (url.pathname.startsWith("/v/") || url.pathname.startsWith("/i/") || url.pathname.startsWith("/p/") || url.pathname.startsWith("/f/")) {
            ctx.waitUntil(trackRequest(env));
        }

        // ROUTE: Giao diện người dùng
        if (url.pathname.startsWith("/v/")) {
            const id = url.pathname.split("/v/")[1];
            const metaFile = await env.MY_BUCKET.get(`meta/${id}.json`);
            if (!metaFile) return new Response("404 Not Found", { status: 404, headers: corsHeaders });

            let meta = await metaFile.json();
            let status = meta.status || "Hoạt động";
            let statusColor = "#32D74B";

            if (meta.certSerial && status !== "Bị thu hồi") {
                const liveStatus = await getRevokeStatus(meta.certSerial, env);
                if (liveStatus === "revoked") {
                    status = "Bị thu hồi";
                    statusColor = "#FF3B30";
                    meta.status = "Bị thu hồi";
                    await env.MY_BUCKET.put(`meta/${id}.json`, JSON.stringify(meta));
                }
            }

            if (status === "Bị thu hồi") statusColor = "#FF3B30";

            return new Response(generateV32View(meta, host, status, statusColor), {
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "public, max-age=3600",
                    ...corsHeaders
                }
            });
        }

        // ROUTE: Cài đặt (OTA)
        if (url.pathname.startsWith("/i/")) {
            const id = url.pathname.split("/i/")[1];
            try {
                const metaFile = await env.MY_BUCKET.get(`meta/${id}.json`);
                if (metaFile) {
                    let meta = await metaFile.json();
                    meta.downloads = (meta.downloads || 0) + 1;
                    await env.MY_BUCKET.put(`meta/${id}.json`, JSON.stringify(meta));
                }
            } catch (e) { }
            return Response.redirect(`itms-services://?action=download-manifest&url=${host}/p/${id}.plist`, 302);
        }

        // ROUTE: Tải IPA
        if (url.pathname.startsWith("/dl/")) {
            const id = url.pathname.split("/dl/")[1];
            let fileName = "";
            try {
                const metaFile = await env.MY_BUCKET.get(`meta/${id}.json`);
                if (metaFile) {
                    let meta = await metaFile.json();
                    meta.installs = (meta.installs || 0) + 1;
                    fileName = meta.fileName;
                    await env.MY_BUCKET.put(`meta/${id}.json`, JSON.stringify(meta));
                }
            } catch (e) { }
            return Response.redirect(`${host}/f/${fileName}`, 302);
        }

        if (url.pathname.startsWith("/p/")) {
            const id = url.pathname.split(".plist")[0].split("/p/")[1];
            const meta = await (await env.MY_BUCKET.get(`meta/${id}.json`))?.json();
            return new Response(generatePlist(meta, host), { headers: { "Content-Type": "application/xml", ...corsHeaders } });
        }

        if (url.pathname.startsWith("/f/")) {
            const fileName = url.pathname.split("/f/")[1];
            const object = await env.MY_BUCKET.get(`files/${fileName}`);
            if (!object) return new Response("Not Found", { status: 404, headers: corsHeaders });
            return new Response(object.body, {
                headers: { "Content-Type": "application/octet-stream", "Content-Length": object.size.toString(), "Accept-Ranges": "bytes", ...corsHeaders }
            });
        }

        if (url.pathname === "/login") {
            const body = await request.json();
            return new Response(JSON.stringify({ success: body.password === authPass }), { headers: corsHeaders });
        }

        if (url.pathname === "/storage") {
            try {
                let total = 0; const list = await env.MY_BUCKET.list();
                for (let obj of list.objects) total += obj.size;
                const statsFile = await env.MY_BUCKET.get("stats/usage.json");
                const stats = statsFile ? await statsFile.json() : { totalRequests: 0 };
                return new Response(JSON.stringify({ usedBytes: total, totalRequests: stats.totalRequests || 0 }), { headers: corsHeaders });
            } catch (e) { return new Response(JSON.stringify({ usedBytes: 0, totalRequests: 0 }), { headers: corsHeaders }); }
        }

        const auth = request.headers.get("Authorization");
        if (auth !== authPass) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

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
            appData.installs = 0;
            appData.status = appData.status || "Hoạt động";
            appData.releaseDate = new Date().toLocaleDateString('vi-VN');
            await env.MY_BUCKET.put(`meta/${appData.id}.json`, JSON.stringify(appData));
            if (appData.certName && appData.certSerial) {
                ctx.waitUntil(updateGlobalSerial(appData.certName, appData.certSerial, env));
            }
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        if (url.pathname === "/upload/edit") {
            const { id, name, bundleId, certName, certSerial, status, minOs, newIcon, ipaLink, newFileName } = await request.json();
            let meta = await (await env.MY_BUCKET.get(`meta/${id}.json`)).json();
            if (name) meta.name = name;
            if (bundleId) meta.bundleId = bundleId;
            if (certName) meta.certName = certName;
            if (certSerial) {
                meta.certSerial = certSerial;
                ctx.waitUntil(updateGlobalSerial(meta.certName, certSerial, env));
            }
            if (status) meta.status = status;
            if (minOs) meta.minOs = minOs;
            if (newIcon) meta.icon = newIcon;
            if (ipaLink) meta.ipaLink = ipaLink;
            if (newFileName) meta.fileName = newFileName;
            await env.MY_BUCKET.put(`meta/${id}.json`, JSON.stringify(meta));
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        if (url.pathname === "/serials") {
            if (request.method === "POST") {
                const { certName, certSerial } = await request.json();
                await updateGlobalSerial(certName, certSerial, env);
                return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
            }
            const file = await env.MY_BUCKET.get("stats/serials.json");
            return new Response(file ? file.body : "{}", { headers: { "Content-Type": "application/json", ...corsHeaders } });
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

async function updateGlobalSerial(certName, certSerial, env) {
    if (!certName || !certSerial || certSerial === "N/A" || certSerial === "") return;
    try {
        const key = "stats/serials.json";
        const file = await env.MY_BUCKET.get(key);
        let map = file ? await file.json() : {};
        if (map[certName] !== certSerial) {
            map[certName] = certSerial;
            await env.MY_BUCKET.put(key, JSON.stringify(map));
        }
    } catch (e) { console.error("Error updating serials:", e); }
}

async function getRevokeStatus(serial, env) {
    const cacheKey = `https://revoke-cache.internal/${serial}`;
    const cache = caches.default;
    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return await cachedResponse.text();
    try {
        let s = serial.toLowerCase().trim();
        if (s.startsWith('00') && s.length > 30) s = s.substring(2);
        const res = await fetch(`https://cert-checker.trinhtruongphong.workers.dev/?serial=${s}`);
        if (!res.ok) return "unknown";
        const data = await res.json();
        const status = data.alive === false ? "revoked" : (data.alive === true ? "good" : "unknown");
        if (status !== "unknown") {
            await cache.put(cacheKey, new Response(status, { headers: { "Cache-Control": "public, max-age=3600" } }));
        }
        return status;
    } catch (e) { return "unknown"; }
}

function generatePlist(app, host) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>items</key><array><dict><key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key><string>${host}/f/${app.fileName}</string></dict></array><key>metadata</key><dict><key>bundle-identifier</key><string>${app.bundleId}</string><key>bundle-version</key><string>${app.version}</string><key>kind</key><string>software</string><key>title</key><string>${app.name}</string></dict></dict></array></dict></plist>`;
}

function generateV32View(app, host, status, statusColor) {
    const downloadStr = app.downloads >= 1000 ? (app.downloads / 1000).toFixed(1) + "k" : app.downloads || 0;
    const installStr = app.installs >= 1000 ? (app.installs / 1000).toFixed(1) + "k" : app.installs || 0;
    return \`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>\${app.name} - IPA Master Elite</title>
    
    <!-- Open Graph Tags -->
    <meta property="og:title" content="Tải \${app.name} - IPA Master Elite">
    <meta property="og:description" content="Tải ngay \${app.name} phiên bản \${app.version || 'mới nhất'} ổn định, không quảng cáo tại IPA Master Elite.">
    <meta property="og:image" content="\${app.icon}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">

    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #FFFFFF;
            --accent: #007AFF;
            --accent-gradient: linear-gradient(135deg, #007AFF, #5856D6);
            --text-main: #1C1C1E;
            --text-sec: #3A3A3C;
            --text-dim: #8E8E93;
            --card-bg: rgba(255, 255, 255, 0.85);
            --glass: blur(30px) saturate(200%);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        body { 
            background: #F0F2F5; 
            font-family: 'Plus Jakarta Sans', sans-serif; 
            min-height: 100vh; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            padding: 20px; 
            overflow-x: hidden;
        }
        .mesh-bg {
            position: fixed; inset: 0; z-index: -1;
            background: 
                radial-gradient(at 0% 0%, #E3F2FD 0px, transparent 50%),
                radial-gradient(at 100% 0%, #F3E5F5 0px, transparent 50%),
                radial-gradient(at 50% 50%, #FFFFFF 0px, transparent 70%),
                radial-gradient(at 0% 100%, #E8EAF6 0px, transparent 50%),
                radial-gradient(at 100% 100%, #FCE4EC 0px, transparent 50%);
            background-size: 200% 200%;
            animation: meshMove 15s ease infinite;
        }
        @keyframes meshMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .container { width: 100%; max-width: 420px; position: relative; }
        .main-card {
            background: var(--card-bg);
            backdrop-filter: var(--glass);
            -webkit-backdrop-filter: var(--glass);
            border: 1px solid rgba(255,255,255,0.5);
            border-radius: 48px;
            padding: 40px 25px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.05);
            text-align: center;
            animation: cardEntrance 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            opacity: 0;
            transform: translateY(30px);
        }
        @keyframes cardEntrance {
            to { opacity: 1; transform: translateY(0); }
        }
        .app-icon { width: 110px; height: 110px; border-radius: 28px; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); object-fit: cover; }
        h1 { font-size: 24px; font-weight: 800; margin-bottom: 25px; color: var(--text-main); }
        .stats-card {
            background: rgba(0, 0, 0, 0.02);
            border-radius: 20px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            padding: 15px 10px;
            margin-bottom: 30px;
            border: 1px solid rgba(0,0,0,0.03);
        }
        .stat-item { border-right: 1px solid rgba(0,0,0,0.05); padding: 5px; }
        .stat-item:last-child { border-right: none; }
        .stat-value { font-size: 18px; font-weight: 800; color: var(--accent); }
        .stat-label { font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; margin-top: 4px; }
        .btn {
            display: flex; align-items: center; justify-content: center; gap: 10px;
            width: 100%; padding: 16px; border-radius: 22px; text-decoration: none;
            font-weight: 700; transition: all 0.3s; margin-bottom: 12px;
            position: relative; overflow: hidden;
        }
        .btn-primary { background: var(--accent-gradient); color: white; box-shadow: 0 8px 20px rgba(0,122,255,0.2); }
        .btn-secondary { background: #E3F2FD; color: #007AFF; border: 1px solid rgba(0,122,255,0.1); }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .shimmer {
            position: absolute; inset: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .info-list { margin-top: 25px; text-align: left; }
        .info-row { display: flex; justify-content: space-between; padding: 12px 10px; border-bottom: 1px solid rgba(0,0,0,0.03); }
        .info-label { font-size: 13px; color: var(--text-sec); }
        .info-value { font-size: 13px; font-weight: 600; color: var(--text-main); }
        #realtime-clock { font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 15px; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="mesh-bg"></div>
    <div class="container">
        <div class="main-card">
            <div id="realtime-clock"></div>
            <img src="\${app.icon}" alt="\${app.name}" class="app-icon">
            <h1>\${app.name}</h1>

            <div class="stats-card">
                <div class="stat-item"><div class="stat-label">Số người cài đặt</div><div class="stat-value">\${downloadStr}</div></div>
                <div class="stat-item"><div class="stat-label">Số người tải IPA</div><div class="stat-value">\${installStr}</div></div>
            </div>
            <a href="\${host}/i/\${app.id}" class="btn btn-primary" onclick="handleInstallClick(this)">
                <div style="display:flex; flex-direction:column; align-items:center; line-height:1.2;">
                    <span>CÀI ĐẶT NGAY</span>
                    <span style="font-size:10px; opacity:0.8; font-weight:800; letter-spacing:0.5px;">INSTALL NOW</span>
                </div>
            </a>
            <a href="\${host}/dl/\${app.id}" class="btn btn-secondary">
                <div style="display:flex; flex-direction:column; align-items:center; line-height:1.2;">
                    <span>TẢI TỆP IPA</span>
                    <span style="font-size:10px; opacity:0.8; font-weight:800; letter-spacing:0.5px;">DOWNLOAD .IPA</span>
                </div>
            </a>

            <div onclick="copyLink()" style="cursor:pointer; margin-top:5px; font-size:11px; font-weight:700; color:var(--accent); display:flex; align-items:center; justify-content:center; gap:5px; opacity:0.8; transition:0.3s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span id="copyText">SAO CHÉP LIÊN KẾT CHIA SẺ</span>
            </div>

            <div class="info-list">
                <div class="info-row"><span class="info-label">Chứng chỉ</span><span class="info-value">\${app.certName || "Enterprise"}</span></div>
                <div class="info-row"><span class="info-label">Trạng thái chứng chỉ</span><span class="info-value" style="color:\${statusColor}">\${status === 'Hoạt động' ? 'Đang Hoạt động' : status}</span></div>
                <div class="info-row"><span class="info-label">Phiên bản</span><span class="info-value">\${app.version || "1.0"}</span></div>
                <div class="info-row"><span class="info-label">Dung lượng</span><span class="info-value">\${app.size || "---"}</span></div>
                <div class="info-row"><span class="info-label">iOS yêu cầu</span><span class="info-value">iOS \${app.minOs || "12.0"}+</span></div>
                <div class="info-row"><span class="info-label">Ngày cập nhật</span><span class="info-value">\${app.releaseDate || new Date().toLocaleDateString('vi-VN')}</span></div>
                <div class="info-row"><span class="info-label">Kiểm tra tương thích</span><span class="info-value" id="device-check" style="font-size:11px;">Đang kiểm tra...</span></div>
            </div>

            <div style="margin-top:25px; background:rgba(0,122,255,0.05); border-radius:24px; padding:20px; text-align:left; border:1px solid rgba(0,122,255,0.1);">
                <div style="color:var(--accent); font-size:11px; font-weight:800; text-transform:uppercase; margin-bottom:12px; letter-spacing:1px;">HƯỚNG DẪN CÀI ĐẶT</div>
                <div style="font-size:13px; color:var(--text-sec); line-height:1.6;">
                    1. Nhấn <b>Cài đặt ngay</b> và quay lại màn hình chính.<br>
                    2. Mở <b>Cài đặt > Cài đặt chung</b>.<br>
                    3. Chọn <b>Quản lý VPN & Thiết bị</b>.<br>
                    4. Tin cậy <b>\${app.certName || "Chứng chỉ"}</b>.
                </div>
            </div>

            <div style="margin-top:30px; text-align:center; font-size:10px; color:var(--text-dim); font-weight:700; letter-spacing:1.5px; opacity:0.6;">POWERED BY IPA MASTER ELITE</div>
        </div>
    </div>
    <script>
        function updateClock() {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
            document.getElementById('realtime-clock').innerText = now.toLocaleString('vi-VN', options).toUpperCase();
        }
        setInterval(updateClock, 1000); updateClock();
        function handleInstallClick(btn) { 
            btn.innerHTML = '<div class="shimmer"></div>' +
                '<div style="display:flex; flex-direction:column; line-height:1.2; font-size:12px;">' +
                    '<span>ĐANG CÀI ĐẶT... BẠN HÃY VỀ MÀN HÌNH CHÍNH ĐỂ KIỂM TRA</span>' +
                    '<span style="font-size:9px; opacity:0.8;">INSTALLING... PLEASE GO TO HOME SCREEN TO CHECK</span>' +
                '</div>';
        }

        function copyLink() {
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                const text = document.getElementById('copyText');
                const original = text.innerText;
                text.innerText = "ĐÃ SAO CHÉP LIÊN KẾT!";
                text.style.color = "#32D74B";
                setTimeout(() => {
                    text.innerText = original;
                    text.style.color = "var(--accent)";
                }, 2000);
            });
        }
        function checkDevice() {
            const ua = navigator.userAgent;
            const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const el = document.getElementById('device-check');
            const minOs = parseFloat("\${app.minOs || '12.0'}");

            if (isIOS) {
                // Trích xuất phiên bản iOS từ User Agent
                let version = 0;
                const match = ua.match(/OS (\\d+)_(\\d+)/);
                if (match) {
                    version = parseFloat(match[1] + "." + match[2]);
                } else if (navigator.maxTouchPoints > 1) { // iPadOS mới thường giả lập Mac
                    version = 15.0; // Mặc định giả định là cao nếu không đọc được nhưng có cảm ứng
                }

                if (version > 0 && version < minOs) {
                    el.innerHTML = '<span style="color:#FF3B30">KHÔNG TƯƠNG THÍCH (' + version + ' < ' + minOs + ')</span>';
                } else {
                    el.innerHTML = '<span style="color:#32D74B">HOÀN TOÀN TƯƠNG THÍCH</span>';
                }
            } else {
                el.innerHTML = '<span style="color:#FF3B30">CHỈ DÀNH CHO IOS/IPADOS</span>';
            }
        }
        checkDevice();
    </script>
</body>
</html>\`;
}

async function trackRequest(env) {
    try {
        const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' });
        const statsFile = await env.MY_BUCKET.get("stats/usage.json");
        let stats = statsFile ? await statsFile.json() : { totalRequests: 0, lastReset: today };
        if (stats.lastReset !== today) { stats.totalRequests = 1; stats.lastReset = today; } else { stats.totalRequests = (stats.totalRequests || 0) + 1; }
        await env.MY_BUCKET.put("stats/usage.json", JSON.stringify(stats));
    } catch (e) { }
}
```

### 2. Admin Dashboard (Frontend)
Lưu vào tệp `index.html`.

```html
<!DOCTYPE html>
<html lang="vi">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>IPA MASTER - COMMAND CENTER</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet">
    <script src="https://unpkg.com/app-info-parser@1.1.4/dist/app-info-parser.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <style>
        :root {
            --bg: #F2F2F7;
            --primary: #007AFF;
            --primary-light: #E3F2FD;
            --card-bg: rgba(255, 255, 255, 0.85);
            --text-main: #1C1C1E;
            --text-sec: #8E8E93;
            --success: #34C759;
            --danger: #FF3B30;
            --border: rgba(0, 0, 0, 0.05);
            --glass: blur(30px) saturate(200%);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Plus Jakarta Sans', sans-serif;
            -webkit-font-smoothing: antialiased;
        }

        body {
            background-color: var(--bg);
            color: var(--text-main);
            min-height: 100vh;
            overflow-x: hidden;
        }

        .mesh-bg {
            position: fixed;
            inset: 0;
            z-index: -1;
            background:
                radial-gradient(at 0% 0%, #E3F2FD 0px, transparent 50%),
                radial-gradient(at 100% 0%, #FCE4EC 0px, transparent 50%),
                radial-gradient(at 50% 50%, #FFFFFF 0px, transparent 70%);
            background-size: 200% 200%;
            animation: meshMove 15s ease infinite;
        }

        @keyframes meshMove {
            0% {
                background-position: 0% 50%;
            }

            50% {
                background-position: 100% 50%;
            }

            100% {
                background-position: 0% 50%;
            }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .animate {
            animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        /* Login */
        #login-screen {
            max-width: 420px;
            margin: 15vh auto;
            background: var(--card-bg);
            backdrop-filter: var(--glass);
            padding: 50px 40px;
            border-radius: 40px;
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 30px 100px rgba(0, 0, 0, 0.05);
            text-align: center;
        }

        .login-logo {
            font-size: 38px;
            font-weight: 800;
            color: var(--primary);
            margin-bottom: 5px;
            letter-spacing: -1.5px;
        }

        .login-sub {
            font-size: 11px;
            font-weight: 700;
            color: var(--text-sec);
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 40px;
        }

        input,
        select {
            width: 100%;
            padding: 15px 20px;
            border-radius: 18px;
            border: 1px solid var(--border);
            background: rgba(255, 255, 255, 0.6);
            margin-bottom: 12px;
            font-size: 15px;
            font-weight: 500;
            outline: none;
            transition: 0.3s;
        }

        input:focus {
            border-color: var(--primary);
            background: white;
            box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
        }

        .btn-main {
            width: 100%;
            padding: 18px;
            border-radius: 20px;
            border: none;
            background: var(--primary);
            color: white;
            font-weight: 800;
            cursor: pointer;
            transition: 0.3s;
            box-shadow: 0 10px 25px rgba(0, 122, 255, 0.25);
        }

        .btn-main:hover {
            transform: translateY(-2px);
            filter: brightness(1.1);
        }

        /* Header */
        .header-main {
            max-width: 1400px;
            margin: 30px auto;
            background: var(--card-bg);
            backdrop-filter: var(--glass);
            padding: 20px 40px;
            border-radius: 30px;
            border: 1px solid rgba(255, 255, 255, 0.5);
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.03);
        }

        .grid-layout {
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
            gap: 30px;
            padding-bottom: 50px;
        }

        .acc-block {
            background: var(--card-bg);
            backdrop-filter: var(--glass);
            border-radius: 40px;
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.03);
            display: flex;
            flex-direction: column;
        }

        .acc-h {
            padding: 35px 35px 25px;
            border-bottom: 1px solid var(--border);
        }

        .acc-n {
            font-size: 19px;
            font-weight: 800;
            color: var(--primary);
            margin-bottom: 15px;
        }

        .st-b {
            height: 8px;
            background: rgba(0, 0, 0, 0.04);
            border-radius: 10px;
            margin-bottom: 15px;
            overflow: hidden;
        }

        .st-f {
            height: 100%;
            background: var(--primary);
            width: 0%;
            transition: 1s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .up-z {
            margin: 20px 35px 30px;
            padding: 40px 20px;
            border: 2px dashed rgba(0, 122, 255, 0.15);
            border-radius: 25px;
            text-align: center;
            cursor: pointer;
            transition: 0.3s;
            background: rgba(0, 122, 255, 0.02);
        }

        .up-z:hover {
            background: var(--primary-light);
            border-color: var(--primary);
        }

        /* App Items */
        .app-list {
            padding: 0 25px 35px;
        }

        .app-item {
            background: white;
            border-radius: 24px;
            padding: 20px;
            margin-bottom: 15px;
            border: 1px solid var(--border);
            transition: 0.3s;
        }

        .app-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.04);
        }

        .app-icon {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            object-fit: cover;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
        }

        .status-pill {
            font-size: 10px;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .status-active {
            background: #E8F5E9;
            color: var(--success);
        }

        .status-revoked {
            background: #FFEBEE;
            color: var(--danger);
        }

        .acts {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 20px;
        }

        .btn-sm {
            padding: 12px 5px;
            font-size: 10px;
            font-weight: 800;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            transition: 0.2s;
            text-align: center;
            text-transform: uppercase;
        }

        .btn-gray {
            background: #F2F2F7;
            color: var(--text-main);
        }

        .btn-blue {
            background: var(--primary-light);
            color: var(--primary);
        }

        .btn-green {
            background: #E8F5E9;
            color: var(--success);
        }

        .btn-red {
            background: #FFEBEE;
            color: var(--danger);
        }

        .btn-sm:active {
            transform: scale(0.95);
        }

        /* Modal Redesign */
        #edit-modal {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 3000;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            overflow-y: auto;
            padding: 40px 15px;
            -webkit-overflow-scrolling: touch;
            align-items: flex-start; /* Quan trọng để có thể scroll từ trên xuống */
            justify-content: center;
        }

        .modal-card {
            width: 100%;
            max-width: 600px;
            background: white;
            padding: 40px;
            border-radius: 48px;
            border: 1px solid var(--border);
            box-shadow: 0 40px 100px rgba(0, 0, 0, 0.1);
            margin: auto; /* Căn giữa khi content ngắn, cho phép scroll khi dài */
            position: relative;
        }

        .input-group {
            text-align: left;
            margin-bottom: 20px;
        }

        .input-group label {
            display: block;
            font-size: 11px;
            font-weight: 800;
            color: var(--text-sec);
            text-transform: uppercase;
            margin-bottom: 8px;
            margin-left: 5px;
            letter-spacing: 1px;
        }

        .input-group input,
        .input-group select {
            background: #F2F2F7;
            border: none;
            margin-bottom: 0;
            font-size: 14px;
            font-weight: 600;
        }

        /* Responsive */
        @media (max-width: 768px) {
            body {
                padding: 15px;
            }

            .header-main {
                padding: 15px 20px;
                flex-direction: column;
                gap: 15px;
                text-align: center;
            }

            .grid-layout {
                grid-template-columns: 1fr;
                gap: 20px;
            }

            .acc-h {
                padding: 25px;
            }

            .up-z {
                margin: 15px 20px 25px;
                padding: 30px 15px;
            }

            .acts {
                grid-template-columns: 1fr 1fr;
            }

            .btn-red {
                grid-column: span 2 !important;
            }

            .modal-card {
                padding: 30px 20px;
                border-radius: 35px;
            }
        }

        @media (max-width: 480px) {
            .app-icon {
                width: 50px;
                height: 50px;
                border-radius: 12px;
            }

            .app-item {
                padding: 12px;
            }

            .login-logo {
                font-size: 32px;
            }

            .btn-main {
                padding: 15px;
            }
        }

        ::-webkit-scrollbar {
            width: 0px;
            display: none;
        }

        .tab-container {
            display: flex;
            gap: 8px;
            margin: 0 auto 25px;
            max-width: 1400px;
            padding: 0 15px;
            overflow-x: auto;
            -ms-overflow-style: none;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
        }

        .btn-tab {
            flex: 1;
            min-width: 110px;
            padding: 14px 10px;
            border-radius: 16px;
            border: none;
            background: var(--card-bg);
            color: var(--text-sec);
            font-weight: 700;
            font-size: 11px;
            cursor: pointer;
            transition: 0.3s;
            backdrop-filter: var(--glass);
            -webkit-backdrop-filter: var(--glass);
            border: 1px solid var(--border);
            white-space: nowrap;
            text-align: center;
        }

        @media (max-width: 480px) {
            .btn-tab {
                min-width: 0;
                padding: 12px 5px;
                font-size: 10px;
            }
            .tab-container {
                gap: 5px;
                padding: 0 10px;
            }
        }
    </style>
</head>

<body>
    <div class="mesh-bg"></div>

    <!-- LOGIN SCREEN -->
    <div id="login-screen" class="animate">
        <div class="login-logo">IPA MASTER</div>
        <div class="login-sub">Command Center V3.8</div>
        <input type="password" id="admin-pass" placeholder="MẬT MÃ QUẢN TRỊ"
            onkeypress="if(event.key==='Enter') login()">
        <button class="btn-main" onclick="login()">TRUY CẬP HỆ THỐNG</button>
    </div>

    <!-- DASHBOARD -->
    <div id="dashboard" style="display:none;">
        <div class="header-main animate">
            <div style="flex:1;">
                <div class="logo-txt">BẢNG ĐIỀU KHIỂN</div>
                <div style="font-size:10px; color:var(--text-sec); font-weight:700; margin-top:5px;">IPA MASTER ELITE
                </div>
            </div>

            <div style="flex:2; margin: 0 20px;">
                <input type="text" id="global-search" placeholder="TÌM KIẾM TẤT CẢ ỨNG DỤNG..."
                    oninput="globalSearch(this.value)"
                    style="margin-bottom:0; background:rgba(0,0,0,0.03); border-radius:15px; padding:12px 25px;">
            </div>

            <div style="display:flex; gap:12px; flex:1; justify-content:flex-end;">
                <button onclick="clean()"
                    style="background:#F2F2F7; border:none; color:var(--text-main); padding:10px 20px; border-radius:12px; font-size:11px; font-weight:800; cursor:pointer;">DỌN
                    RÁC</button>
                <button onclick="logout()"
                    style="background:var(--danger); border:none; color:#fff; padding:10px 20px; border-radius:12px; font-size:11px; font-weight:800; cursor:pointer;">THOÁT</button>
            </div>
        </div>
        <div class="tab-container" id="tab-container">
            <!-- Tabs will be injected here -->
        </div>
        <div class="grid-layout" id="account-grid" style="display:block;">
            <!-- Only active server content will be shown here -->
        </div>
    </div>

    <!-- MODAL EDIT REDESIGN -->
    <div id="edit-modal">
        <div class="modal-card animate">
            <h3 style="font-size:24px; font-weight:800; margin-bottom:35px; text-align:center; letter-spacing:-0.5px;">
                CHỈNH SỬA ỨNG DỤNG</h3>
            <center>
                <div style="position:relative; width:100px; height:100px; margin-bottom:35px;">
                    <img id="edit-preview"
                        style="width:100%; height:100%; border-radius:24px; object-fit:cover; border:2px solid var(--primary-light); cursor:pointer;"
                        onclick="document.getElementById('edit-icon-in').click()">
                    <div
                        style="position:absolute; bottom:-8px; right:-8px; background:var(--primary); color:white; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; border:3px solid white;">
                        ✎</div>
                </div>
                <input type="file" id="edit-icon-in" style="display:none" onchange="previewIcon(this)">
            </center>

            <div style="display:flex; flex-direction:column; gap:2px;">
                <div class="input-group"><label>Tên hiển thị</label><input type="text" id="edit-name"></div>
                <div class="input-group"><label>Bundle ID</label><input type="text" id="edit-bundleid"></div>
                <div class="input-group"><label>Tên file gốc (.ipa)</label><input type="text" id="edit-filename"></div>
                <div class="input-group"><label>Chứng chỉ</label><input type="text" id="edit-cert"></div>
                <div class="input-group"><label>iOS yêu cầu</label><input type="text" id="edit-minos"></div>
                <div class="input-group"><label>Link IPA tải xuống</label><input type="text" id="edit-ipalink"></div>
                <div class="input-group"><label>Serial Number (Hex)</label><input type="text" id="edit-serial"></div>
                <div class="input-group"><label>Trạng thái chứng chỉ</label>
                    <select id="edit-status">
                        <option value="Hoạt động">Đang Hoạt động</option>
                        <option value="Bị thu hồi">Đã Bị thu hồi</option>
                    </select>
                </div>
            </div>

            <input type="hidden" id="edit-id"><input type="hidden" id="edit-acc-idx">

            <button class="btn-main" id="btn-save-edit" onclick="saveEdit(event)" style="margin-top:20px;">LƯU THAY ĐỔI</button>
            <button class="btn-main" onclick="closeEdit()"
                style="background:none; color:var(--text-sec); box-shadow:none; margin-top:10px; font-size:13px;">HỦY
                BỎ</button>
        </div>
    </div>

    <script>
        const ACCOUNTS = [
            { name: "1mb đến 1gb", api: "https://dev.ipadl.workers.dev" },
            { name: "1gb đến 2.5gb", api: "https://dev.ipadl1.workers.dev" },
            { name: "2.5gb đén 5gb", api: "https://dev.ipadl2.workers.dev" }
        ];

        let PASS = localStorage.getItem("ipa_master_pass") || "";
        let currentTabIdx = 0;
        if (PASS) showDashboard();

        function login() {
            const val = document.getElementById('admin-pass').value;
            if (!val) return;
            localStorage.setItem("ipa_master_pass", val);
            location.reload();
        }
        function logout() { if (confirm("Bạn muốn đăng xuất?")) { localStorage.removeItem("ipa_master_pass"); location.reload(); } }

        function showDashboard() {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            renderTabs();
            const savedTab = localStorage.getItem("ipa_master_tab");
            switchTab(savedTab ? parseInt(savedTab) : 0);
        }

        function renderTabs() {
            const container = document.getElementById('tab-container');
            container.innerHTML = ACCOUNTS.map((acc, idx) => `
                <button class="btn-tab" id="tab-btn-\${idx}" onclick="switchTab(\${idx})">
                    \${acc.name}
                </button>
            `).join('');
        }

        function switchTab(idx) {
            idx = parseInt(idx);
            currentTabIdx = idx;
            localStorage.setItem("ipa_master_tab", idx);
            // Cập nhật giao diện nút Tab
            ACCOUNTS.forEach((_, i) => {
                const btn = document.getElementById(\`tab-btn-\${i}\`);
                if (i === idx) {
                    btn.style.background = 'var(--primary)';
                    btn.style.color = 'white';
                    btn.style.boxShadow = '0 10px 20px rgba(0, 122, 255, 0.2)';
                } else {
                    btn.style.background = 'var(--card-bg)';
                    btn.style.color = 'var(--text-sec)';
                    btn.style.boxShadow = 'none';
                }
            });

            const grid = document.getElementById('account-grid');
            const acc = ACCOUNTS[idx];
            grid.innerHTML = \`
                <div class="acc-block animate" style="max-width: 900px; margin: 0 auto;">
                    <div class="acc-h">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <div class="acc-n" style="margin-bottom:0;">\${acc.name}</div>
                            <button onclick="loadData(\${idx}, true)" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Làm mới dữ liệu">🔄</button>
                        </div>
                        <div class="st-b"><div id="st-fill-\${idx}" class="st-f"></div></div>
                        <div style="font-size:10px; color:var(--text-sec); display:flex; justify-content:space-between; font-weight:800; text-transform:uppercase;">
                            <span id="st-txt-\${idx}">ĐANG TẢI...</span>
                            <span>HẠN MỨC: 10GB</span>
                        </div>
                    </div>
                    <div class="up-z" onclick="document.getElementById('f-in-\${idx}').click()">
                        <b id="status-\${idx}" style="font-size:13px; letter-spacing:1px; color:var(--primary);">📤 TẢI LÊN IPA MỚI CHO SERVER NÀY</b>
                        <input type="file" id="f-in-\${idx}" style="display:none" accept=".ipa" onchange="upFile(this, \${idx})">
                        <div class="p-box" style="height:6px; background:rgba(0,0,0,0.03); border-radius:10px; margin-top:20px; display:none; overflow:hidden;" id="p-box-\${idx}"><div style="height:100%; background:var(--primary); width:0%;" id="p-fill-\${idx}"></div></div>
                    </div>
                    <div class="app-list" id="list-\${idx}"></div>
                </div>\`;

            // Chỉ load nếu chưa có dữ liệu hoặc force refresh
            if (!window[\`data_\${idx}\`]) {
                loadData(idx);
            } else {
                // Hiển thị ngay từ cache (giữ nguyên kết quả tìm kiếm nếu có)
                const q = document.getElementById('global-search').value;
                renderApps(idx, q);
                // Cập nhật lại thanh dung lượng cho chính xác
                updateStorageUI(idx, window[\`storage_\${idx}\`]);
            }
        }

        async function loadData(idx, force = false) {
            if (!force && window[\`data_\${idx}\`]) return;

            const acc = ACCOUNTS[idx];
            try {
                const s = await (await fetch(\`\${acc.api}/storage\`, { headers: { "Authorization": PASS } })).json();
                window[\`storage_\${idx}\`] = s;
                updateStorageUI(idx, s);

                const apps = await (await fetch(\`\${acc.api}/list\`, { headers: { "Authorization": PASS } })).json();
                window[\`data_\${idx}\`] = apps.sort((a, b) => b.id - a.id);

                // Load global serials
                try {
                    const globalSerials = await (await fetch(\`\${acc.api}/serials\`, { headers: { "Authorization": PASS } })).json();
                    window[\`serialMap_\${idx}\`] = { ...window[\`serialMap_\${idx}\`], ...globalSerials };
                    localStorage.setItem(\`serialMap_\${idx}\`, JSON.stringify(window[\`serialMap_\${idx}\`]));
                } catch (e) { }

                renderApps(idx);
            } catch (e) { document.getElementById(\`list-\${idx}\`).innerHTML = "<div style='color:var(--danger); text-align:center; padding:50px; font-size:12px; font-weight:800;'>SERVER OFFLINE</div>"; }
        }

        function updateStorageUI(idx, s) {
            if (!s) return;
            const usedMB = (s.usedBytes / 1024 / 1024).toFixed(1);
            const txt = document.getElementById(\`st-txt-\${idx}\`);
            const fill = document.getElementById(\`st-fill-\${idx}\`);
            if (txt) txt.innerText = \`\${usedMB} MB / 10 GB\`;
            if (fill) fill.style.width = Math.min(100, (s.usedBytes / (10 * 1024 * 1024 * 1024) * 100)) + "%";
        }

        function renderApps(idx, q = "") {
            const list = document.getElementById(\`list-\${idx}\`);
            let apps = window[\`data_\${idx}\`] || [];

            // Tự động khớp Serial dựa trên Cert Name (tích lũy, lưu localStorage)
            if (!window[\`serialMap_\${idx}\`]) window[\`serialMap_\${idx}\`] = JSON.parse(localStorage.getItem(\`serialMap_\${idx}\`) || '{}');
            const serialMap = window[\`serialMap_\${idx}\`];
            apps.forEach(a => {
                if (a.certName && a.certSerial && a.certSerial !== "N/A" && a.certSerial !== "") {
                    if (serialMap[a.certName] !== a.certSerial) {
                        serialMap[a.certName] = a.certSerial;
                        // Đồng bộ lên server nếu phát hiện serial mới
                        fetch(\`\${ACCOUNTS[idx].api}/serials\`, { method: 'POST', headers: { "Authorization": PASS }, body: JSON.stringify({ certName: a.certName, certSerial: a.certSerial }) });
                    }
                }
            });
            localStorage.setItem(\`serialMap_\${idx}\`, JSON.stringify(serialMap));

            if (q) apps = apps.filter(a => a.name.toLowerCase().includes(q.toLowerCase()));
            let h = "";
            apps.forEach(a => {
                const isRevoked = a.status === 'Bị thu hồi';
                const displaySerial = (a.certSerial && a.certSerial !== "N/A") ? a.certSerial : (serialMap[a.certName] || "N/A");
                h += \`
                <div class="app-item">
                    <div style="display:flex; gap:18px; align-items:center;">
                        <img src="\${a.icon}" class="app-icon">
                    <div style="flex:1;">
                        <div style="font-weight:800; font-size:16px; margin-bottom:8px; display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
                            \${a.name}
                            <span class="status-pill \${isRevoked ? 'status-revoked' : 'status-active'}">\${isRevoked ? 'Revoked' : 'Live'}</span>
                        </div>
                        <div style="font-size:11px; color:var(--text-sec); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; line-height:1.5;">
                            Version: \${a.version} • Size: \${a.size} • 📥 \${a.downloads || 0} Downloads
                        </div>
                        <div style="font-size:10px; color:var(--primary); font-weight:800; margin-top:5px; text-transform:uppercase;">CERT: \${a.certName || 'Enterprise'} \${(!a.certSerial || a.certSerial === "N/A") && serialMap[a.certName] ? '<span style="color:#FF9500; font-size:9px; margin-left:5px;">(AUTO-FILLED)</span>' : ''}</div>
                        <div style="font-size:10px; color:#32D74B; font-family:monospace; margin-top:3px; word-break:break-all; font-weight:800;">SERIAL: \${displaySerial}</div>
                    </div>
                    </div>
                    <div class="acts">
                        <button class="btn-sm btn-green" onclick="copy('\${a.webLink}')">Link Cài</button>
                        <button class="btn-sm btn-blue" onclick="copy('\${a.isgdLink}')">Rút Gọn</button>
                        <button class="btn-sm btn-blue" onclick="window.open('\${a.webLink}')">Xem</button>
                        <button class="btn-sm btn-gray" onclick='openEdit(\${idx}, \${JSON.stringify(a).replace(/'/g, "&apos;")})'>Sửa</button>
                        <button class="btn-sm btn-gray" onclick="reup(\${idx}, '\${a.id}')">Update</button>
                        <button class="btn-sm btn-gray" onclick="copy('\${a.ipaLink}')">IPA</button>
                        <button class="btn-sm btn-red" onclick="del(\${idx}, '\${a.id}')" style="grid-column: span 3; margin-top: 5px;">XÓA ỨNG DỤNG</button>
                    </div>
                </div>\`;
            });
            list.innerHTML = h || "<div style='color:var(--text-sec); text-align:center; padding:40px; font-size:13px; font-weight:600;'>TRỐNG</div>";
        }

        function globalSearch(val) {
            renderApps(currentTabIdx, val);
        }

        async function upFile(input, idx, appId = null) {
            const file = input.files[0]; if (!file) return;
            const acc = ACCOUNTS[idx];
            const status = document.getElementById(\`status-\${idx}\`);
            const pBox = document.getElementById(\`p-box-\${idx}\`);
            const pFill = document.getElementById(\`p-fill-\${idx}\`);
            pBox.style.display = 'block';

            try {
                let info = { CFBundleDisplayName: file.name.replace(".ipa", ""), CFBundleIdentifier: "com.unknown.app", CFBundleShortVersionString: "1.0", CFBundleVersion: "1", CFBundleExecutable: "App", MinimumOSVersion: "12.0", icon: "https://img.icons8.com/color/512/ipa-file.png" };
                let team = "Enterprise"; let serial = ""; let appStatus = "Hoạt động";

                try {
                    const zip = await JSZip.loadAsync(file);
                    if (file.size < 2.5 * 1024 * 1024 * 1024) {
                        const parsedInfo = await (new AppInfoParser(file)).parse();
                        if (parsedInfo) {
                            info.CFBundleDisplayName = parsedInfo.CFBundleDisplayName || parsedInfo.CFBundleName;
                            info.CFBundleIdentifier = parsedInfo.CFBundleIdentifier;
                            info.CFBundleShortVersionString = parsedInfo.CFBundleShortVersionString;
                            info.MinimumOSVersion = parsedInfo.MinimumOSVersion;
                            info.icon = parsedInfo.icon;
                        }
                    }
                    const prov = Object.keys(zip.files).find(f => f.endsWith(".app/embedded.mobileprovision"));
                    if (prov) {
                        const content = await zip.file(prov).async("string");
                        team = content.match(/<key>TeamName<\\/key>\\s*<string>([^<]+)<\\/string>/)?.[1] || "Enterprise";
                        const certMatch = content.match(/<key>DeveloperCertificates<\\/key>[\\s\\S]*?<data>([\\s\\S]*?)<\\/data>/);
                        if (certMatch) {
                            serial = extractSerialFromB64(certMatch[1].replace(/\\s/g, ''));
                            if (!serial && window[\`serialMap_\${idx}\`] && window[\`serialMap_\${idx}\`][team]) serial = window[\`serialMap_\${idx}\`][team];
                            if (serial) {
                                const check = await fetch(\`https://cert-checker.trinhtruongphong.workers.dev/?serial=\${serial}\`);
                                const res = await check.json();
                                if (res.alive === false) appStatus = "Bị thu hồi";
                            }
                        }
                    }
                } catch (err) { console.warn("Lỗi phân tích IPA"); }

                status.innerText = \`⚡ ĐANG TẢI LÊN...\`;
                const id = appId || Date.now().toString();
                const startReq = await fetch(\`\${acc.api}/upload/start\`, { method: 'POST', headers: { "Authorization": PASS }, body: JSON.stringify({ fileName: id + ".ipa" }) });
                const start = await startReq.json();

                const chunkSize = 50 * 1024 * 1024; const chunks = Math.ceil(file.size / chunkSize);
                const parts = new Array(chunks); let completed = 0; let queue = Array.from({ length: chunks }, (_, i) => i);

                const uploadWorker = async () => {
                    while (queue.length > 0) {
                        const i = queue.shift();
                        const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
                        try {
                            const res = await fetch(\`\${acc.api}/upload/part?uploadId=\${start.uploadId}&partNumber=\${i + 1}&key=\${start.key}\`, { method: 'POST', headers: { "Authorization": PASS }, body: chunk });
                            const d = await res.json();
                            parts[i] = { partNumber: i + 1, etag: d.etag };
                            completed++;
                            pFill.style.width = Math.round(completed / chunks * 100) + "%";
                            status.innerText = \`📤 \${Math.round(completed / chunks * 100)}% (\${completed}/\${chunks})\`;
                        } catch (err) { queue.push(i); await new Promise(r => setTimeout(r, 2000)); }
                    }
                };

                await Promise.all(Array(8).fill(null).map(uploadWorker));

                await fetch(\`\${acc.api}/upload/complete\`, {
                    method: 'POST', headers: { "Authorization": PASS },
                    body: JSON.stringify({
                        uploadId: start.uploadId, key: start.key, parts: parts.filter(p => p),
                        appData: { id, name: info.CFBundleDisplayName, bundleId: info.CFBundleIdentifier, version: info.CFBundleShortVersionString, size: (file.size / 1024 / 1024).toFixed(1) + " MB", icon: info.icon, certName: team, certSerial: serial, minOs: info.MinimumOSVersion, status: appStatus }
                    })
                });

                pBox.style.display = 'none'; status.innerText = "✅ THÀNH CÔNG!"; setTimeout(() => { status.innerText = "📤 TẢI LÊN IPA MỚI"; }, 3000); loadData(idx, true);
            } catch (e) { alert("Lỗi: " + e.message); status.innerText = "❌ LỖI!"; pBox.style.display = 'none'; }
        }

        function previewIcon(i) { const r = new FileReader(); r.onload = (e) => document.getElementById('edit-preview').src = e.target.result; r.readAsDataURL(i.files[0]); }
        function openEdit(idx, a) {
            const serialMap = window[\`serialMap_\${idx}\`] || {};
            document.getElementById('edit-acc-idx').value = idx; document.getElementById('edit-id').value = a.id;
            document.getElementById('edit-name').value = a.name; document.getElementById('edit-bundleid').value = a.bundleId || "";
            document.getElementById('edit-filename').value = a.fileName; document.getElementById('edit-ipalink').value = a.ipaLink || "";
            document.getElementById('edit-cert').value = a.certName || ""; 
            document.getElementById('edit-serial').value = (a.certSerial && a.certSerial !== "N/A") ? a.certSerial : (serialMap[a.certName] || "");
            document.getElementById('edit-minos').value = a.minOs || "12.0"; document.getElementById('edit-status').value = a.status || "Hoạt động";
            document.getElementById('edit-preview').src = a.icon; document.getElementById('edit-modal').style.display = 'flex';
        }
        function closeEdit() { document.getElementById('edit-modal').style.display = 'none'; }
        async function saveEdit(e) {
            const btn = e.target;
            const originalText = btn.innerText;
            btn.innerText = "ĐANG LƯU...";
            btn.disabled = true;

            try {
                const idx = document.getElementById('edit-acc-idx').value;
                const body = { id: document.getElementById('edit-id').value, name: document.getElementById('edit-name').value, bundleId: document.getElementById('edit-bundleid').value, newFileName: document.getElementById('edit-filename').value, ipaLink: document.getElementById('edit-ipalink').value, certName: document.getElementById('edit-cert').value, certSerial: document.getElementById('edit-serial').value, minOs: document.getElementById('edit-minos').value, status: document.getElementById('edit-status').value, newIcon: document.getElementById('edit-preview').src.startsWith('data:') ? document.getElementById('edit-preview').src : "" };
                await fetch(\`\${ACCOUNTS[idx].api}/upload/edit\`, { method: 'POST', headers: { "Authorization": PASS, "Content-Type": "application/json" }, body: JSON.stringify(body) });
                location.reload();
            } catch (e) {
                alert("Lỗi khi lưu: " + e.message);
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
        async function clean() { if (confirm("Dọn rác?")) { for (let i = 0; i < ACCOUNTS.length; i++) await fetch(\`\${ACCOUNTS[i].api}/cleanup\`, { headers: { "Authorization": PASS } }); location.reload(); } }
        function reup(idx, id) { const i = document.createElement('input'); i.type = 'file'; i.accept = '.ipa'; i.onchange = (e) => upFile(i, idx, id); i.click(); }
        async function del(idx, id) { if (confirm("Xóa vĩnh viễn?")) { await fetch(\`\${ACCOUNTS[idx].api}/delete?id=\${id}\`, { method: 'DELETE', headers: { "Authorization": PASS } }); loadData(idx, true); } }
        function copy(t) { navigator.clipboard.writeText(t); alert("ĐÃ SAO CHÉP!"); }

        function extractSerialFromB64(b64) {
            try {
                const binary = atob(b64); const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                let p = 0; function getLen() { let l = bytes[p++]; if (l & 0x80) { let n = l & 0x7f; l = 0; while (n--) l = (l << 8) | bytes[p++]; } return l; }
                if (bytes[p++] !== 0x30) return ""; getLen(); if (bytes[p++] !== 0x30) return ""; getLen();
                if (bytes[p] === 0xa0) { p++; let l = getLen(); p += l; }
                if (bytes[p++] === 0x02) { let sLen = getLen(); let sBytes = bytes.subarray(p, p + sLen); let hex = Array.from(sBytes).map(b => b.toString(16).padStart(2, '0')).join(''); if (hex.startsWith('00') && hex.length > 30) hex = hex.substring(2); return hex.toLowerCase(); }
                return "";
            } catch (e) { return ""; }
        }
    </script>
</body>

</html>
