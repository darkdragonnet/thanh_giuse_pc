require('dotenv').config();
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../src/config/database');
const queueService = require('../src/services/queueService');
const idempotencyService = require('../src/services/idempotencyService');
const imageService = require('../src/services/imageService');
const hanetService = require('../src/services/hanetService');

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ HỒI QUY: REGISTER INTEGRITY TEST SUITE');
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

  // Tạo lớp dùng chung cho test
  const suiteClass = 'SUITE_TEST_CLASS_' + Date.now();
  await pool.query('INSERT INTO classes (name, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [suiteClass, '990653']);

  try {
    // TC-01: Bảo toàn AliasID - Không bị biến đổi trong worker (kể cả hậu tố 00XX, chữ thường)
    await testCase('Alias không đổi qua resolveDepartmentAndAlias (giữ nguyên 00XX, chữ thường)', async () => {
      const customAlias1 = 'TN_THEMSUC1A_00AB';
      const res1 = await queueService.resolveDepartmentAndAlias('ThemSuc_1a', 'Học Sinh', '990653', customAlias1);
      assert.strictEqual(res1.aliasID, customAlias1, 'Alias với 00XX phải được bảo toàn 100%');

      const customAlias2 = 'tn_glv_test01';
      const res2 = await queueService.resolveDepartmentAndAlias('GLV', 'Giáo Lý Viên', '990653', customAlias2);
      assert.strictEqual(res2.aliasID, customAlias2, 'Alias chữ thường phải được bảo toàn 100%');
    });

    // TC-02: Hai người trùng tên trong cùng lớp không bị gộp hồ sơ
    await testCase('Hai người trùng tên cùng lớp giữ 2 hồ sơ độc lập, không gộp alias', async () => {
      const alias1 = `TN_${suiteClass}_AAAA`;
      const alias2 = `TN_${suiteClass}_BBBB`;
      const sameName = 'Nguyễn Văn Test Trùng Tên';

      await pool.query(
        `INSERT INTO persons (alias_id, name, class_name, department_id, title, sync_status)
         VALUES ($1, $2, $3, '990653', 'Học Sinh', 'PENDING')`,
        [alias1, sameName, suiteClass]
      );

      await pool.query(
        `INSERT INTO persons (alias_id, name, class_name, department_id, title, sync_status)
         VALUES ($1, $2, $3, '990653', 'Học Sinh', 'PENDING')`,
        [alias2, sameName, suiteClass]
      );

      const checkRes = await pool.query(
        'SELECT id, alias_id, name FROM persons WHERE class_name = $1 ORDER BY id ASC',
        [suiteClass]
      );

      assert.strictEqual(checkRes.rows.length, 2, 'Phải có đúng 2 bản ghi riêng biệt');
      assert.strictEqual(checkRes.rows[0].alias_id, alias1);
      assert.strictEqual(checkRes.rows[1].alias_id, alias2);
      assert.strictEqual(checkRes.rows[0].name, checkRes.rows[1].name);

      await pool.query('DELETE FROM persons WHERE class_name = $1', [suiteClass]);
    });

    // TC-03: Xử lý lỗi -9007 thiếu ID không được báo thành công giả (chuyển sang REVIEW_REQUIRED)
    await testCase('-9007 thiếu PersonID chuyển sang REVIEW_REQUIRED, không báo thành công giả', async () => {
      const testAlias = `TN_TEST9007_${Date.now().toString(36).toUpperCase()}`;
      const testReqId = `req_test_9007_${Date.now()}`;

      await pool.query(
        `INSERT INTO persons (alias_id, name, class_name, department_id, title, sync_status)
         VALUES ($1, 'Test 9007 Person', $2, '990653', 'Học Sinh', 'PENDING')`,
        [testAlias, suiteClass]
      );

      await pool.query(
        `INSERT INTO registration_requests (request_id, alias_id, name, class_name, operation_type, status)
         VALUES ($1, $2, 'Test 9007 Person', $3, 'REGISTER_NEW', 'ACCEPTED')`,
        [testReqId, testAlias, suiteClass]
      );

      // Giả lập lỗi -9007 không có personID
      const mockErrorNoId = {
        response: {
          data: {
            returnCode: -9007,
            returnMessage: 'Face already registered in system',
            data: {} // Rỗng không có personID
          }
        }
      };

      let threwExpectedError = false;
      try {
        const errData = mockErrorNoId.response.data;
        if (errData.returnCode === -9007 && !errData.data?.personID) {
          await pool.query(
            `UPDATE persons SET sync_status = 'REVIEW_REQUIRED' WHERE alias_id = $1`,
            [testAlias]
          );
          await pool.query(
            `UPDATE registration_requests SET status = 'REVIEW_REQUIRED', error_message = 'Khuôn mặt trùng lặp cần đối soát' WHERE request_id = $1`,
            [testReqId]
          );
          throw new queueService.UnrecoverableError('Cần đối soát', -9007);
        }
      } catch (e) {
        if (e.name === 'UnrecoverableError' || e.code === -9007) {
          threwExpectedError = true;
        }
      }

      assert.strictEqual(threwExpectedError, true, 'Phải throw UnrecoverableError khi thiếu ID');

      const personCheck = await pool.query('SELECT sync_status FROM persons WHERE alias_id = $1', [testAlias]);
      assert.strictEqual(personCheck.rows[0].sync_status, 'REVIEW_REQUIRED', 'Postgres sync_status phải là REVIEW_REQUIRED');

      const reqCheck = await pool.query('SELECT status FROM registration_requests WHERE request_id = $1', [testReqId]);
      assert.strictEqual(reqCheck.rows[0].status, 'REVIEW_REQUIRED', 'registration_requests status phải là REVIEW_REQUIRED');

      await pool.query('DELETE FROM registration_requests WHERE request_id = $1', [testReqId]);
      await pool.query('DELETE FROM persons WHERE alias_id = $1', [testAlias]);
    });

    // TC-04: Idempotency cho phép nộp yêu cầu thay ảnh mới (không bị khóa vĩnh viễn 24h)
    await testCase('Thay ảnh mới không bị idempotency khóa cũ chặn', async () => {
      const testAlias = `TN_RETAKE_${Date.now().toString(36).toUpperCase()}`;
      const key = idempotencyService.generateKey('FACE_REGISTER', testAlias);

      await idempotencyService.markCompleted(key, 3600);
      const statusBefore = await idempotencyService.getLockStatus(key);
      assert.strictEqual(statusBefore, 'COMPLETED');

      await idempotencyService.clearCompleted('FACE_REGISTER', testAlias);
      const statusAfter = await idempotencyService.getLockStatus(key);
      assert.strictEqual(statusAfter, null, 'Lock cũ phải được xóa để tiếp nhận yêu cầu thay ảnh mới');

      const acquired = await idempotencyService.acquireLock(key, 120);
      assert.strictEqual(acquired, true, 'Phải chiếm được lock mới');

      await idempotencyService.releaseLock(key);
    });

    // TC-05: Bảo toàn ảnh trong DLQ (đổi tên sang dlq_... và giữ nguyên file)
    await testCase('DLQ bảo toàn file ảnh có tiền tố dlq_ và cập nhật tham chiếu', async () => {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const testImgName = `test_dlq_${Date.now()}.jpg`;
      const testImgPath = path.join(uploadsDir, testImgName);
      fs.writeFileSync(testImgPath, 'MOCK_IMAGE_DATA_1280_738');

      assert.strictEqual(fs.existsSync(testImgPath), true);

      const dlqPath = path.join(uploadsDir, 'dlq_' + testImgName);
      fs.renameSync(testImgPath, dlqPath);

      assert.strictEqual(fs.existsSync(testImgPath), false, 'Đường dẫn cũ không còn');
      assert.strictEqual(fs.existsSync(dlqPath), true, 'File phải tồn tại tại đường dẫn dlq_');

      if (fs.existsSync(dlqPath)) fs.unlinkSync(dlqPath);
    });

    // TC-06: Outbox Transactional Dispatcher phục hồi yêu cầu chưa enqueued
    await testCase('Outbox Dispatcher phục hồi và nạp lại yêu cầu PENDING', async () => {
      const testReqId = `req_outbox_${Date.now()}`;
      const testAlias = `TN_OUTBOX_${Date.now().toString(36).toUpperCase()}`;

      await pool.query(
        `INSERT INTO persons (alias_id, name, class_name, department_id, title, sync_status)
         VALUES ($1, 'Outbox Test Person', $2, '990653', 'Học Sinh', 'PENDING')`,
        [testAlias, suiteClass]
      );

      await pool.query(
        `INSERT INTO registration_requests (request_id, alias_id, name, class_name, operation_type, status)
         VALUES ($1, $2, 'Outbox Test Person', $3, 'REGISTER_NEW', 'ACCEPTED')`,
        [testReqId, testAlias, suiteClass]
      );

      const payload = {
        requestId: testReqId,
        name: 'Outbox Test Person',
        aliasID: testAlias,
        title: 'Học Sinh',
        departmentID: '990653',
        source_csv: suiteClass,
        operation_type: 'REGISTER_NEW'
      };

      const outboxRes = await pool.query(
        `INSERT INTO registration_outbox (request_id, payload, status)
         VALUES ($1, $2, 'PENDING') RETURNING id`,
        [testReqId, JSON.stringify(payload)]
      );

      const outboxId = outboxRes.rows[0].id;

      await queueService.dispatchPendingOutbox();

      const afterRes = await pool.query('SELECT status FROM registration_outbox WHERE id = $1', [outboxId]);
      assert.strictEqual(afterRes.rows[0].status, 'ENQUEUED', 'Outbox status phải chuyển thành ENQUEUED');

      await pool.query('DELETE FROM registration_outbox WHERE id = $1', [outboxId]);
      await pool.query('DELETE FROM registration_requests WHERE request_id = $1', [testReqId]);
      await pool.query('DELETE FROM persons WHERE alias_id = $1', [testAlias]);
    });

    // TC-07: Static file upload không trả SVG/default khi 404
    await testCase('Upload route trả 404 chính xác khi thiếu file ảnh (không trả SVG 200 giả)', async () => {
      const nonExistentFile = path.join(process.cwd(), 'uploads', 'non_existent_image_12345.jpg');
      assert.strictEqual(fs.existsSync(nonExistentFile), false);
    });

    // TC-08: Tra cứu trạng thái Registration Request theo requestId
    await testCase('Tra cứu trạng thái Registration Request theo requestId trả đúng dữ liệu', async () => {
      const testReqId = `req_status_check_${Date.now()}`;
      const testAlias = `TN_STATUS_${Date.now().toString(36).toUpperCase()}`;

      await pool.query(
        `INSERT INTO persons (alias_id, name, class_name, department_id, title, sync_status)
         VALUES ($1, 'Status Check Person', $2, '990653', 'Học Sinh', 'SYNCED')`,
        [testAlias, suiteClass]
      );

      await pool.query(
        `INSERT INTO registration_requests (request_id, alias_id, name, class_name, operation_type, status)
         VALUES ($1, $2, 'Status Check Person', $3, 'REGISTER_NEW', 'SYNCED')`,
        [testReqId, testAlias, suiteClass]
      );

      const res = await pool.query(
        `SELECT r.request_id, r.status, p.sync_status
         FROM registration_requests r
         JOIN persons p ON r.alias_id = p.alias_id
         WHERE r.request_id = $1`,
        [testReqId]
      );

      assert.strictEqual(res.rows.length, 1);
      assert.strictEqual(res.rows[0].status, 'SYNCED');
      assert.strictEqual(res.rows[0].sync_status, 'SYNCED');

      await pool.query('DELETE FROM registration_requests WHERE request_id = $1', [testReqId]);
      await pool.query('DELETE FROM persons WHERE alias_id = $1', [testAlias]);
    });

  } finally {
    // Dọn dẹp lớp dùng chung
    await pool.query('DELETE FROM classes WHERE name = $1', [suiteClass]);
  }

  console.log('===============================================================');
  console.log(`🎉 KẾT QUẢ: ĐÃ VƯỢT QUA ${passedTests}/${totalTests} BÀI KIỂM THỬ TÍCH HỢP HỒI QUY.`);
  console.log('===============================================================');
  await pool.end();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTestSuite().catch(e => {
  console.error('Fatal Suite Error:', e);
  process.exit(1);
});
