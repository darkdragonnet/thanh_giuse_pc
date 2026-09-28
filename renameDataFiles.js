const fs = require('fs');
const path = require('path');

// Đường dẫn tới thư mục data (nằm cùng cấp với project hoặc src)
const DATA_DIR = path.join(__dirname, 'data');

function renameFilesInDir() {
    if (!fs.existsSync(DATA_DIR)) {
        console.error(`❌ Không tìm thấy thư mục: ${DATA_DIR}`);
        return;
    }

    const files = fs.readdirSync(DATA_DIR);
    console.log(`📂 Đang quét thư mục ${DATA_DIR}... (Tìm thấy ${files.length} mục)`);

    let renamedCount = 0;
    let skippedCount = 0;

    files.forEach(file => {
        const fullPath = path.join(DATA_DIR, file);
        const stat = fs.statSync(fullPath);

        // Chỉ xử lý file, bỏ qua thư mục con
        if (!stat.isFile()) return;

        const ext = path.extname(file); // Ví dụ: .csv
        const baseName = path.basename(file, ext); // Ví dụ: themsuc_1a

        // Chuẩn hoá: Bỏ toàn bộ dấu '_' và CHUYỂN IN HOA
        const normalizedBaseName = baseName.replace(/_/g, '').toUpperCase();
        const newFileName = `${normalizedBaseName}${ext.toLowerCase()}`;

        // Nếu tên file đã chuẩn thì bỏ qua
        if (file === newFileName) {
            skippedCount++;
            return;
        }

        const newFullPath = path.join(DATA_DIR, newFileName);

        // Kiểm tra an toàn: Tránh ghi đè nếu file đích đã tồn tại
        if (fs.existsSync(newFullPath) && file.toLowerCase() !== newFileName.toLowerCase()) {
            console.warn(`⚠️ [BỎ QUA] File đích ${newFileName} đã tồn tại, tránh ghi đè!`);
            return;
        }

        console.log(`Đang đổi: ${file} ➔ ${newFileName}`);
        fs.renameSync(fullPath, newFullPath);
        renamedCount++;
    });

    console.log(`\n========================================`);
    console.log(`--- HOÀN TẤT CHUẨN HOÁ TÊN FILE DATA ---`);
    console.log(`- Đã đổi tên thành công : ${renamedCount} file`);
    console.log(`- Đã chuẩn sẵn (Bỏ qua) : ${skippedCount} file`);
    console.log(`========================================\n`);
}

renameFilesInDir();
