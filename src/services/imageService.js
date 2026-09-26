const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Service xử lý ảnh chuyên biệt đa nền tảng
 * Chuẩn hóa tỷ lệ 1280x738, tự động xoay EXIF, nén JPEG 90%
 */
class ImageService {
  /**
   * Xử lý file tải lên từ Multer hoặc chuỗi Base64
   * @param {Object} input - { filePath, base64String }
   * @returns {Promise<{processedPath: string, filename: string}>}
   */
  async processFaceImage(input) {
    const filename = `processed_${Date.now()}_${Math.round(Math.random() * 1000)}.jpg`;
    const outputPath = path.join(process.cwd(), 'uploads', filename);

    if (!fs.existsSync(path.join(process.cwd(), 'uploads'))) {
      fs.mkdirSync(path.join(process.cwd(), 'uploads'), { recursive: true });
    }

    let sharpInstance;

    if (input.filePath) {
      sharpInstance = sharp(input.filePath);
    } else if (input.base64String) {
      const base64Data = input.base64String.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      sharpInstance = sharp(buffer);
    } else {
      throw new Error('Dữ liệu ảnh đầu vào không hợp lệ');
    }

    // Pipeline chuẩn hóa ảnh cho HANET AI Cloud
    await sharpInstance
      .rotate() // Tự động xoay ảnh theo EXIF orientation (sửa lỗi Safari / Zalo In-App Browser)
      .resize(1280, 738, {
        fit: 'cover',
        position: 'entropy' // Giữ vùng có mật độ chi tiết cao (khuôn mặt)
      })
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
      .toFile(outputPath);

    // Dọn dẹp file Multer gốc nếu có
    if (input.filePath && fs.existsSync(input.filePath)) {
      fs.unlinkSync(input.filePath);
    }

    return { processedPath: outputPath, filename };
  }

  /**
   * Dọn dẹp tệp ảnh tạm thời trên ổ đĩa (ngay lập tức)
   * @param {string} filePath 
   */
  cleanup(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn(`[ImageService Cleanup Warning] Không thể xóa file ${filePath}:`, err.message);
    }
  }

  /**
   * Dọn dẹp tệp ảnh tạm với độ trễ an toàn (mặc định 30 giây theo SDD v1.0)
   * Tránh race condition khi HANET Cloud / Cloudflare Tunnel đang tải ảnh
   * @param {string} filePath - Đường dẫn tuyệt đối của file
   * @param {number} delayMs - Thời gian chờ tính theo mili-giây (mặc định 30,000ms)
   */
  cleanupDelayed(filePath, delayMs = 30000) {
    if (!filePath) return;
    const timer = setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🧹 [ImageService] Đã dọn dẹp file sau ${delayMs / 1000}s: ${path.basename(filePath)}`);
        }
      } catch (err) {
        console.warn(`⚠️ [ImageService Cleanup Warning] Lỗi xóa file ${filePath}:`, err.message);
      }
    }, delayMs);

    // Không giữ Event Loop ngăn chặn tiến trình Node.js thoát tự nhiên
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  /**
   * Quét và dọn dẹp các file rác/mồ côi trong thư mục uploads cũ hơn maxAgeMs
   * @param {number} maxAgeMs - Tuổi thọ tối đa của file tính bằng ms (mặc định 1 giờ = 3,600,000ms)
   */
  cleanOldFiles(maxAgeMs = 60 * 60 * 1000) {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) return;
      const files = fs.readdirSync(uploadsDir);
      const now = Date.now();

      files.forEach((file) => {
        if (file.startsWith('processed_') || file.startsWith('face_')) {
          const filePath = path.join(uploadsDir, file);
          try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAgeMs) {
              fs.unlinkSync(filePath);
              console.log(`🧹 [ImageService GC] Xóa file rác cũ: ${file}`);
            }
          } catch (fileErr) {
            // File có thể đã bị xóa bởi process khác
          }
        }
      });
    } catch (err) {
      console.warn('⚠️ [ImageService GC Error]:', err.message);
    }
  }
}

module.exports = new ImageService();
