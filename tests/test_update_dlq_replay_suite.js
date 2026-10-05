require('dotenv').config();
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Redis = require('ioredis');
const { pool } = require('../src/config/database');
const hanetService = require('../src/services/hanetService');
const queueService = require('../src/services/queueService');
const idempotencyService = require('../src/services/idempotencyService');
const { HanetApiError } = require('../src/services/hanetService');
const { redisConfig, MAIN_QUEUE_NAME, DLQ_QUEUE_NAME, defaultJobOptions } = require('../src/config/queueConfig');
const {
  ConfigurationError,
  isLoopbackHost,
  validateAndNormalizeBaseUrl,
  getPublicBaseUrl,
  sanitizeFilename,
  verifyUploadFilePath,
  buildPublicImageUrl,
  sanitizeImageUrl
} = require('../src/utils/urlHelper');
const {
  redactSecrets,
  stripHtml,
  stripControlChars,
  sanitizeErrorMessage,
  validateAndParseReturnCode
} = require('../src/utils/sanitizer');
const {
  generateRandomToken,
  generateLockKey,
  generateCliReplayLockKey,
  generateReplayStateKey,
  acquireReplayLock,
  releaseReplayLock,
  extendReplayLock,
  isWorkerProcessing
} = require('../src/utils/lockHelper');
const {
  normalizeDLQJobPayload,
  verifyAndSyncImageTriad,
  PayloadValidationError
} = require('../src/utils/dlqPayloadHelper');
const { EXIT_CODES } = require('../scripts/replay_dlq_job');

async function runSuite() {
  console.log('===============================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN: UPDATE PERSON & DLQ REPLAY SUITE');
  console.log('===============================================================');

  let passedTests = 0;
  let totalTests = 0;

  async function testCase(name, fn) {
    totalTests++;
    process.stdout.write(`[TC-${String(totalTests).padStart(2, '0')}] ${name} ... `);
    try {
      await fn();
      console.log('✅ PASS');
      passedTests++;
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      console.error(err);
    }
  }

  const suiteClass = 'SUITE_TEST_UPDATE_' + Date.now();
  await pool.query('INSERT INTO classes (name, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [suiteClass, '990653']);

  const testRedis = new Redis(redisConfig);
  await testRedis.ping();

  try {
    /* =========================================================================
     * PHẦN 1: PARSER & ERROR HANDLING TESTS
     * ========================================================================= */

    // TC-01: returnCode = 1 và '1'; data dạng số (bao gồm 0), null, chuỗi, object
    await testCase('Parser: returnCode = 1 và "1" thành công với data dạng số (kể cả 0), null, object', async () => {
      const resNum = { status: 200, data: { returnCode: 1, returnMessage: 'Success', data: 990123 } };
      const parsedNum = hanetService.parseHanetResponse(resNum, '/person/register');
      assert.strictEqual(parsedNum.returnCode, 1);
      assert.strictEqual(parsedNum.data, 990123);

      const resZero = { status: 200, data: { returnCode: 1, returnMessage: 'Success', data: 0 } };
      const parsedZero = hanetService.parseHanetResponse(resZero, '/person/register');
      assert.strictEqual(parsedZero.data, 0);

      const resStr = { status: 200, data: { returnCode: '1', returnMessage: 'Success', data: '12345' } };
      const parsedStr = hanetService.parseHanetResponse(resStr, '/person/register');
      assert.strictEqual(parsedStr.returnCode, '1');

      const resNull = { status: 200, data: { returnCode: 1, returnMessage: 'Success', data: null } };
      const parsedNull = hanetService.parseHanetResponse(resNull, '/person/updateByFaceUrl');
      assert.strictEqual(parsedNull.data, null);

      const resObj = { status: 200, data: { returnCode: 1, returnMessage: 'Success', data: { personID: '123' } } };
      const parsedObj = hanetService.parseHanetResponse(resObj, '/person/updateInfo');
      assert.deepStrictEqual(parsedObj.data, { personID: '123' });
    });

    // TC-02: returnCode = -9007, -103, 0 ném HanetApiError chứa đầy đủ mã lỗi
    await testCase('Parser: returnCode = -9007, -103, 0 ném HanetApiError chứa đầy đủ mã lỗi', async () => {
      assert.throws(() => {
        hanetService.parseHanetResponse(
          { status: 200, data: { returnCode: -9007, returnMessage: 'Face already exists', data: { personID: '888' } } },
          '/person/register'
        );
      }, (err) => {
        return err instanceof HanetApiError && err.returnCode === -9007 && err.httpStatus === 200 && err.data?.personID === '888';
      });

      assert.throws(() => {
        hanetService.parseHanetResponse(
          { status: 200, data: { returnCode: -103, returnMessage: 'Token expired' } },
          '/person/updateInfo'
        );
      }, (err) => {
        return err instanceof HanetApiError && err.returnCode === -103;
      });

      assert.throws(() => {
        hanetService.parseHanetResponse(
          { status: 200, data: { returnCode: 0, returnMessage: 'Generic fail' } },
          '/person/updateInfo'
        );
      }, (err) => {
        return err instanceof HanetApiError && err.returnCode === 0;
      });
    });

    // TC-03: Thiếu returnCode nhưng có code = 1 (tuyệt đối không fallback sang code)
    await testCase('Parser: Thiếu returnCode nhưng có code=1 bị từ chối và ném HanetApiError', async () => {
      assert.throws(() => {
        hanetService.parseHanetResponse(
          { status: 200, data: { code: 1, message: 'Missing returnCode' } },
          '/person/updateInfo'
        );
      }, (err) => {
        return err instanceof HanetApiError && err.returnCode === null;
      });
    });

    // TC-04: Từ chối boolean true/false, array [1], object, chuỗi rỗng và số không an toàn
    await testCase('Parser: Từ chối boolean, array, object, chuỗi rỗng và số không nguyên (1.5, NaN)', async () => {
      const invalidReturnCodes = [true, false, [1], [], {}, '', '   ', 1.5, NaN, Infinity, -Infinity, '1abc'];
      for (const val of invalidReturnCodes) {
        assert.throws(() => {
          hanetService.parseHanetResponse(
            { status: 200, data: { returnCode: val, returnMessage: 'Test' } },
            '/person/updateInfo'
          );
        }, (err) => {
          return err instanceof HanetApiError && err.returnCode === null;
        }, `Phải từ chối giá trị: ${JSON.stringify(val)}`);
      }
    });

    // TC-05: HTTP lỗi (400, 500, 502) dù body có returnCode: 1 vẫn ném HanetApiError
    await testCase('Parser: HTTP lỗi (400, 500, 502) dù body có returnCode: 1 vẫn ném HanetApiError', async () => {
      assert.throws(() => {
        hanetService.parseHanetResponse(
          { status: 500, data: { returnCode: 1, returnMessage: 'Gateway Crash' } },
          '/person/updateInfo'
        );
      }, (err) => {
        return err instanceof HanetApiError && err.httpStatus === 500 && err.isTransportError === false;
      });

      assert.throws(() => {
        hanetService.parseHanetResponse(
          { status: 400, data: { returnCode: 1, returnMessage: 'Bad request from edge' } },
          '/person/updateByFaceUrl'
        );
      }, (err) => {
        return err instanceof HanetApiError && err.httpStatus === 400;
      });
    });

    // TC-06: HTTP status thiếu/sai và body HTML/non-JSON
    await testCase('Parser: Response không có HTTP status và body HTML được xử lý an toàn', async () => {
      assert.throws(() => {
        hanetService.parseHanetResponse(
          { data: '<html>502 Bad Gateway</html>' },
          '/person/updateInfo'
        );
      }, (err) => {
        return err instanceof HanetApiError && err.httpStatus === null && err.returnCode === null;
      });
    });

    // TC-07: isAuthError phát hiện 401/-103
    await testCase('Token Refresh: isAuthError phát hiện 401/-103 và dừng lại sau 1 lần retry', async () => {
      const isAuth401 = hanetService.isAuthError({ httpStatus: 401 });
      assert.strictEqual(isAuth401, true);

      const isAuth103 = hanetService.isAuthError({ returnCode: -103 });
      assert.strictEqual(isAuth103, true);

      const isNormal = hanetService.isAuthError({ httpStatus: 400, returnCode: -9005 });
      assert.strictEqual(isNormal, false);
    });

    /* =========================================================================
     * PHẦN 2: SANITIZER & SECURITY LOGGING TESTS
     * ========================================================================= */

    // TC-08: Sanitizer che Bearer token, query, JSON và colon format
    await testCase('Sanitizer: Che Bearer token, token/secret dạng query, JSON và colon trong thông báo lỗi', async () => {
      const secretToken = 'SECRET_TOKEN_XYZ_1234567890';
      const secretPass = 'SUPER_SECRET_PASSWORD_999';

      const rawMsg = `Error with Bearer ${secretToken} and ?token=${secretToken}&password=${secretPass} and {"client_secret":"${secretToken}"} and token: ${secretToken}`;
      const sanitized = sanitizeErrorMessage(rawMsg);

      assert.strictEqual(sanitized.includes(secretToken), false, 'Không được lộ secretToken');
      assert.strictEqual(sanitized.includes(secretPass), false, 'Không được lộ secretPass');
      assert.ok(sanitized.includes('[REDACTED]'), 'Phải chứa [REDACTED]');
    });

    // TC-09: Sanitizer loại bỏ thẻ HTML, ký tự điều khiển và cắt ngắn <= 150 ký tự
    await testCase('Sanitizer: Loại bỏ HTML tags, ký tự điều khiển (\\r\\n\\t) và cắt ngắn <= 150 ký tự', async () => {
      const longHtml = '<html>\r\n\t<head><title>502 Bad Gateway</title></head>\r\n<body><h1>502 Bad Gateway</h1><p>' + 'A'.repeat(300) + '</p></body></html>';
      const sanitized = sanitizeErrorMessage(longHtml, 150);

      assert.strictEqual(sanitized.includes('<'), false, 'Không được chứa thẻ HTML');
      assert.strictEqual(sanitized.includes('\n'), false, 'Không được chứa newline');
      assert.strictEqual(sanitized.includes('\t'), false, 'Không được chứa tab');
      assert.ok(sanitized.length <= 150, `Độ dài phải <= 150 ký tự (thực tế: ${sanitized.length})`);
    });

    /* =========================================================================
     * PHẦN 3: PUBLIC URL & HOST VALIDATION TESTS
     * ========================================================================= */

    // TC-10: Public URL hợp lệ và hỗ trợ base path chuẩn xác
    await testCase('URL Helper: Chấp nhận Public URL hợp lệ, bảo toàn base path không nhân đôi slashes', async () => {
      const originalBase = process.env.BASE_URL;
      const originalApp = process.env.PUBLIC_APP_URL;

      try {
        delete process.env.PUBLIC_APP_URL;
        process.env.BASE_URL = 'https://dioceseserver.org/api/v1/';
        const url = buildPublicImageUrl('my_photo.jpg');
        assert.strictEqual(url, 'https://dioceseserver.org/api/v1/uploads/my_photo.jpg');
      } finally {
        process.env.BASE_URL = originalBase;
        if (originalApp) process.env.PUBLIC_APP_URL = originalApp;
      }
    });

    // TC-11: Từ chối not-a-url, thiếu protocol và giao thức không được phép (ftp, javascript)
    await testCase('URL Helper: Từ chối not-a-url, thiếu protocol và giao thức không hợp lệ', async () => {
      const invalidUrls = ['not_a_valid_url', 'dioceseserver.org', 'ftp://dioceseserver.org', 'javascript:alert(1)'];
      for (const raw of invalidUrls) {
        assert.throws(() => {
          validateAndNormalizeBaseUrl(raw, true);
        }, (err) => {
          return err instanceof ConfigurationError;
        });
      }
    });

    // TC-12: Chặn localhost, IPv4 loopback, IPv6 và IPv4-mapped IPv6
    await testCase('URL Helper: Chặn localhost, IPv4 loopback (127.0.0.1, 127.1, 0.0.0.0), IPv6 (::1) và IPv4-mapped IPv6', async () => {
      const loopbacks = [
        'http://localhost:3000',
        'http://127.0.0.1:8080',
        'http://127.1:3000',
        'http://127.0.1.1:3000',
        'http://0.0.0.0:3000',
        'http://[::1]:3000',
        'http://[::ffff:127.0.0.1]:3000',
        'http://0x7f000001:3000',
        'http://0177.0.0.1:3000'
      ];

      for (const raw of loopbacks) {
        assert.throws(() => {
          validateAndNormalizeBaseUrl(raw, false);
        }, (err) => {
          return err instanceof ConfigurationError;
        });
      }
    });

    // TC-13: Từ chối credentials (user:pass), query và fragment trong base URL
    await testCase('URL Helper: Từ chối credentials (user:pass), query (?key=val) và fragment (#hash) trong base URL', async () => {
      const badBaseUrls = [
        'https://admin:secret@dioceseserver.org',
        'https://dioceseserver.org/base?token=123',
        'https://dioceseserver.org/base#section'
      ];

      for (const raw of badBaseUrls) {
        assert.throws(() => {
          validateAndNormalizeBaseUrl(raw, true);
        }, (err) => {
          return err instanceof ConfigurationError;
        });
      }
    });

    // TC-14: Mã hóa ký tự đặc biệt trong filename và chặn path traversal (../../)
    await testCase('URL Helper: Mã hóa ký tự đặc biệt trong filename và chặn path traversal (../../)', async () => {
      const originalBase = process.env.BASE_URL;
      try {
        process.env.BASE_URL = 'https://dioceseserver.org';
        const safeUrl = buildPublicImageUrl('dlq_ảnh học sinh [test] #1.jpg');
        assert.strictEqual(safeUrl, 'https://dioceseserver.org/uploads/dlq_%E1%BA%A3nh%20h%E1%BB%8Dc%20sinh%20%5Btest%5D%20%231.jpg');

        const sanitized = sanitizeFilename('../../../etc/passwd');
        assert.strictEqual(sanitized, 'passwd');
      } finally {
        process.env.BASE_URL = originalBase;
      }
    });

    // TC-15: Production hoặc live HANET gọi thiếu Public URL ném ConfigurationError
    await testCase('URL Helper: Production hoặc live HANET gọi thiếu Public URL ném ConfigurationError', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalBase = process.env.BASE_URL;
      const originalApp = process.env.PUBLIC_APP_URL;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.BASE_URL;
        delete process.env.PUBLIC_APP_URL;
        delete process.env.APP_URL;

        assert.throws(() => {
          buildPublicImageUrl('test.jpg');
        }, (err) => {
          return err instanceof ConfigurationError;
        });
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalBase) process.env.BASE_URL = originalBase;
        if (originalApp) process.env.PUBLIC_APP_URL = originalApp;
      }
    });

    /* =========================================================================
     * PHẦN 4: ATOMIC LOCK & OWNERSHIP TESTS (PHASE 1)
     * ========================================================================= */

    // TC-16: Quyền sở hữu khóa Replay bằng Lua: CLI B không thể xóa khóa của CLI A
    await testCase('Lock Ownership: CLI B acquire thất bại KHÔNG THỂ xóa khóa của CLI A qua Lua script', async () => {
      const testDlqId = `test_lock_${Date.now()}`;
      const lockKey = generateCliReplayLockKey(testDlqId);

      // CLI A acquire khóa thành công
      const lockA = await acquireReplayLock(testRedis, testDlqId, 30);
      assert.strictEqual(lockA.acquired, true);
      assert.ok(lockA.token);

      // CLI B cố tình acquire cùng khóa -> Thất bại
      const lockB = await acquireReplayLock(testRedis, testDlqId, 30);
      assert.strictEqual(lockB.acquired, false);
      assert.strictEqual(lockB.token, null);

      // CLI B cố giải phóng với token giả hoặc token rỗng -> Bị từ chối
      const bReleaseFake = await releaseReplayLock(testRedis, lockKey, 'FAKE_TOKEN_CLI_B');
      assert.strictEqual(bReleaseFake, false);

      // Khóa của CLI A vẫn còn nguyên vẹn trên Redis
      const valAfterB = await testRedis.get(lockKey);
      assert.strictEqual(valAfterB, lockA.token);

      // CLI A giải phóng với token chuẩn -> Thành công
      const aRelease = await releaseReplayLock(testRedis, lockKey, lockA.token);
      assert.strictEqual(aRelease, true);

      const valAfterA = await testRedis.get(lockKey);
      assert.strictEqual(valAfterA, null);
    });

    // TC-17: Khóa hết hạn và đổi chủ: Chủ cũ không thể xóa khóa của chủ mới
    await testCase('Lock Ownership: Khóa hết hạn đổi chủ mới, token chủ cũ không thể xóa khóa mới', async () => {
      const testDlqId = `test_expired_${Date.now()}`;
      const lockKey = generateCliReplayLockKey(testDlqId);

      const oldToken = 'OLD_OWNER_TOKEN_123';
      const newToken = 'NEW_OWNER_TOKEN_456';

      // Giả lập khóa cũ đã hết hạn và chủ mới đã chiếm khóa
      await testRedis.set(lockKey, newToken, 'EX', 30);

      // Chủ cũ cố tình gọi release với oldToken -> Không xóa được
      const oldReleaseResult = await releaseReplayLock(testRedis, lockKey, oldToken);
      assert.strictEqual(oldReleaseResult, false);

      // Khóa của chủ mới vẫn còn nguyên
      const currentVal = await testRedis.get(lockKey);
      assert.strictEqual(currentVal, newToken);

      // Dọn dẹp
      await releaseReplayLock(testRedis, lockKey, newToken);
    });

    /* =========================================================================
     * PHẦN 5: RESILIENT REPLAY & FAILURE WINDOWS TESTS (PHASE 2)
     * ========================================================================= */

    // TC-18: Replay State lưu trữ liên kết bền vững và phát hiện ALREADY_ENQUEUED
    await testCase('Resilient Replay: Ghi nhận replay state và phát hiện ALREADY_ENQUEUED chống trùng lặp', async () => {
      const testDlqId = `dlq_state_test_${Date.now()}`;
      const replayStateKey = generateReplayStateKey(testDlqId);

      // Giả lập trạng thái đã enqueued trước đó
      const mockState = {
        status: 'ENQUEUED',
        dlqJobId: testDlqId,
        mainJobId: 'main_job_9999',
        replayedAt: new Date().toISOString()
      };
      await testRedis.set(replayStateKey, JSON.stringify(mockState), 'EX', 3600);

      // Kiểm tra đọc lại
      const rawState = await testRedis.get(replayStateKey);
      const parsedState = JSON.parse(rawState);
      assert.strictEqual(parsedState.status, 'ENQUEUED');
      assert.strictEqual(parsedState.mainJobId, 'main_job_9999');

      // Dọn dẹp
      await testRedis.del(replayStateKey);
    });

    /* =========================================================================
     * PHẦN 6: DLQ PAYLOAD NORMALIZATION & CONFLICT DETECTION (PHASE 4)
     * ========================================================================= */

    // TC-19: Chuẩn hóa DLQ payload legacy (jobData) và mới (originalData), bảo toàn PersonID dạng chuỗi
    await testCase('DLQ Payload: Chuẩn hóa payload jobData / originalData và bảo toàn personID dạng chuỗi', async () => {
      // 1. Format A: jobData + jobName
      const jobA = {
        id: '101',
        name: 'dead_letter_job',
        data: {
          originalJobId: 'main_101',
          jobName: 'update_person_job',
          jobData: {
            personID: '0099881122', // String có số 0 ở đầu
            name: 'Nguyen Van A',
            imagePath: '/uploads/a.jpg',
            isPhotoOnly: true
          }
        }
      };
      const normA = normalizeDLQJobPayload(jobA);
      assert.strictEqual(normA.jobName, 'update_person_job');
      assert.strictEqual(normA.personID, '0099881122');
      assert.strictEqual(typeof normA.personID, 'string');
      assert.strictEqual(normA.isPhotoOnly, true);

      // 2. Format B: originalData + originalJobName
      const jobB = {
        id: '102',
        data: {
          originalJobId: 'main_102',
          originalJobName: 'register_person_job',
          originalData: {
            aliasID: 'TN_THEMSUC_XYZ',
            name: 'Tran Thi B'
          }
        }
      };
      const normB = normalizeDLQJobPayload(jobB);
      assert.strictEqual(normB.jobName, 'register_person_job');
      assert.strictEqual(normB.aliasID, 'TN_THEMSUC_XYZ');
    });

    // TC-20: Phát hiện xung đột dữ liệu (jobData.personID !== originalData.personID) và ném lỗi an toàn
    await testCase('DLQ Payload: Phát hiện xung đột định danh giữa jobData và originalData (ném PAYLOAD_CONFLICT)', async () => {
      const conflictJob = {
        id: '103',
        data: {
          jobData: { personID: '111111', name: 'A' },
          originalData: { personID: '222222', name: 'A' }
        }
      };

      assert.throws(() => {
        normalizeDLQJobPayload(conflictJob);
      }, (err) => {
        return err instanceof PayloadValidationError && err.code === 'PAYLOAD_CONFLICT';
      });
    });

    // TC-21: Từ chối job không thể xác định loại (không tự mặc định thành register_person_job)
    await testCase('DLQ Payload: Từ chối job không nhận diện được loại (ném UNSUPPORTED_JOB_TYPE)', async () => {
      const unknownJob = {
        id: '104',
        name: 'some_random_event',
        data: { foo: 'bar' }
      };

      assert.throws(() => {
        normalizeDLQJobPayload(unknownJob);
      }, (err) => {
        return err instanceof PayloadValidationError && err.code === 'UNSUPPORTED_JOB_TYPE';
      });
    });

    /* =========================================================================
     * PHẦN 7: CLI SCRIPTS & WORKER INTEGRITY TESTS
     * ========================================================================= */

    // TC-22: scripts/list_dlq_jobs.js chạy ở chế độ chỉ đọc, không start processor và thoát với exit code 0
    await testCase('CLI: scripts/list_dlq_jobs.js chạy ở chế độ chỉ đọc, không start processor và thoát với exit code 0', async () => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'list_dlq_jobs.js');
      assert.strictEqual(fs.existsSync(scriptPath), true);

      let output = '';
      let exitCode = 0;
      try {
        output = execSync(`node "${scriptPath}" --limit 5`, { encoding: 'utf-8', stdio: 'pipe' });
      } catch (e) {
        exitCode = e.status;
      }

      assert.strictEqual(exitCode, 0, 'list_dlq_jobs.js phải thoát với exit code 0');
      assert.ok(output.includes('DANH SÁCH DEAD LETTER QUEUE (DLQ)'), 'Phải in tiêu đề DLQ');
    });

    // TC-23: scripts/replay_dlq_job.js trả exit code 1 khi DLQ job ID không tồn tại
    await testCase('CLI: scripts/replay_dlq_job.js trả exit code 1 khi DLQ job ID không tồn tại', async () => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'replay_dlq_job.js');
      assert.strictEqual(fs.existsSync(scriptPath), true);

      let exitCode = 0;
      try {
        execSync(`node "${scriptPath}" NON_EXISTENT_DLQ_JOB_999999`, { stdio: 'pipe' });
      } catch (e) {
        exitCode = e.status;
      }
      assert.strictEqual(exitCode, 1, 'Replay job không tồn tại phải trả exit code 1');
    });

    // TC-24: Replay DLQ từ chối khi file ảnh bị mất (không enqueue, không xóa DLQ job)
    await testCase('Replay DLQ: Từ chối khi file ảnh bị mất (không enqueue, không xóa DLQ job)', async () => {
      const nonExistentPath = path.join(process.cwd(), 'uploads', `missing_${Date.now()}.jpg`);
      let jobRemoved = false;

      const mockDLQJob = {
        id: 'dlq_test_missing_file',
        data: {
          requestId: `req_miss_${Date.now()}`,
          personId: '123458',
          aliasID: 'TN_TEST_MISSING',
          imagePath: nonExistentPath,
          imageFilename: path.basename(nonExistentPath),
          publicImageUrl: `https://test.domain/uploads/${path.basename(nonExistentPath)}`
        },
        remove: async () => { jobRemoved = true; }
      };

      const originalGetJob = queueService.deadLetterQueue.getJob;
      const originalAdd = queueService.registrationQueue.add;
      let enqueued = false;

      queueService.deadLetterQueue.getJob = async () => mockDLQJob;
      queueService.registrationQueue.add = async () => { enqueued = true; };

      try {
        const result = await queueService.retryDLQJob('dlq_test_missing_file');
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.code, 'IMAGE_NOT_FOUND');
        assert.strictEqual(enqueued, false);
        assert.strictEqual(jobRemoved, false);
      } finally {
        queueService.deadLetterQueue.getJob = originalGetJob;
        queueService.registrationQueue.add = originalAdd;
      }
    });

    // TC-25: Replay DLQ cập nhật đồng bộ triad ảnh (imagePath, imageFilename, publicImageUrl) và không sinh dlq_dlq_ kép
    await testCase('Replay DLQ: Đồng bộ triad ảnh (imagePath, imageFilename, publicImageUrl) và không sinh dlq_dlq_ kép', async () => {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const baseName = `test_triad_${Date.now()}.jpg`;
      const dlqName = `dlq_${baseName}`;
      const dlqPath = path.join(uploadsDir, dlqName);
      fs.writeFileSync(dlqPath, 'MOCK_IMAGE_DATA');

      const mockDLQJob = {
        id: 'dlq_job_triad_test',
        data: {
          requestId: `req_triad_${Date.now()}`,
          personId: '123456',
          aliasID: 'TN_THEMSUC1A_TRIAD',
          name: 'Nguyen Van Triad',
          imagePath: path.join(uploadsDir, baseName),
          imageFilename: baseName,
          publicImageUrl: `https://test.domain/uploads/${baseName}`,
          isPhotoOnly: true
        },
        remove: async () => {}
      };

      const originalGetJob = queueService.deadLetterQueue.getJob;
      const originalAdd = queueService.registrationQueue.add;
      let addedPayload = null;

      queueService.deadLetterQueue.getJob = async () => mockDLQJob;
      queueService.registrationQueue.add = async (name, payload) => {
        addedPayload = payload;
        return { id: 'new_replayed_triad_job' };
      };

      try {
        const result = await queueService.retryDLQJob('dlq_job_triad_test');
        assert.strictEqual(result.success, true);
        assert.ok(addedPayload);
        assert.strictEqual(addedPayload.imageFilename, dlqName);
        assert.strictEqual(addedPayload.imagePath, dlqPath);
        assert.ok(addedPayload.publicImageUrl.endsWith(dlqName));
        assert.strictEqual(addedPayload.imageFilename.includes('dlq_dlq_'), false);
      } finally {
        queueService.deadLetterQueue.getJob = originalGetJob;
        queueService.registrationQueue.add = originalAdd;
        if (fs.existsSync(dlqPath)) fs.unlinkSync(dlqPath);
      }
    });

    // TC-26: Chống tranh chấp Replay khi worker khác đang PROCESSING
    await testCase('Replay DLQ: Chống tranh chấp khi worker khác đang PROCESSING', async () => {
      const testPersonId = '123459';
      const testReqId = `req_lock_test_${Date.now()}`;
      const lockKey = idempotencyService.generateKey('PERSON_UPDATE', testPersonId, testReqId);

      await idempotencyService.acquireLock(lockKey, 300);

      const uploadsDir = path.join(process.cwd(), 'uploads');
      const testImg = path.join(uploadsDir, `lock_test_${Date.now()}.jpg`);
      fs.writeFileSync(testImg, 'MOCK_IMG');

      const mockDLQJob = {
        id: 'dlq_job_test_lock',
        data: {
          requestId: testReqId,
          personId: testPersonId,
          aliasID: 'TN_TEST_LOCK',
          imagePath: testImg,
          imageFilename: path.basename(testImg),
          publicImageUrl: `https://test.domain/uploads/${path.basename(testImg)}`
        },
        remove: async () => {}
      };

      const originalGetJob = queueService.deadLetterQueue.getJob;
      queueService.deadLetterQueue.getJob = async () => mockDLQJob;

      try {
        const result = await queueService.retryDLQJob('dlq_job_test_lock');
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.code, 'LOCKED_IN_PROCESSING');
      } finally {
        queueService.deadLetterQueue.getJob = originalGetJob;
        await idempotencyService.releaseLock(lockKey);
        if (fs.existsSync(testImg)) fs.unlinkSync(testImg);
      }
    });

    // TC-27: Worker DB: Ghi kết quả DB thất bại làm rollback transaction (không nuốt lỗi)
    await testCase('Worker DB: Ghi kết quả DB thất bại làm rollback transaction (không nuốt lỗi)', async () => {
      const testAlias = `TN_TX_${Date.now().toString(36).toUpperCase()}`;

      await pool.query(
        `INSERT INTO persons (alias_id, name, class_name, department_id, title, sync_status)
         VALUES ($1, 'Tx Test Person', $2, '990653', 'Học Sinh', 'PENDING')`,
        [testAlias, suiteClass]
      );

      const client = await pool.connect();
      let txRollbackHappened = false;
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE persons SET sync_status = 'SYNCED', person_id = '999999' WHERE alias_id = $1`,
          [testAlias]
        );
        await client.query(
          `INSERT INTO registration_requests (request_id, alias_id, name, class_name, operation_type, status)
           VALUES (NULL, $1, 'Invalid Person', $2, 'REGISTER_NEW', 'COMPLETED')`,
          [testAlias, suiteClass]
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        txRollbackHappened = true;
      } finally {
        client.release();
      }

      assert.strictEqual(txRollbackHappened, true);
      const checkPerson = await pool.query('SELECT sync_status, person_id FROM persons WHERE alias_id = $1', [testAlias]);
      assert.strictEqual(checkPerson.rows[0].sync_status, 'PENDING');
      assert.strictEqual(checkPerson.rows[0].person_id, null);

      await pool.query('DELETE FROM persons WHERE alias_id = $1', [testAlias]);
    });

    // TC-28: Worker DB: Không cập nhật nhầm hồ sơ khi alias_id và person_id không khớp
    await testCase('Worker DB: Không cập nhật nhầm hồ sơ khi alias_id và person_id không khớp', async () => {
      const aliasA = `TN_PERSON_A_${Date.now().toString(36).toUpperCase()}`;
      const aliasB = `TN_PERSON_B_${Date.now().toString(36).toUpperCase()}`;

      await pool.query(
        `INSERT INTO persons (alias_id, name, class_name, department_id, title, person_id, sync_status)
         VALUES ($1, 'Person A', $3, '990653', 'Học Sinh', '111111', 'SYNCED'),
                ($2, 'Person B', $3, '990653', 'Học Sinh', '222222', 'SYNCED')`,
        [aliasA, aliasB, suiteClass]
      );

      const lookup = await pool.query(
        `SELECT id, alias_id, person_id FROM persons WHERE alias_id = $1`,
        [aliasA]
      );

      const row = lookup.rows[0];
      assert.strictEqual(row.alias_id, aliasA);
      assert.notStrictEqual(row.person_id, '222222');

      await pool.query('DELETE FROM persons WHERE class_name = $1', [suiteClass]);
    });

  } finally {
    try {
      await pool.query('DELETE FROM classes WHERE name = $1', [suiteClass]);
    } catch (e) {}

    if (testRedis) {
      try {
        testRedis.disconnect();
      } catch (e) {}
    }

    if (queueService && typeof queueService.closeQueues === 'function') {
      await queueService.closeQueues();
    }

    if (idempotencyService && typeof idempotencyService.close === 'function') {
      idempotencyService.close();
    }

    try {
      await pool.end();
    } catch (e) {}
  }

  console.log('===============================================================');
  console.log(`🎉 KẾT QUẢ: ĐÃ VƯỢT QUA ${passedTests}/${totalTests} BÀI KIỂM THỬ UPDATE PERSON & DLQ REPLAY.`);
  console.log('===============================================================');
  process.exitCode = passedTests === totalTests ? 0 : 1;
}

runSuite().catch(e => {
  console.error('Fatal Suite Error:', e);
  process.exitCode = 1;
});
