#!/usr/bin/env node
/**
 * scripts/list_dlq_jobs.js
 * CLI chỉ đọc (Read-only) danh sách các jobs trong Dead Letter Queue (DLQ).
 * 
 * NGUYÊN TẮC AN TOÀN:
 * 1. KHÔNG import queueService.js, hanetService.js, app.js (không khởi tạo worker hay processor ngầm).
 * 2. KHÔNG enqueue, retry, remove hay thay đổi bất kỳ job nào.
 * 3. Hỗ trợ giới hạn số lượng (mặc định 20, tối đa 100 jobs).
 * 4. Ẩn toàn bộ thông tin nhạy cảm (token, full payload, raw face data).
 * 5. Phân biệt rõ DLQ Job ID và Original Job ID.
 * 6. Timeout hữu hạn khi Redis không phản hồi và thoát tự nhiên bằng process.exitCode.
 */

require('dotenv').config();
const Bull = require('bull');
const { redisConfig, DLQ_QUEUE_NAME } = require('../src/config/queueConfig');
const { sanitizeErrorMessage } = require('../src/utils/sanitizer');
const { normalizeDLQJobPayload } = require('../src/utils/dlqPayloadHelper');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit() {
  let limit = DEFAULT_LIMIT;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--limit' || args[i] === '-l') && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT);
      }
    } else if (/^\d+$/.test(args[i])) {
      const parsed = parseInt(args[i], 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT);
      }
    }
  }
  return limit;
}

async function listDLQJobs() {
  const limit = parseLimit();
  let deadLetterQueue = null;
  let isAborted = false;

  // Timeout hữu hạn phòng ngừa Redis không phản hồi
  let timeoutHandle = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      isAborted = true;
      reject(new Error('Hết thời gian chờ kết nối Redis/DLQ (5000ms). Vui lòng kiểm tra Redis server.'));
    }, 5000);
  });

  // Bắt tín hiệu ngắt SIGINT/SIGTERM
  const sigintHandler = async () => {
    isAborted = true;
    console.warn('\n⚠️ [List DLQ] Nhận tín hiệu ngắt (SIGINT/SIGTERM). Đang đóng kết nối...');
    if (deadLetterQueue) {
      try { await deadLetterQueue.close(); } catch (_) {}
    }
    process.exitCode = 130;
  };
  process.once('SIGINT', sigintHandler);
  process.once('SIGTERM', sigintHandler);

  try {
    deadLetterQueue = new Bull(DLQ_QUEUE_NAME, {
      redis: redisConfig,
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false }
    });

    const readyPromise = deadLetterQueue.isReady();
    await Promise.race([readyPromise, timeoutPromise]);

    if (isAborted) return;

    // Lấy thống kê số lượng jobs
    const jobCountsPromise = deadLetterQueue.getJobCounts();
    const counts = await Promise.race([jobCountsPromise, timeoutPromise]);

    const totalWaiting = counts.waiting || 0;
    const totalFailed = counts.failed || 0;
    const totalActive = counts.active || 0;
    const totalCompleted = counts.completed || 0;
    const totalJobs = totalWaiting + totalFailed + totalActive + totalCompleted;

    console.log('='.repeat(88));
    console.log(`📋 DANH SÁCH DEAD LETTER QUEUE (DLQ) — Tối đa: ${limit} jobs (Chế độ CHỈ ĐỌC)`);
    console.log(`📊 Tổng quan DLQ: Tổng cộng: ${totalJobs} | Chờ: ${totalWaiting} | Lỗi: ${totalFailed} | Đang chạy: ${totalActive}`);
    console.log('='.repeat(88));

    if (totalJobs === 0) {
      console.log('ℹ️  Dead Letter Queue hiện đang hoàn toàn trống (0 jobs).');
      console.log('='.repeat(88));
      process.exitCode = 0;
      return;
    }

    // Lấy danh sách jobs theo phạm vi limit
    const fetchPromise = deadLetterQueue.getJobs(['waiting', 'failed', 'active', 'delayed', 'completed'], 0, limit - 1, true);
    const jobs = await Promise.race([fetchPromise, timeoutPromise]);

    if (!jobs || jobs.length === 0) {
      console.log(`ℹ️  Không tìm thấy job nào trong phạm vi truy vấn (0..${limit - 1}), mặc dù DLQ có tổng cộng ${totalJobs} jobs.`);
      console.log('='.repeat(88));
      process.exitCode = 0;
      return;
    }

    console.log(`Tìm thấy ${jobs.length} job(s) trong DLQ (Hiển thị tối đa ${limit}):\n`);

    jobs.forEach((job, index) => {
      let normalized = null;
      try {
        normalized = normalizeDLQJobPayload(job);
      } catch (_) {
        normalized = {
          jobName: job.name || 'unknown_job',
          originalJobId: job.data?.originalJobId || 'N/A',
          requestId: job.data?.requestId || 'N/A'
        };
      }

      const originalJobId = normalized.originalJobId || job.data?.originalJobId || 'N/A';
      const originalJobName = normalized.jobName || job.name || 'N/A';
      const requestId = normalized.requestId || job.data?.requestId || 'N/A';
      const createdAt = job.timestamp ? new Date(job.timestamp).toISOString() : 'N/A';

      // Sanitize failure reason
      const rawReason = job.failedReason || job.data?.failedReason || job.data?.lastError || 'Không có thông tin lỗi';
      const sanitizedReason = sanitizeErrorMessage(rawReason);

      console.log(`[#${String(index + 1).padStart(2, '0')}] 🎯 DLQ Job ID       : ${job.id}`);
      console.log(`     - Original Job ID  : ${originalJobId}`);
      console.log(`     - Original Name    : ${originalJobName}`);
      console.log(`     - Request ID       : ${requestId}`);
      console.log(`     - Thời điểm tạo    : ${createdAt}`);
      console.log(`     - Lý do thất bại   : ${sanitizedReason}`);
      console.log('-'.repeat(88));
    });

    console.log('💡 Lưu ý: Khi replay, BẮT BUỘC dùng "DLQ Job ID", không dùng "Original Job ID".');
    console.log('='.repeat(88));

    process.exitCode = 0;
  } catch (err) {
    console.error(`❌ [List DLQ Error]: ${sanitizeErrorMessage(err.message)}`);
    process.exitCode = 1;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('SIGTERM', sigintHandler);

    if (deadLetterQueue) {
      try {
        await deadLetterQueue.close();
      } catch (_) {}
    }
  }
}

if (require.main === module) {
  listDLQJobs();
}

module.exports = { listDLQJobs, parseLimit };
