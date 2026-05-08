📦 IPA Master V32 - Ultimate OTA Manager
IPA Master V32 là một hệ thống quản lý và phân phối tệp tin IPA chuyên nghiệp cho iOS, sử dụng hạ tầng không máy chủ (Serverless) của Cloudflare. Hệ thống cho phép bạn lưu trữ tệp tin nặng, bóc tách metadata tự động và cài đặt OTA (Over-the-Air) cực kỳ nhanh chóng.

✨ Tính năng nổi bật
🚀 Hỗ trợ tệp lớn: Tải lên đa phần (Multipart Upload) vượt qua giới hạn 100MB của Worker.

🔗 Auto Domain: Tự động nhận diện tên miền, không bắt buộc phải có Custom Domain cho R2.

🛡️ Proxy Mode: Tải file IPA trực tiếp thông qua Worker, bảo mật link gốc của kho chứa.

📱 Chuẩn Apple OTA: Tự động tạo file .plist cấu hình theo thời gian thực.

🛠️ Admin Dashboard: Giao diện quản trị hiện đại, có thanh tiến trình upload, quản lý dung lượng kho.

🏷️ Auto Metadata: Tự động lấy Icon, Bundle ID, Version, Minimum OS, Executable và Team Cert.

💰 Monetization: Tích hợp sẵn các vị trí đặt mã quảng cáo (AdSense, v.v.).

🔒 Bảo mật: Đăng nhập/Đăng xuất bằng mật khẩu thông qua biến môi trường.

🚀 Hướng dẫn cài đặt
1. Khởi tạo Cloudflare R2 (Storage)
Truy cập R2 > Create bucket > Đặt tên là MY_BUCKET.

Vào tab Settings > CORS Policy > Edit và dán cấu hình sau:

JSON
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
2. Thiết lập Cloudflare Workers
Tạo một Worker mới (ví dụ: ipa-manager).

Kết nối R2: Vào Settings > Bindings > Add binding > R2 Bucket. Đặt tên biến là MY_BUCKET.

Biến môi trường: Vào Settings > Variables và thêm:

ACCESS_PASSWORD: Mật khẩu quản trị.

WEB_DOMAIN: (Tùy chọn) Domain riêng của bạn.

Copy mã nguồn từ worker.js trong dự án này và Deploy.

3. Cấu hình Admin Panel
Mở file index.html.

Tìm dòng const API = "..." và thay bằng URL Worker của bạn.

Tải file lên GitHub Pages, Vercel hoặc Host cá nhân để sử dụng.

⚙️ Cấu hình biến môi trường (ENV)
Biến	Ý nghĩa	Trạng thái
MY_BUCKET	Liên kết với R2 Bucket	Bắt buộc
ACCESS_PASSWORD	Mật khẩu truy cập trang quản trị	Bắt buộc
WEB_DOMAIN	Domain hiển thị cho người dùng cuối	Không bắt buộc
📂 Cấu trúc thư mục trong R2
Hệ thống tự động quản lý dữ liệu theo cấu trúc:

files/: Chứa các tệp gốc .ipa.

meta/: Chứa các tệp .json lưu thông tin ứng dụng.

plists/: (Tự động tạo) Chứa cấu hình cài đặt cho iOS.

🛠️ Công nghệ sử dụng
Backend: Cloudflare Workers (JavaScript).

Storage: Cloudflare R2 (S3 Compatible).

Frontend: HTML5, CSS3, JavaScript (Vanilla).

Libraries: app-info-parser (Bóc tách IPA), JSZip (Giải nén).

⚖️ Tuyên bố miễn trừ trách nhiệm (Disclaimer)
Dự án này được tạo ra cho mục đích học tập và quản lý cá nhân. Người sử dụng chịu hoàn toàn trách nhiệm về nội dung (tệp IPA) tải lên hệ thống. Chúng tôi không chịu trách nhiệm về bất kỳ hành vi vi phạm bản quyền hoặc chính sách nào từ phía người dùng.

IPA Master V32 - Phát triển bởi Gemini AI & KhoiNDVN. Nếu bạn thấy hữu ích, hãy cho dự án này 1 ⭐ trên GitHub nhé!
