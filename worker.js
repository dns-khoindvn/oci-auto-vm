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
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${app.name} - IPA Master Elite</title>
    
    <!-- Open Graph Tags -->
    <meta property="og:title" content="Tải ${app.name} - IPA Master Elite">
    <meta property="og:description" content="Tải ngay ${app.name} phiên bản ${app.version || 'mới nhất'} ổn định, không quảng cáo tại IPA Master Elite.">
    <meta property="og:image" content="${app.icon}">
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
            <img src="${app.icon}" alt="${app.name}" class="app-icon">
            <h1>${app.name}</h1>

            <div class="stats-card">
                <div class="stat-item"><div class="stat-label">Số người cài đặt</div><div class="stat-value">${downloadStr}</div></div>
                <div class="stat-item"><div class="stat-label">Số người tải IPA</div><div class="stat-value">${installStr}</div></div>
            </div>
            <a href="${host}/i/${app.id}" class="btn btn-primary" onclick="handleInstallClick(this)">
                <div style="display:flex; flex-direction:column; align-items:center; line-height:1.2;">
                    <span>CÀI ĐẶT NGAY</span>
                    <span style="font-size:10px; opacity:0.8; font-weight:800; letter-spacing:0.5px;">INSTALL NOW</span>
                </div>
            </a>
            <a href="${host}/dl/${app.id}" class="btn btn-secondary">
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
                <div class="info-row"><span class="info-label">Chứng chỉ</span><span class="info-value">${app.certName || "Enterprise"}</span></div>
                <div class="info-row"><span class="info-label">Trạng thái chứng chỉ</span><span class="info-value" style="color:${statusColor}">${status === 'Hoạt động' ? 'Đang Hoạt động' : status}</span></div>
                <div class="info-row"><span class="info-label">Phiên bản</span><span class="info-value">${app.version || "1.0"}</span></div>
                <div class="info-row"><span class="info-label">Dung lượng</span><span class="info-value">${app.size || "---"}</span></div>
                <div class="info-row"><span class="info-label">iOS yêu cầu</span><span class="info-value">iOS ${app.minOs || "12.0"}+</span></div>
                <div class="info-row"><span class="info-label">Ngày cập nhật</span><span class="info-value">${app.releaseDate || new Date().toLocaleDateString('vi-VN')}</span></div>
                <div class="info-row"><span class="info-label">Kiểm tra tương thích</span><span class="info-value" id="device-check" style="font-size:11px;">Đang kiểm tra...</span></div>
            </div>

            <div style="margin-top:25px; background:rgba(0,122,255,0.05); border-radius:24px; padding:20px; text-align:left; border:1px solid rgba(0,122,255,0.1);">
                <div style="color:var(--accent); font-size:11px; font-weight:800; text-transform:uppercase; margin-bottom:12px; letter-spacing:1px;">HƯỚNG DẪN CÀI ĐẶT</div>
                <div style="font-size:13px; color:var(--text-sec); line-height:1.6;">
                    1. Nhấn <b>Cài đặt ngay</b> và quay lại màn hình chính.<br>
                    2. Mở <b>Cài đặt > Cài đặt chung</b>.<br>
                    3. Chọn <b>Quản lý VPN & Thiết bị</b>.<br>
                    4. Tin cậy <b>${app.certName || "Chứng chỉ"}</b>.
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
            const minOs = parseFloat("${app.minOs || '12.0'}");

            if (isIOS) {
                // Trích xuất phiên bản iOS từ User Agent
                let version = 0;
                const match = ua.match(/OS (\d+)_(\d+)/);
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
</html>`;
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