const fs = require('fs');
const path = require('path');

// Hàm copy thư mục
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Đang dọn dẹp thư mục dist cũ...');
fs.rmSync('dist', { recursive: true, force: true });

console.log('Đang tạo thư mục dist mới...');
fs.mkdirSync('dist');

console.log('Đang copy giao diện (public)...');
copyDir('public', 'dist');

console.log('Đang copy API xử lý (functions)...');
copyDir('functions', 'dist/functions');

console.log('\n✅ HOÀN TẤT! Thư mục "dist" đã sẵn sàng.');
console.log('👉 Bây giờ bạn có thể kéo thả thư mục "dist" này lên Cloudflare Pages để upload thủ công.');
