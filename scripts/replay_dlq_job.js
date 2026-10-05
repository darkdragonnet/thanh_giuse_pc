#!/usr/bin/env node
/**
 * scripts/replay_dlq_job.js
 * CLI Producer-only dùng để tái nạp (Replay) một job từ Dead Letter Queue vào Main Queue.
 * 
 * NGUYÊN TẮC AN TOÀN & BẢO TOÀN KIẾN TRÚC:
 * 1. KHÔNG import queueService.js, hanetService.js hay app.js (không khởi tạo worker xử lý song song).
 * 2. Yêu cầu chính xác 1 tham số duy nhất: DLQ Job ID.
 * 3. Quyền sở hữu khóa nguyên tử (Atomic Lock với token và Lua Script) chống xung đột replay.
 * 4. Kiểm tra liên kết bền vững (idempotency:dlq_replay_state:<id>) chống tạo job trùng lặp sau sự cố.
 * 5. Chuẩn hóa payload, bảo toàn personID dạng chuỗi, xác minh an toàn file ảnh và Public URL.
 * 6. Quản lý timeout hữu hạn, đóng kết nối sạch sẽ trong finally và phân biệt rõ exit codes.
 */

require('dotenv').config();
const Bull = require('bull');
const Redis = require('ioredis');
const { redisConfig, MAIN_QUEUE_NAME, DLQ_QUEUE_NAME, defaultJobOptions } = require('../src/config/queueConfig');
const { sanitizeErrorMessage } = require('../src/utils/sanitizer');
const {
  generateLockKey,
  generateCliReplayLockKey,
  generateReplayStateKey,
  acquireReplayLock,
  releaseReplayLock,
  isWorkerProcessing
} = require('../src/utils/lockHelper');
const {
  normalizeDLQJobPayload,
  verifyAndSyncImageTriad,
  PayloadValidationError
} = require('../src/utils/dlqPayloadHelper');

// Bảng mã Exit Code chuẩn hóa cho CLI Replay
const EXIT_CODES = {
  SUCCESS_ENQUEUED: 0,
  ALREADY_ENQUEUED: 0,
  REJECTED_BEFORE_ENQUEUE: 1,
  ENQUEUED_BUT_DLQ_CLEANUP_FAILED: 2,
  ENQUEUE_OUTCOME_UNKNOWN: 3,
  FATAL_ERROR: 1,
  SIGINT_INTERRUPT: 130
};

function printUsage() {
  console.log('='.repeat(88));
  console.log('📖 HƯỚNG DẪN SỬ DỤNG LỆNH REPLAY DLQ');
  console.log('='.repeat(88));
  console.log('Cú pháp: node scripts/replay_dlq_job.js <DLQ_JOB_ID>');
  console.log('');
  console.log('Ví dụ  : node scripts/replay_dlq_job.js 12');
  console.log('Ghi chú: Lấy DLQ_JOB_ID bằng lệnh: node scripts/list_dlq_jobs.js');
  console.log('='.repeat(88));
}

async function replayDLQJob() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exitCode = EXIT_CODES.REJECTED_BEFORE_ENQUEUE;
    return;
  }

  const dlqJobId = args[0].trim();
  if (!dlqJobId || !/^\w+$/.test(dlqJobId)) {
    console.error(`❌ [DLQ Replay Error] DLQ Job ID "${dlqJobId}" không hợp lệ.`);
    printUsage();
    process.exitCode = EXIT_CODES.REJECTED_BEFORE_ENQUEUE;
    return;
  }

  let redisClient = null;
  let mainQueue = null;
  let dlq = null;
  let replayLockToken = null;
  let replayLockKey = null;
  let isAborted = false;
  let timeoutHandle = null;

  // Timeout hữu hạn (8000ms) cho toàn bộ phiên thực thi CLI
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      isAborted = true;
      reject(new Error('Hết thời gian chờ kết nối Redis hoặc thực thi lệnh Replay (8000ms).'));
    }, 8000);
  });

  // Xử lý ngắt tín hiệu SIGINT/SIGTERM
  const sigintHandler = async () => {
    isAborted = true;
    console.warn('\n⚠️ [DLQ Replay] Nhận tín hiệu ngắt (SIGINT/SIGTERM). Đang hủy và giải phóng tài nguyên...');
    if (redisClient && replayLockKey && replayLockToken) {
      try { await releaseReplayLock(redisClient, replayLockKey, replayLockToken); } catch (_) {}
    }
    if (mainQueue) { try { await mainQueue.close(); } catch (_) {} }
    if (dlq) { try { await dlq.close(); } catch (_) {} }
    if (redisClient) { try { redisClient.disconnect(); } catch (_) {} }
    process.exitCode = EXIT_CODES.SIGINT_INTERRUPT;
  };
  process.once('SIGINT', sigintHandler);
  process.once('SIGTERM', sigintHandler);

  try {
    redisClient = new Redis(redisConfig);
    redisClient.on('error', (err) => {
      // Bắt lỗi kết nối Redis ngầm
    });

    mainQueue = new Bull(MAIN_QUEUE_NAME, { redis: redisConfig, defaultJobOptions });
    dlq = new Bull(DLQ_QUEUE_NAME, { redis: redisConfig });

    await Promise.race([
      Promise.all([redisClient.ping(), mainQueue.isReady(), dlq.isReady()]),
      timeoutPromise
    ]);

    if (isAborted) return;

    // 1. Kiểm tra trạng thái Replay trước đó (Kiểm tra liên kết bền vững chống Replay trùng)
    const replayStateKey = generateReplayStateKey(dlqJobId);
    const existingStateRaw = await redisClient.get(replayStateKey);
    let existingState = null;
    if (existingStateRaw) {
      try { existingState = JSON.parse(existingStateRaw); } catch (_) {}
    }

    if (existingState && existingState.status === 'ENQUEUED' && existingState.mainJobId) {
      // Kiểm tra xem job chính tương ứng có còn trong Main Queue hay không
      const existingMainJob = await mainQueue.getJob(existingState.mainJobId).catch(() => null);
      const dlqJobCheck = await dlq.getJob(dlqJobId).catch(() => null);

      if (dlqJobCheck) {
        // Enqueue lần trước đã thành công nhưng bước xóa DLQ bị gián đoạn -> Dọn dẹp DLQ ngay
        try {
          await dlqJobCheck.remove();
          console.log(`🧹 [DLQ Reconcile] Đã dọn sạch DLQ Job #${dlqJobId} (Đã được nạp thành công ở Main Job #${existingState.mainJobId}).`);
        } catch (cleanupErr) {
          console.warn(`⚠️ [DLQ Reconcile Warning] Không thể xóa DLQ Job #${dlqJobId}: ${cleanupErr.message}`);
        }
      }

      console.log('='.repeat(88));
      console.log(`ℹ️  [ALREADY_ENQUEUED] Job DLQ #${dlqJobId} đã được nạp vào Main Queue trước đó.`);
      console.log(`   - Trạng thái        : ALREADY_ENQUEUED`);
      console.log(`   - DLQ Job ID        : ${dlqJobId}`);
      console.log(`   - Main Queue Job ID : ${existingState.mainJobId}`);
      console.log(`   - Thời điểm Replay  : ${existingState.replayedAt || 'N/A'}`);
      console.log(`   - Trạng thái MainJob: ${existingMainJob ? await existingMainJob.getState() : 'Đã hoàn tất hoặc đã dọn theo retention'}`);
      console.log('='.repeat(88));
      console.log('💡 Job đã ở trong hàng đợi chính hoặc đã được xử lý. Không tạo job trùng lặp.');
      console.log('='.repeat(88));

      process.exitCode = EXIT_CODES.ALREADY_ENQUEUED;
      return;
    }

    // 2. Chiếm khóa Replay CLI (Atomic Lock với token và Lua Script)
    const lockResult = await acquireReplayLock(redisClient, dlqJobId, 60);
    if (!lockResult.acquired) {
      console.error(`⚠️ [REJECTED_BEFORE_ENQUEUE] Job DLQ #${dlqJobId} đang được replay đồng thời bởi một tiến trình khác.`);
      process.exitCode = EXIT_CODES.REJECTED_BEFORE_ENQUEUE;
      return;
    }
    replayLockKey = lockResult.key;
    replayLockToken = lockResult.token;

    // 3. Tìm job trong DLQ
    const dlqJob = await dlq.getJob(dlqJobId);
    if (!dlqJob) {
      console.error(`❌ [REJECTED_BEFORE_ENQUEUE] Không tìm thấy job có ID "${dlqJobId}" trong Dead Letter Queue.`);
      process.exitCode = EXIT_CODES.REJECTED_BEFORE_ENQUEUE;
      return;
    }

    // 4. Chuẩn hóa payload và xác thực loại job
    let normalized = null;
    try {
      normalized = normalizeDLQJobPayload(dlqJob);
    } catch (valErr) {
      console.error(`❌ [REJECTED_BEFORE_ENQUEUE] Dữ liệu job DLQ #${dlqJobId} không hợp lệ: ${valErr.message}`);
      console.error('   Job DLQ được GIỮ NGUYÊN VẸN, không enqueue.');
      process.exitCode = EXIT_CODES.REJECTED_BEFORE_ENQUEUE;
      return;
    }

    // 5. Kiểm tra khóa PROCESSING của Worker (Chống tranh chấp khi worker đang xử lý)
    const lockIdentifier = normalized.personID || normalized.aliasID;
    const lockAction = normalized.personID ? 'PERSON_UPDATE' : 'FACE_REGISTER';
    const workerLockKey = generateLockKey(lockAction, lockIdentifier, normalized.requestId || '');

    const workerIsBusy = await isWorkerProcessing(redisClient, workerLockKey);
    if (workerIsBusy) {
      console.error(`⚠️ [REJECTED_BEFORE_ENQUEUE] Tác vụ cho "${lockIdentifier}" đang trong trạng thái PROCESSING bởi Worker khác.`);
      console.error('   Hủy thao tác replay để tránh xung đột dữ liệu.');
      process.exitCode = EXIT_CODES.REJECTED_BEFORE_ENQUEUE;
      return;
    }

    // 6. Kiểm tra và đồng bộ Triad Ảnh (imagePath, imageFilename, publicImageUrl)
    let imageTriad = null;
    try {
      imageTriad = verifyAndSyncImageTriad(normalized);
    } catch (imgErr) {
      console.error(`❌ [REJECTED_BEFORE_ENQUEUE] Lỗi kiểm tra file ảnh: ${imgErr.message}`);
      console.error('   Job DLQ được GIỮ NGUYÊN VẸN, không enqueue rác vào hàng đợi.');
      process.exitCode = EXIT_CODES.REJECTED_BEFORE_ENQUEUE;
      return;
    }

    // 7. Chuẩn bị payload hoàn chỉnh để nạp lại vào Main Queue
    const originalJobId = normalized.originalJobId || dlqJob.id || 'N/A';
    const replayedPayload = {
      ...normalized.rawPayload,
      personID: normalized.personID,
      aliasID: normalized.aliasID,
      name: normalized.name,
      title: normalized.title,
      departmentID: normalized.departmentID,
      requestId: normalized.requestId,
      isPhotoOnly: normalized.isPhotoOnly,
      source_csv: normalized.source_csv,
      imagePath: imageTriad.validImagePath,
      imageFilename: imageTriad.validFilename,
      publicImageUrl: imageTriad.validPublicUrl,
      faceUrl: imageTriad.validPublicUrl || normalized.rawPayload.faceUrl,
      replayedFromDLQ: String(dlqJobId),
      originalJobId: String(originalJobId),
      replayedAt: new Date().toISOString()
    };

    // 8. Đánh dấu trạng thái chuẩn bị nạp (ENQUEUEING)
    await redisClient.set(
      replayStateKey,
      JSON.stringify({ status: 'ENQUEUEING', dlqJobId, startedAt: new Date().toISOString() }),
      'EX',
      86400
    );

    // 9. Nạp lại vào Main Queue (Có kiểm soát timeout kết quả)
    let newJob = null;
    try {
      const addPromise = mainQueue.add(normalized.jobName, replayedPayload, defaultJobOptions);
      newJob = await Promise.race([addPromise, timeoutPromise]);
    } catch (enqueueErr) {
      // Trường hợp timeout hoặc mất kết nối trong khi gửi lệnh add
      if (isAborted || enqueueErr.message.includes('Hết thời gian chờ')) {
        console.error('⚠️ [ENQUEUE_OUTCOME_UNKNOWN] Lệnh nạp job vào Main Queue đã được gửi nhưng không nhận được phản hồi kịp thời từ Redis.');
        console.error(`   Vui lòng kiểm tra Main Queue trước khi thử lại: node scripts/list_dlq_jobs.js`);
        process.exitCode = EXIT_CODES.ENQUEUE_OUTCOME_UNKNOWN;
        return;
      }
      throw enqueueErr;
    }

    // 10. Lưu liên kết bền vững: DLQ Job ID -> Main Job ID (TTL 7 ngày)
    await redisClient.set(
      replayStateKey,
      JSON.stringify({
        status: 'ENQUEUED',
        dlqJobId: String(dlqJobId),
        mainJobId: String(newJob.id),
        jobName: normalized.jobName,
        requestId: normalized.requestId || null,
        replayedAt: new Date().toISOString()
      }),
      'EX',
      7 * 86400
    );

    // 11. Xóa Job khỏi DLQ sau khi đã enqueue thành công
    let cleanupSuccess = true;
    try {
      await dlqJob.remove();
    } catch (removeErr) {
      cleanupSuccess = false;
      console.warn(`⚠️ [CẢNH BÁO] Enqueue thành công nhưng không thể xóa job #${dlqJobId} khỏi DLQ: ${sanitizeErrorMessage(removeErr.message)}`);
    }

    // 12. Báo cáo kết quả rõ ràng
    console.log('='.repeat(88));
    if (cleanupSuccess) {
      console.log(`✅ [DLQ REPLAY THÀNH CÔNG] Job DLQ #${dlqJobId} đã được đưa vào hàng đợi chính.`);
      console.log(`   - Trạng thái        : ENQUEUED`);
    } else {
      console.log(`⚠️ [ENQUEUED_BUT_DLQ_CLEANUP_FAILED] Job đã được đưa vào Main Queue nhưng chưa xóa được khỏi DLQ.`);
      console.log(`   - Trạng thái        : ENQUEUED_BUT_DLQ_CLEANUP_FAILED`);
    }
    console.log(`   - DLQ Job ID        : ${dlqJobId}`);
    console.log(`   - Original Job ID   : ${originalJobId}`);
    console.log(`   - Main Queue Job ID : ${newJob.id}`);
    console.log(`   - Job Name          : ${normalized.jobName}`);
    console.log(`   - Request ID        : ${normalized.requestId || 'N/A'}`);
    console.log(`   - Định danh         : ${normalized.personID ? `PersonID: ${normalized.personID}` : `AliasID: ${normalized.aliasID || 'N/A'}`}`);
    if (imageTriad.validFilename) {
      console.log(`   - File ảnh          : ${imageTriad.validFilename}`);
      console.log(`   - Public Image URL  : ${imageTriad.validPublicUrl}`);
    }
    console.log('='.repeat(88));
    console.log('📢 LƯU Ý QUAN TRỌNG:');
    console.log('   Trạng thái ENQUEUED chỉ xác nhận job đã nạp vào hàng đợi, KHÔNG đồng nghĩa với SYNCED.');
    console.log('   Vui lòng theo dõi log container của worker để xác nhận kết quả xử lý thực tế.');
    console.log('='.repeat(88));

    process.exitCode = cleanupSuccess ? EXIT_CODES.SUCCESS_ENQUEUED : EXIT_CODES.ENQUEUED_BUT_DLQ_CLEANUP_FAILED;

  } catch (err) {
    console.error(`❌ [DLQ Replay Fatal Error]: ${sanitizeErrorMessage(err.message)}`);
    process.exitCode = EXIT_CODES.FATAL_ERROR;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('SIGTERM', sigintHandler);

    // Giải phóng Replay Lock an toàn bằng Lua Script
    if (redisClient && replayLockKey && replayLockToken) {
      try {
        await releaseReplayLock(redisClient, replayLockKey, replayLockToken);
      } catch (_) {}
    }

    // Đóng các kết nối
    if (mainQueue) {
      try { await mainQueue.close(); } catch (_) {}
    }
    if (dlq) {
      try { await dlq.close(); } catch (_) {}
    }
    if (redisClient) {
      try { redisClient.disconnect(); } catch (_) {}
    }
  }
}

if (require.main === module) {
  replayDLQJob();
}

module.exports = { replayDLQJob, EXIT_CODES };
