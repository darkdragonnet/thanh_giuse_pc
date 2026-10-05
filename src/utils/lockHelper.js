/**
 * src/utils/lockHelper.js
 * Helper xử lý Distributed Lock độc lập, an toàn nguyên tử (Atomic with Lua).
 * KHÔNG tự ý mở connection; nhận instance redis client từ caller.
 */

const crypto = require('crypto');

const LUA_RELEASE_LOCK = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

const LUA_EXTEND_LOCK = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
else
  return 0
end
`;

/**
 * Sinh token ngẫu nhiên đại diện cho quyền sở hữu khóa của tiến trình
 * @returns {string}
 */
function generateRandomToken() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Sinh khóa Idempotency theo cấu trúc chuẩn: idempotency:hanet:<ACTION>:<IDENTIFIER>[:<REQUEST_ID>]
 * @param {string} action - Hành động (PERSON_UPDATE, FACE_REGISTER, etc.)
 * @param {string} identifier - Định danh (PersonID, AliasID)
 * @param {string} [requestId] - Mã yêu cầu
 * @returns {string}
 */
function generateLockKey(action, identifier, requestId = '') {
  const cleanAction = String(action || 'DEFAULT').trim().toUpperCase();
  const cleanId = String(identifier || '').trim().toUpperCase();
  if (requestId) {
    const cleanReq = String(requestId).trim();
    return `idempotency:hanet:${cleanAction}:${cleanId}:${cleanReq}`;
  }
  return `idempotency:hanet:${cleanAction}:${cleanId}`;
}

/**
 * Sinh khóa Replay CLI riêng biệt cho từng DLQ Job ID
 * @param {string|number} dlqJobId
 * @returns {string}
 */
function generateCliReplayLockKey(dlqJobId) {
  const cleanId = String(dlqJobId || '').trim();
  return `idempotency:cli_replay:${cleanId}`;
}

/**
 * Sinh khóa lưu trữ trạng thái Replay của DLQ Job ID
 * @param {string|number} dlqJobId
 * @returns {string}
 */
function generateReplayStateKey(dlqJobId) {
  const cleanId = String(dlqJobId || '').trim();
  return `idempotency:dlq_replay_state:${cleanId}`;
}

/**
 * Chiếm khóa Replay CLI nguyên tử với token sở hữu và TTL
 * @param {object} redisClient - ioredis client instance
 * @param {string|number} dlqJobId - DLQ Job ID
 * @param {number} [ttlSeconds=60] - Thời gian sống của lock
 * @returns {Promise<{acquired: boolean, token: string|null, key: string}>}
 */
async function acquireReplayLock(redisClient, dlqJobId, ttlSeconds = 60) {
  const token = generateRandomToken();
  const key = generateCliReplayLockKey(dlqJobId);
  try {
    const result = await redisClient.set(key, token, 'EX', ttlSeconds, 'NX');
    if (result === 'OK') {
      return { acquired: true, token, key };
    }
    return { acquired: false, token: null, key };
  } catch (err) {
    return { acquired: false, token: null, key, error: err };
  }
}

/**
 * Giải phóng khóa Replay CLI bằng Lua Script nguyên tử (CHỈ xóa nếu token trùng khớp)
 * @param {object} redisClient - ioredis client instance
 * @param {string} key - Khóa lock
 * @param {string} token - Token sở hữu khóa
 * @returns {Promise<boolean>} true nếu giải phóng thành công, false nếu không sở hữu
 */
async function releaseReplayLock(redisClient, key, token) {
  if (!key || !token) return false;
  try {
    const result = await redisClient.eval(LUA_RELEASE_LOCK, 1, key, token);
    return result === 1;
  } catch (err) {
    return false;
  }
}

/**
 * Gia hạn thời gian sống của khóa (CHỈ gia hạn nếu token trùng khớp)
 * @param {object} redisClient - ioredis client instance
 * @param {string} key - Khóa lock
 * @param {string} token - Token sở hữu khóa
 * @param {number} ttlSeconds - Thời gian gia hạn mới
 * @returns {Promise<boolean>}
 */
async function extendReplayLock(redisClient, key, token, ttlSeconds = 60) {
  if (!key || !token) return false;
  try {
    const result = await redisClient.eval(LUA_EXTEND_LOCK, 1, key, token, ttlSeconds);
    return result === 1;
  } catch (err) {
    return false;
  }
}

/**
 * Kiểm tra xem Worker có đang trong trạng thái PROCESSING hay không
 * @param {object} redisClient
 * @param {string} lockKey
 * @returns {Promise<boolean>}
 */
async function isWorkerProcessing(redisClient, lockKey) {
  if (!lockKey) return false;
  try {
    const val = await redisClient.get(lockKey);
    return val === 'PROCESSING';
  } catch (err) {
    return false;
  }
}

module.exports = {
  generateRandomToken,
  generateLockKey,
  generateCliReplayLockKey,
  generateReplayStateKey,
  acquireReplayLock,
  releaseReplayLock,
  extendReplayLock,
  isWorkerProcessing,
  LUA_RELEASE_LOCK,
  LUA_EXTEND_LOCK
};
