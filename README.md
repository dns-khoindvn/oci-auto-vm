# 📦 IPA Master V32 - Ultimate OTA Manager

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Version](https://img.shields.io/badge/Version-32.0-green.svg)
![Platform](https://img.shields.io/badge/Platform-Cloudflare_Workers-orange.svg)

**IPA Master V32** là hệ thống quản lý và phân phối tệp tin IPA chuyên nghiệp cho iOS, sử dụng hạ tầng không máy chủ (Serverless) của Cloudflare. Hệ thống cho phép lưu trữ tệp lớn, bóc tách metadata tự động và cài đặt OTA (Over-the-Air) cực nhanh.

## ✨ Tính năng nổi bật
* 🚀 **Hỗ trợ tệp lớn:** Multipart Upload vượt qua giới hạn 100MB.
* 🔗 **Auto Domain:** Tự nhận diện tên miền, không bắt buộc Custom Domain cho R2.
* 🛡️ **Proxy Mode:** Tải file qua Worker, bảo mật link gốc của kho chứa.
* 🛠️ **Admin Dashboard:** Có thanh tiến trình (Progress Bar), quản lý dung lượng.
* 🏷️ **Auto Metadata:** Tự lấy Icon, Bundle ID, Version, iOS Min, Executable và Team Cert.
* 🚪 **Security:** Có chức năng Đăng nhập/Đăng xuất bảo mật.

## 🚀 Hướng dẫn cài đặt nhanh

### Bước 1: Cloudflare R2
1. Tạo Bucket tên là `MY_BUCKET`.
2. Tab **Settings** > **CORS Policy** > Dán JSON:
`[{"AllowedOrigins":["*"],"AllowedMethods":["GET","PUT","POST","DELETE","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"]}]`

### Bước 2: Cloudflare Worker
1. Tạo Worker, kết nối R2 Bucket (Variable: `MY_BUCKET`).
2. Thêm biến ENV: `ACCESS_PASSWORD` (Mật khẩu) và `WEB_DOMAIN` (Tùy chọn).
3. Dán mã nguồn từ `worker.js` và Deploy.

### Bước 3: Admin Panel
1. Mở `index.html`, sửa `const API = "URL_WORKER_CỦA_BẠN"`.
2. Mở file bằng trình duyệt và bắt đầu sử dụng.

---
*Phát triển bởi Gemini AI & KhoiNDVN.*
