# 🚀 Hướng dẫn Deploy lên Render

> **Phiên bản này lưu API key trên trình duyệt (localStorage)** — bạn nhập key trực tiếp qua giao diện web. Không cần cấu hình Environment Variables trên Render.

## Bước 1: Đẩy code lên GitHub

1. Tạo repo mới trên GitHub (vd: `ai-video-tool`)
2. Trong Terminal, mở thư mục source này, chạy:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

## Bước 2: Tạo Web Service trên Render

1. Vào https://render.com → **Sign up** (login bằng GitHub là tiện nhất)
2. Dashboard → **New +** → **Web Service**
3. Connect repo GitHub vừa push
4. Điền form:

| Field | Giá trị |
|---|---|
| **Name** | `ai-video-tool` (tùy ý) |
| **Region** | **Singapore** |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | **Free** |

> File `render.yaml` đã có sẵn, Render có thể tự nhận diện cấu hình.

5. Bấm **Create Web Service** → đợi 2-3 phút build xong

## Bước 3: Nhập API Key qua giao diện web

Sau khi Render cấp URL (kiểu `https://ai-video-tool.onrender.com`):

1. Mở URL đó trên trình duyệt
2. Bấm icon ⚙️ **Cài đặt** ở góc trên phải
3. Nhập **Gemini API Key** (lấy từ https://aistudio.google.com)
4. (Tùy chọn) Nhập **ElevenLabs API Key**
5. Bấm **Lưu cài đặt**

✅ **Xong!** Key sẽ lưu trong localStorage trình duyệt của bạn, không gửi lên server. Mỗi request gọi Gemini/ElevenLabs, frontend tự đính key vào HTTP header.

---

## 🔐 Bảo mật

- Key chỉ ở trình duyệt của bạn — server **không lưu** key
- Mỗi user dùng web có thể nhập key riêng (không chia sẻ)
- Xóa cache trình duyệt = mất key (phải nhập lại)
- Nếu bạn share URL Render cho người khác, họ phải tự nhập key của họ

---

## ⚠️ Hạn chế Free Tier

| Thứ | Giới hạn |
|---|---|
| **Sleep** | Service ngủ sau **15 phút** không có request → wake mất ~30-50s |
| **RAM** | 512 MB |
| **Hours** | 750 giờ/tháng |
| **Bandwidth** | 100 GB/tháng |

### Tránh sleep
- **UptimeRobot** (free): Add monitor HTTP ping URL Render mỗi 5 phút
- **Hoặc upgrade Starter $7/tháng**: không sleep

---

## 🔧 Troubleshooting

**Bấm "Tạo video" báo "Gemini API key chưa được cấu hình":**
- Mở ⚙️ Cài đặt, nhập lại key, bấm Lưu
- Kiểm tra trình duyệt có chặn localStorage không (Incognito/Private mode đôi khi có vấn đề)

**Đổi máy/trình duyệt khác phải nhập lại key:**
- Đúng — đó là tính chất của localStorage. Mỗi browser giữ key riêng.

**Voice ElevenLabs không load:**
- Vào ⚙️ Cài đặt, nhập đúng ElevenLabs key, Lưu
- Refresh trang

**`/api/tts-free` (Google Translate) báo lỗi:**
- IP datacenter Render đôi khi bị Google chặn
- Workaround: dùng ElevenLabs API key thay thế

**Build lỗi:**
- Vào Render Dashboard → tab **Logs** xem chi tiết
- Kiểm tra `package.json` không bị sửa hỏng

---

## 🧪 Chạy local

```bash
npm install
npm start
```

Mở http://localhost:3000, vào ⚙️ Cài đặt nhập key.

---

## 📁 Cấu trúc project

```
.
├── server.js          # Backend Express (stateless, đọc key từ header)
├── package.json
├── render.yaml        # Cấu hình deploy Render
├── .gitignore
├── public/            # Frontend (HTML + JS)
│   ├── index.html
│   ├── app.js         # Logic chính, lưu key vào localStorage
│   ├── renderer.js
│   └── style.css
└── DEPLOY_RENDER.md   # File này
```

Chúc deploy thành công! 🎬
