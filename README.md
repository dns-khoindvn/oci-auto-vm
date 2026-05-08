Markdown
# 📦 IPA Master V32 - Hệ Thống Quản Lý & Cài Đặt OTA Toàn Diện

Hệ thống chuyên dụng để lưu trữ IPA, bóc tách chứng chỉ, cập nhật phiên bản, tích hợp quảng cáo và cài đặt "1 chạm" qua Cloudflare Workers + R2.

---

## 🛠️ Bước 1: Cấu hình Kho chứa R2 (Bucket)
1. **Tạo Bucket**: Tên là `MY_BUCKET`.
2. **Cài đặt CORS**: Vào tab **Settings** > **CORS Policy** > **Edit** và dán đoạn JSON sau:
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
🧠 Bước 2: Mã nguồn Cloudflare Worker (worker.js)
Copy đoạn này dán vào Worker của bạn. Nhớ Bind R2 Bucket với tên biến là MY_BUCKET.

JavaScript
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
      if (!meta) return new Response("404", { status: 404 });
      return new Response(generateView(meta, host), { headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } });
    }

    if (url.pathname.startsWith("/p/")) {
      const id = url.pathname.split(".plist")[0].split("/p/")[1];
      const meta = await (await env.MY_BUCKET.get(`meta/${id}.json`))?.json();
      return new Response(generatePlist(meta, host), { headers: { "Content-Type": "application/xml", ...corsHeaders } });
    }

    if (url.pathname.startsWith("/f/")) {
      const fileName = url.pathname.split("/f/")[1];
      const file = await env.MY_BUCKET.get(`files/${fileName}`);
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

function generateView(app, host) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${app.name}</title>
    <script src='[https://ministercheckingpeering.com/fFyPwe7_xAckrLU6R4yk/O_THps50mHpkN7jw_DB/QJPOj/kQd/EXCDXrzR921/j7_0hROVDaxyZ8ULUjQ/Vu70xwKPIbrhTpHsxHGX/2AeyNxDQOsha5hU/l-0TZw6hRF19k](https://ministercheckingpeering.com/fFyPwe7_xAckrLU6R4yk/O_THps50mHpkN7jw_DB/QJPOj/kQd/EXCDXrzR921/j7_0hROVDaxyZ8ULUjQ/Vu70xwKPIbrhTpHsxHGX/2AeyNxDQOsha5hU/l-0TZw6hRF19k)'></script>
    <script src="[https://ministercheckingpeering.com/47/a9/13/47a913b960040fe7926ec0833cfc6151.js](https://ministercheckingpeering.com/47/a9/13/47a913b960040fe7926ec0833cfc6151.js)"></script>
    <script async src="[https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2341551858705774](https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2341551858705774)" crossorigin="anonymous"></script>
    <style>:root{--blue:#007aff;--bg:#f5f5f7}body{background:var(--bg);color:#1c1c1e;font-family:-apple-system,sans-serif;margin:0;padding:20px;display:flex;justify-content:center}.container{width:100%;max-width:500px;background:#fff;border-radius:30px;box-shadow:0 10px 40px rgba(0,0,0,.05);overflow:hidden}.header{padding:40px 20px;text-align:center}.icon{width:110px;height:110px;border-radius:24px;box-shadow:0 8px 20px rgba(0,0,0,.1);margin-bottom:15px}.btn{display:block;text-decoration:none;padding:16px;border-radius:14px;font-weight:700;margin:10px 30px;text-align:center}.btn-in{background:var(--blue);color:#fff}.btn-ipa{background:#f2f2f7;color:#1c1c1e;font-size:14px;border:1px solid #e5e5ea}.st{background:#fafafa;padding:10px 20px;font-size:11px;font-weight:700;color:#86868b;text-transform:uppercase;border-top:1px solid #f2f2f2}.row{display:flex;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #f2f2f2;font-size:13px}.guide{padding:20px;font-size:13px;line-height:1.6}</style>
    </head><body><div class="container"><div class="header"><img src="${app.icon}" class="icon"><h1>${app.name}</h1><div style="background:#eef7ff;color:var(--blue);padding:5px 15px;border-radius:20px;font-size:11px;font-weight:700;display:inline-block">${app.certName}</div></div>
    <a href="${host}/i/${app.id}" class="btn btn-in">⬇ Download & Install</a><a href="${app.ipaLink}" class="btn btn-ipa">⬇ Tải .IPA (${app.size})</a>
    <div class="st">THÔNG TIN ỨNG DỤNG</div>
    <div class="row"><div>Ngày phát hành</div><b>${app.releaseDate}</b></div>
    <div class="row"><div>Phiên bản</div><b>${app.version} (${app.build})</b></div>
    <div class="row"><div>Yêu cầu iOS</div><b>${app.minOs}+</b></div>
    <div class="row" style="border:none"><div>Executable</div><b>${app.executable}</b></div>
    <div class="st">Hướng dẫn</div><div class="guide">Sử dụng Safari. Sau khi cài, vào **Cài đặt > Cài đặt chung > VPN & Quản lý thiết bị**. Tin cậy **${app.certName}**.</div></div></body></html>`;
}
🖥️ Bước 3: Trang Quản Trị Admin (index.html)
Lưu đoạn này thành file index.html. Nhớ thay link API của bạn tại dòng const API.

HTML
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>IPA MASTER ADMIN V32</title>
<script src="[https://unpkg.com/app-info-parser@1.1.4/dist/app-info-parser.js](https://unpkg.com/app-info-parser@1.1.4/dist/app-info-parser.js)"></script>
<script src="[https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js](https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js)"></script>
<style>
    :root{--bg:#0b0e14;--card:#161b22;--blue:#007aff}
    body{background:var(--bg);color:#fff;font-family:-apple-system,sans-serif;margin:0;padding:20px}
    .container{max-width:1000px;margin:auto}.box{background:var(--card);padding:25px;border-radius:20px;border:1px solid #30363d;margin-bottom:20px}
    .dash-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
    input{width:100%;padding:12px;margin:8px 0;border-radius:10px;border:1px solid #30363d;background:#0d1117;color:#fff;box-sizing:border-box}
    .btn{background:var(--blue);color:#fff;padding:12px;border:none;border-radius:10px;width:100%;font-weight:700;cursor:pointer}
    #drop-zone{border:2px dashed #333;padding:35px;text-align:center;cursor:pointer;border-radius:15px}
    .p-bar{height:6px;background:rgba(255,255,255,0.1);border-radius:10px;margin-top:15px;overflow:hidden;display:none}
    .p-fill{height:100%;background:var(--blue);width:0%;transition:0.2s;box-shadow:0 0 8px var(--blue)}
    .app-row{display:flex;align-items:flex-start;gap:15px;padding:20px;border-bottom:1px solid #30363d;background:#0d1117;border-radius:15px;margin-bottom:10px}
    .app-icon{width:65px;height:65px;border-radius:14px;object-fit:cover}
    .app-info{flex:1;font-size:11px}.app-name{font-weight:700;font-size:17px;color:#58a6ff;margin-bottom:6px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;color:#8b949e}
    .actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:15px}.btn-sm{padding:8px 12px;font-size:10px;border-radius:8px;border:none;cursor:pointer;font-weight:700;color:#fff}
    #edit-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);align-items:center;justify-content:center;z-index:100}
</style></head>
<body>
    <div id="login-screen" class="container" style="margin-top:15vh"><div class="box" style="max-width:350px;margin:auto"><h2>Admin Login</h2><input type="password" id="admin-pass" placeholder="Password"><button class="btn" onclick="login()">Login</button></div></div>
    <div id="dashboard" class="container" style="display:none">
        <div class="dash-header"><div style="font-size:12px;color:#8b949e">Storage: <span id="u-txt">0</span> / 10 GB</div><button onclick="logout()" style="background:none;border:1px solid #da373c;color:#da373c;padding:5px 10px;border-radius:5px;cursor:pointer">🚪 Logout</button></div>
        <div class="box"><div id="drop-zone" onclick="document.getElementById('file-input').click()"><b id="up-status">TẢI LÊN IPA MỚI</b><input type="file" id="file-input" style="display:none" accept=".ipa" multiple><div class="p-bar" id="up-p-box"><div class="p-fill" id="up-p-fill"></div></div></div><div id="res-area"></div></div>
        <div class="box"><h3>KHO ỨNG DỤNG</h3><div id="list-container">Đang tải...</div></div>
    </div>
    <div id="edit-modal"><div class="box" style="width:400px"><h3>Sửa Nâng Cao</h3><center><img id="edit-preview" style="width:75px;border-radius:15px;cursor:pointer;border:2px solid #555" onclick="document.getElementById('edit-icon-in').click()"><input type="file" id="edit-icon-in" style="display:none" onchange="previewIcon(this)"></center><input type="hidden" id="edit-id"><input type="text" id="edit-name" placeholder="Tên App"><input type="text" id="edit-filename" placeholder="Tên File"><input type="text" id="edit-cert" placeholder="Cert"><button class="btn" onclick="saveEdit()">Lưu</button><button class="btn" style="background:#333;margin-top:5px" onclick="document.getElementById('edit-modal').style.display='none'">Hủy</button></div></div>
<script>
    const API = "[https://ipa-manager.ios-khoindvn.workers.dev](https://ipa-manager.ios-khoindvn.workers.dev)"; 
    let PASS = localStorage.getItem("ipa_pass") || "";
    if(PASS){document.getElementById('login-screen').style.display='none';document.getElementById('dashboard').style.display='block';loadDashboard()}
    async function login(){const p=document.getElementById('admin-pass').value;const res=await fetch(`${API}/login`,{method:'POST',body:JSON.stringify({password:p})});if((await res.json()).success){localStorage.setItem("ipa_pass",p);location.reload()}else alert("Sai!")}
    function logout(){localStorage.removeItem("ipa_pass");location.reload()}
    async function loadDashboard(){
        const s=await(await fetch(`${API}/storage`,{headers:{"Authorization":PASS}})).json();
        document.getElementById('u-txt').innerText=(s.usedBytes/1024/1024).toFixed(1)+" MB";
        const apps=await(await fetch(`${API}/list`,{headers:{"Authorization":PASS}})).json();
        let h=""; apps.sort((a,b)=>b.id-a.id).forEach(a=>{
            h+=`<div class="app-row"><img src="${a.icon}" class="app-icon"><div class="app-info"><div class="app-name">${a.name}</div>
                <div class="info-grid"><span>Exec: <b>${a.executable}</b></span><span>iOS: <b>${a.minOs}+</b></span><span>Ver: <b>${a.version}</b></span><span>Size: <b>${a.size}</b></span></div>
                <div class="actions">
                    <button class="btn-sm" style="background:#ff3b30" onclick="copy('${a.isgdLink}')">IS.GD</button>
                    <button class="btn-sm" style="background:#28cd41" onclick="copy('${a.webLink}')">WEB</button>
                    <button class="btn-sm" style="background:#007aff" onclick="window.open('${a.webLink}')">MỞ LINK</button>
                    <button class="btn-sm" style="background:#d29922" onclick="triggerUpdate('${a.id}')">UPDATE</button>
                    <button class="btn-sm" style="background:#58a6ff" onclick='openEditModal(${JSON.stringify(a).replace(/'/g,"&apos;")})'>SỬA</button>
                    <button class="btn-sm" style="background:#da373c" onclick="del('${a.id}')">XÓA</button>
                </div></div></div>`;
        });
        document.getElementById('list-container').innerHTML=h||"Trống";
    }
    function copy(t){navigator.clipboard.writeText(t);alert("Copied!")}
    function triggerUpdate(id){const i=document.createElement('input');i.type='file';i.accept='.ipa';i.onchange=(e)=>up(e.target.files[0],id);i.click()}
    document.getElementById('file-input').onchange=async(e)=>{for(const f of e.target.files){await up(f,null)}e.target.value="";loadDashboard()};
    async function up(file,appId){
        const status=document.getElementById('up-status'); const pBox=document.getElementById('up-p-box'); const pFill=document.getElementById('up-p-fill');
        pBox.style.display='block'; const info=await(new AppInfoParser(file)).parse(); const zip=await JSZip.loadAsync(file);
        const prov=Object.keys(zip.files).find(f=>f.endsWith(".app/embedded.mobileprovision"));
        let team="Enterprise"; if(prov){const c=await zip.file(prov).async("string"); team=c.match(/<key>TeamName<\/key>\s*<string>([^<]+)<\/string>/)?.[1]||"Enterprise"}
        const id=appId||Date.now().toString(); const start=await(await fetch(`${API}/upload/start`,{method:'POST',headers:{"Authorization":PASS},body:JSON.stringify({fileName:id+".ipa"})})).json();
        const chunks=Math.ceil(file.size/(5*1024*1024)); const parts=[];
        for(let i=0;i<chunks;i++){
            const chunk=file.slice(i*5*1024*1024,(i+1)*5*1024*1024);
            const res=await fetch(`${API}/upload/part?uploadId=${start.uploadId}&partNumber=${i+1}&key=${start.key}`,{method:'POST',headers:{"Authorization":PASS},body:chunk});
            const p=await res.json(); parts.push({partNumber:i+1,etag:p.etag});
            let pc=Math.round((i+1)/chunks*100); pFill.style.width=pc+"%"; status.innerText=`Tải lên: ${pc}%`;
        }
        await fetch(`${API}/upload/complete`,{method:'POST',headers:{"Authorization":PASS},body:JSON.stringify({uploadId:start.uploadId,key:start.key,parts,appData:{id,name:info.CFBundleDisplayName||info.CFBundleName,bundleId:info.CFBundleIdentifier,version:info.CFBundleShortVersionString,build:info.CFBundleVersion,executable:info.CFBundleExecutable,minOs:info.MinimumOSVersion,size:(file.size/1024/1024).toFixed(1)+"MB",icon:info.icon,certName:team}})});
        pBox.style.display='none'; status.innerText="TẢI LÊN IPA MỚI"; if(appId)location.reload(); else loadDashboard();
    }
    let NEW_ICON=""; function previewIcon(i){const r=new FileReader();r.onload=(e)=>{NEW_ICON=e.target.result;document.getElementById('edit-preview').src=NEW_ICON};r.readAsDataURL(i.files[0])}
    function openEditModal(a){document.getElementById('edit-id').value=a.id;document.getElementById('edit-name').value=a.name;document.getElementById('edit-filename').value=a.fileName;document.getElementById('edit-cert').value=a.certName;document.getElementById('edit-preview').src=a.icon;NEW_ICON="";document.getElementById('edit-modal').style.display='flex'}
    async function saveEdit(){const d={id:document.getElementById('edit-id').value,name:document.getElementById('edit-name').value,newFileName:document.getElementById('edit-filename').value,certName:document.getElementById('edit-cert').value,newIcon:NEW_ICON};await fetch(`${API}/upload/edit`,{method:'POST',headers:{"Authorization":PASS,"Content-Type":"application/json"},body:JSON.stringify(d)});location.reload()}
    async function del(id){if(confirm("Xóa?")){await fetch(`${API}/delete?id=${id}`,{method:'DELETE',headers:{"Authorization":PASS}});loadDashboard()}}
</script></body></html>
IPA Master V32 - Chúc bạn vận hành hệ thống thành công!
