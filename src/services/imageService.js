const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Kiểm tra buffer có phải định dạng HEIC/HEIF không qua Magic Bytes
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isHeic(buffer) {
  if (!buffer || buffer.length < 12) return false;

  const brand = buffer.toString('ascii', 4, 12);

  return brand.includes('ftyp') && (
    brand.includes('heic') ||
    brand.includes('heix') ||
    brand.includes('hevc') ||
    brand.includes('mif1') ||
    brand.includes('msf1')
  );
}

/**
 * Giải mã ảnh HEIC/HEIF sang Sharp Instance
 * @param {Buffer} buffer
 * @returns {Promise<sharp.Sharp>}
 */
async function loadSharpInstance(buffer) {
  if (isHeic(buffer)) {
    try {
      const decode = require('heic-decode');
      const { data, width, height } = await decode({ buffer });

      return sharp(Buffer.from(data), {
        raw: {
          width,
          height,
          channels: 4
        }
      });
    } catch (err) {
      console.warn(
        '⚠️ [ImageService] heic-decode fallback error:',
        err.message
      );
    }
  }

  return sharp(buffer);
}

/**
 * Chuẩn hóa ảnh thành 1280 x 738.
 * Không dùng fit: cover vì có thể cắt mất phần đầu/cằm của người chụp.
 * @param {string|Buffer} input
 * @param {string} outputPath
 * @returns {Promise<string>}
 */
async function normalizeImage(input, outputPath) {
  let buffer;
  const isFileInput = typeof input === 'string';

  if (isFileInput) {
    buffer = fs.readFileSync(input);
  } else {
    buffer = input;
  }

  const image = await loadSharpInstance(buffer);

  await image
    .rotate()
    .resize(1280, 738, {
      fit: 'contain',
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 1
      }
    })
    .jpeg({
      quality: 90,
      mozjpeg: true
    })
    .toFile(outputPath);

  if (
    isFileInput &&
    input !== outputPath &&
    fs.existsSync(input)
  ) {
    try {
      fs.unlinkSync(input);
    } catch (e) {}
  }

  return outputPath;
}

/**
 * Xóa an toàn tệp tin nếu tồn tại
 * @param {string} filePath
 */
function deleteFileSafe(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
  }
}

class ImageService {
  constructor() {
    this.normalizeImage = normalizeImage;
    this.deleteFileSafe = deleteFileSafe;
  }

  async processFaceImage(input) {
    const filename = `processed_${Date.now()}_${Math.round(Math.random() * 1000)}.jpg`;
    const outputPath = path.join(process.cwd(), 'uploads', filename);
    const uploadsDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    if (input.filePath) {
      await normalizeImage(input.filePath, outputPath);
    } else if (input.base64String) {
      const base64Data = input.base64String.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await normalizeImage(buffer, outputPath);
    } else {
      throw new Error('Dữ liệu ảnh đầu vào không hợp lệ');
    }

    return {
      processedPath: outputPath,
      filename
    };
  }

  cleanup(filePath) {
    deleteFileSafe(filePath);
  }

  cleanupDelayed(filePath, delayMs = 30000) {
    if (!filePath) return;

    const timer = setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🧹 [ImageService] Đã dọn dẹp file sau ${delayMs / 1000}s: ${path.basename(filePath)}`);
        }
      } catch (err) {
        console.warn('⚠️ [ImageService Cleanup Warning] Lỗi xóa file:', filePath, err.message);
      }
    }, delayMs);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

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
          } catch (fileErr) {}
        }
      });
    } catch (err) {
      console.warn('⚠️ [ImageService GC Error]:', err.message);
    }
  }
}

const instance = new ImageService();
instance.normalizeImage = normalizeImage;
instance.deleteFileSafe = deleteFileSafe;

module.exports = instance;
module.exports.normalizeImage = normalizeImage;
module.exports.deleteFileSafe = deleteFileSafe;
