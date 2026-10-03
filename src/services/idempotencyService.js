require('dotenv').config();
const Redis = require('ioredis');

class IdempotencyService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB || '4', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false
    });

    this.redis.on('error', (err) => {
      console.error('[IdempotencyService Redis Error]', err.message);
    });
  }

  /**
   * Sinh khóa Idempotency theo hành động, định danh và requestId (nếu có)
   * @param {string} action - Hành động (ví dụ: FACE_REGISTER, PERSON_UPDATE)
   * @param {string} identifier - Mã định danh duy nhất (ví dụ: AliasID, PersonID)
   * @param {string} [requestId] - Mã yêu cầu cụ thể (tùy chọn)
   * @returns {string} Khóa dạng idempotency:hanet:<ACTION>:<IDENTIFIER>
   */
  generateKey(action, identifier, requestId = '') {
    const cleanAction = String(action || 'DEFAULT').trim().toUpperCase();
    const cleanId = String(identifier || '').trim().toUpperCase();
    if (requestId) {
      const cleanReq = String(requestId).trim();
      return `idempotency:hanet:${cleanAction}:${cleanId}:${cleanReq}`;
    }
    return `idempotency:hanet:${cleanAction}:${cleanId}`;
  }

  /**
   * Chiếm khóa xử lý (Distributed Lock) với Redis SETNX
   * @param {string} key - Khóa idempotency
   * @param {number} ttlSeconds - Thời gian sống của lock (mặc định 120s = 2 phút)
   * @returns {Promise<boolean>} true nếu chiếm lock thành công, false nếu bị trùng lặp
   */
  async acquireLock(key, ttlSeconds = 120) {
    try {
      const result = await this.redis.set(key, 'PROCESSING', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      console.error(`[IdempotencyService] Lỗi khi acquireLock cho key ${key}:`, err.message);
      // Fail-open an toàn nếu Redis gặp sự cố để không làm gián đoạn nghiệp vụ
      return true;
    }
  }

  /**
   * Lấy trạng thái hiện tại của khóa trên Redis DB 4
   * @param {string} key - Khóa idempotency
   * @returns {Promise<string|null>} Giá trị hiện tại ('PROCESSING', 'COMPLETED', null,...)
   */
  async getLockStatus(key) {
    try {
      return await this.redis.get(key);
    } catch (err) {
      console.error(`[IdempotencyService] Lỗi khi getLockStatus cho key ${key}:`, err.message);
      return null;
    }
  }

  /**
   * Đánh dấu tác vụ đã hoàn tất thành công (lưu trạng thái trong TTL)
   * @param {string} key - Khóa idempotency
   * @param {number} ttlSeconds - Thời gian lưu trạng thái (mặc định 3600s = 1h)
   * @returns {Promise<boolean>}
   */
  async markCompleted(key, ttlSeconds = 3600) {
    try {
      const result = await this.redis.set(key, 'COMPLETED', 'EX', ttlSeconds);
      return result === 'OK';
    } catch (err) {
      console.error(`[IdempotencyService] Lỗi khi markCompleted cho key ${key}:`, err.message);
      return false;
    }
  }

  /**
   * Xóa khóa khi gặp lỗi tạm thời để lượt retry tiếp theo có thể chạy
   * @param {string} key - Khóa idempotency
   * @returns {Promise<boolean>}
   */
  async releaseLock(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (err) {
      console.error(`[IdempotencyService] Lỗi khi releaseLock cho key ${key}:`, err.message);
      return false;
    }
  }

  /**
   * Xóa toàn bộ lock liên quan đến alias/person để cho phép nộp yêu cầu thay ảnh mới
   * @param {string} action
   * @param {string} identifier
   */
  async clearCompleted(action, identifier) {
    try {
      const key = this.generateKey(action, identifier);
      await this.redis.del(key);
      return true;
    } catch (err) {
      console.error(`[IdempotencyService] Lỗi khi clearCompleted:`, err.message);
      return false;
    }
  }
}

module.exports = new IdempotencyService();
