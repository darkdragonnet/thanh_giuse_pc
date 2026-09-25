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
   * Dọn dẹp tệp ảnh tạm thời trên ổ đĩa
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
}

module.exports = new ImageService();
