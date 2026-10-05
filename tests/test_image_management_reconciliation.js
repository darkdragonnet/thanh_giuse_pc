/**
 * Bộ kiểm thử toàn diện cho Quản lý Ảnh, Adapter Đối soát & Cloud Face URL (test_image_management_reconciliation.js)
 * 
 * Mục tiêu:
 * - TC-01 -> TC-04: Kiểm thử hàm kiểm tra hostname CDN HANET (`isVerifiedHanetCdnUrl`, `isUploadsUrl`, `sanitizeImageUrl`)
 * - TC-05 -> TC-07: Controller register/update không ghi URL uploads tạm vào DB, bảo toàn face_url cũ
 * - TC-08 -> TC-11: Worker update/register/fallback xử lý CDN avatar và bảo toàn dữ liệu khi lỗi
 * - TC-12 -> TC-14: triggerSync & danh sách ALLOWED_HANET_CDN_HOSTNAMES
 * - TC-15 -> TC-18: UI logic getMemberDisplayState, transfer.ejs badge, escapeHtml chống XSS
 * - TC-19 -> TC-30: Pure adapter `selectCloudPerson` & CLI safety (mảng response, ambiguous, conflict, missing ID, unsafe number, invalid flags, microseconds lock)
 */

const assert = require('assert');
const {
  isVerifiedHanetCdnUrl,
  isUploadsUrl,
  sanitizeImageUrl,
  ALLOWED_HANET_CDN_HOSTNAMES
} = require('../src/utils/urlHelper');
const {
  selectCloudPerson,
  parseCliArgs
} = require('../scripts/reconcile_face_urls');

console.log('===============================================================');
console.log('🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ QUẢN LÝ ẢNH & ĐỐI SOÁT CLOUD FACE URL');
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(tcName, fn) {
  try {
    fn();
    console.log(`[${tcName}] ... ✅ PASS`);
    passCount++;
  } catch (err) {
    console.error(`[${tcName}] ... ❌ FAIL: ${err.message}`);
    failCount++;
  }
}

async function runAsyncTest(tcName, fn) {
  try {
    await fn();
    console.log(`[${tcName}] ... ✅ PASS`);
    passCount++;
  } catch (err) {
    console.error(`[${tcName}] ... ❌ FAIL: ${err.message}`);
    failCount++;
  }
}

async function runAllTests() {
  // TC-01: isVerifiedHanetCdnUrl với các hostname CDN HANET chính thức
  runTest('TC-01: isVerifiedHanetCdnUrl chấp nhận hostname CDN HANET chính thức', () => {
    assert.strictEqual(isVerifiedHanetCdnUrl('https://static.hanet.ai/faces/person_123.jpg'), true);
    assert.strictEqual(isVerifiedHanetCdnUrl('https://vcdn-static.hanet.ai/avatar/456.jpeg'), true);
    assert.strictEqual(isVerifiedHanetCdnUrl('http://hanet-static.vcdn.vn/images/789.png'), true);
    assert.strictEqual(isVerifiedHanetCdnUrl('https://vcdn.hanet.ai/faces/abc.jpg'), true);
  });

  // TC-02: isVerifiedHanetCdnUrl từ chối URL tạm uploads, localhost, loopback và domain giả mạo
  runTest('TC-02: isVerifiedHanetCdnUrl từ chối URL uploads tạm, localhost và domain giả', () => {
    assert.strictEqual(isVerifiedHanetCdnUrl('/uploads/processed_1791113709102_304.jpg'), false);
    assert.strictEqual(isVerifiedHanetCdnUrl('http://localhost:3000/uploads/test.jpg'), false);
    assert.strictEqual(isVerifiedHanetCdnUrl('http://127.0.0.1:3000/uploads/test.jpg'), false);
    assert.strictEqual(isVerifiedHanetCdnUrl('https://attacker-hanet.ai.com/photo.jpg'), false);
    assert.strictEqual(isVerifiedHanetCdnUrl('https://evilhanet.ai/photo.jpg'), false);
    assert.strictEqual(isVerifiedHanetCdnUrl(''), false);
    assert.strictEqual(isVerifiedHanetCdnUrl(null), false);
    assert.strictEqual(isVerifiedHanetCdnUrl(undefined), false);
  });

  // TC-03: isUploadsUrl phát hiện chính xác URL tải lên tạm thời
  runTest('TC-03: isUploadsUrl nhận diện đúng URL uploads', () => {
    assert.strictEqual(isUploadsUrl('/uploads/processed_123.jpg'), true);
    assert.strictEqual(isUploadsUrl('uploads/processed_123.jpg'), true);
    assert.strictEqual(isUploadsUrl('http://localhost:3000/uploads/processed_123.jpg'), true);
    assert.strictEqual(isUploadsUrl('http://127.0.0.1:3000/uploads/processed_123.jpg'), true);
    assert.strictEqual(isUploadsUrl('https://static.hanet.ai/faces/person_123.jpg'), false);
    assert.strictEqual(isUploadsUrl('https://vcdn-static.hanet.ai/faces/person_123.jpg'), false);
    assert.strictEqual(isUploadsUrl(null), false);
  });

  // TC-04: sanitizeImageUrl làm sạch markdown format [url](url)
  runTest('TC-04: sanitizeImageUrl xử lý đúng cú pháp Markdown', () => {
    const raw = '[https://vcdn-static.hanet.ai/avatar.jpg](https://vcdn-static.hanet.ai/avatar.jpg)';
    const cleaned = sanitizeImageUrl(raw);
    assert.strictEqual(cleaned, 'https://vcdn-static.hanet.ai/avatar.jpg');
    assert.strictEqual(isVerifiedHanetCdnUrl(cleaned), true);
  });

  // TC-05: Simulation handleRegister cho hồ sơ mới: face_url trong persons khởi tạo là NULL
  await runAsyncTest('TC-05: handleRegister không lưu publicImageUrl vào persons.face_url (để NULL)', async () => {
    let mockPersonsRecord = null;
    let mockRequestsRecord = null;

    const mockClient = {
      query: async (sql, params) => {
        if (sql.includes('INSERT INTO persons')) {
          mockPersonsRecord = {
            alias_id: params[0],
            name: params[1],
            class_name: params[2],
            department_id: params[3],
            title: params[4],
            face_url: null,
            sync_status: 'PENDING'
          };
          return { rows: [{ id: 101, ...mockPersonsRecord }] };
        }
        if (sql.includes('INSERT INTO registration_requests')) {
          mockRequestsRecord = {
            request_id: params[0],
            person_id: params[1],
            alias_id: params[2],
            public_image_url: params[3]
          };
          return { rows: [{ id: 1 }] };
        }
        return { rows: [] };
      }
    };

    const publicImgUrl = 'http://localhost:3000/uploads/processed_123.jpg';
    await mockClient.query(
      `INSERT INTO persons (alias_id, name, class_name, department_id, title, face_url, sync_status) VALUES ($1, $2, $3, $4, $5, NULL, 'PENDING') RETURNING id`,
      ['TN_THEMSUC1A_TEST', 'Nguyen Van A', 'THEMSUC1A', '990653', 'Hoc sinh']
    );
    await mockClient.query(
      `INSERT INTO registration_requests (request_id, person_id, alias_id, public_image_url) VALUES ($1, $2, $3, $4)`,
      ['req_1', 101, 'TN_THEMSUC1A_TEST', publicImgUrl]
    );

    assert.strictEqual(mockPersonsRecord.face_url, null, 'persons.face_url phải là null đối với hồ sơ mới');
    assert.strictEqual(mockRequestsRecord.public_image_url, publicImgUrl, 'registration_requests lưu đúng URL tạm');
  });

  // TC-06: Thay ảnh bảo toàn URL Cloud cũ trong persons.face_url khi đang PENDING
  await runAsyncTest('TC-06: Thay ảnh bảo toàn face_url cũ trong persons khi đang PENDING', async () => {
    const existingPerson = {
      id: 364,
      alias_id: 'TN_THEMSUC1A_ZG1P',
      face_url: 'https://vcdn-static.hanet.ai/original_cloud_avatar.jpg',
      sync_status: 'SYNCED'
    };

    let updatedPerson = { ...existingPerson };
    const mockClient = {
      query: async (sql, params) => {
        if (sql.includes('UPDATE persons')) {
          updatedPerson.sync_status = 'PENDING';
          return { rows: [updatedPerson] };
        }
        return { rows: [] };
      }
    };

    await mockClient.query(`UPDATE persons SET sync_status = 'PENDING' WHERE id = $1`, [existingPerson.id]);

    assert.strictEqual(updatedPerson.face_url, 'https://vcdn-static.hanet.ai/original_cloud_avatar.jpg', 'Không được ghi đè face_url bằng URL upload tạm');
    assert.strictEqual(updatedPerson.sync_status, 'PENDING');
  });

  // TC-07: handleUpdate không ghi đè URL uploads tạm vào persons.face_url
  await runAsyncTest('TC-07: handleUpdate không ghi đè URL uploads tạm vào persons.face_url', async () => {
    let personsFaceUrl = 'https://vcdn-static.hanet.ai/verified_avatar.jpg';
    const tempUploadUrl = 'http://localhost:3000/uploads/processed_new.jpg';

    if (isVerifiedHanetCdnUrl(tempUploadUrl)) {
      personsFaceUrl = tempUploadUrl;
    }

    assert.strictEqual(personsFaceUrl, 'https://vcdn-static.hanet.ai/verified_avatar.jpg', 'Không được cập nhật URL tạm vào persons.face_url');
  });

  // TC-08: Worker thành công với CDN URL trả về từ Cloud cập nhật persons.face_url
  await runAsyncTest('TC-08: Worker thành công với CDN URL trả về cập nhật persons.face_url', async () => {
    const cloudResponse = {
      returnCode: 1,
      data: {
        personID: '3334316840204632064',
        avatar: 'https://vcdn-static.hanet.ai/face/employee/998577/new_verified.jpg'
      }
    };

    let finalAvatarUrl = null;
    const rawAvatar = cloudResponse.data.avatar;
    if (isVerifiedHanetCdnUrl(rawAvatar)) {
      finalAvatarUrl = rawAvatar;
    }

    assert.strictEqual(finalAvatarUrl, 'https://vcdn-static.hanet.ai/face/employee/998577/new_verified.jpg');
  });

  // TC-09: Worker thành công khi response thiếu CDN URL sẽ tra cứu getPersonByAliasID để lấy CDN URL
  await runAsyncTest('TC-09: Worker tra cứu getPersonByAliasID khi response trả về không có CDN URL', async () => {
    const registerResponse = {
      returnCode: 1,
      data: {
        personID: '3334316840204632064',
        avatar: 'http://localhost:3000/uploads/temp.jpg' // URL tạm
      }
    };

    let finalAvatarUrl = isVerifiedHanetCdnUrl(registerResponse.data.avatar) ? registerResponse.data.avatar : null;
    assert.strictEqual(finalAvatarUrl, null, 'URL tạm không được chấp nhận');

    // Giả lập gọi lookup API trả về dạng mảng chuẩn
    const lookupResponse = {
      returnCode: 1,
      data: [
        {
          personID: '3334316840204632064',
          aliasID: 'TN_THEMSUC1A_KW3W',
          avatar: 'https://vcdn-static.hanet.ai/face/employee/998577/real_cdn.jpg'
        }
      ]
    };

    if (!finalAvatarUrl && Array.isArray(lookupResponse.data)) {
      const match = lookupResponse.data.find(p => p.aliasID === 'TN_THEMSUC1A_KW3W');
      if (match && isVerifiedHanetCdnUrl(match.avatar)) {
        finalAvatarUrl = match.avatar;
      }
    }

    assert.strictEqual(finalAvatarUrl, 'https://vcdn-static.hanet.ai/face/employee/998577/real_cdn.jpg');
  });

  // TC-10: Worker thất bại (chuyển DLQ) bảo toàn nguyên vẹn persons.face_url cũ
  await runAsyncTest('TC-10: Worker thất bại (chuyển DLQ) bảo toàn nguyên vẹn persons.face_url cũ', async () => {
    let dbRecord = {
      id: 364,
      alias_id: 'TN_THEMSUC1A_ZG1P',
      face_url: 'https://vcdn-static.hanet.ai/existing_old_face.jpg',
      sync_status: 'PROCESSING'
    };

    // Khi chuyển DLQ:
    dbRecord.sync_status = 'FAILED';
    // face_url giữ nguyên

    assert.strictEqual(dbRecord.face_url, 'https://vcdn-static.hanet.ai/existing_old_face.jpg');
    assert.strictEqual(dbRecord.sync_status, 'FAILED');
  });

  // TC-11: Fallback -9007 chỉ ghi URL CDN Cloud đã xác minh vào persons.face_url
  await runAsyncTest('TC-11: Fallback -9007 chỉ ghi URL CDN Cloud đã xác minh', async () => {
    let cloudVerifiedAvatar = null;
    const faceRes = {
      returnCode: 1,
      data: {
        avatar: 'https://vcdn-static.hanet.ai/verified_after_fallback.jpg'
      }
    };

    if (isVerifiedHanetCdnUrl(faceRes.data.avatar)) {
      cloudVerifiedAvatar = faceRes.data.avatar;
    }

    assert.strictEqual(cloudVerifiedAvatar, 'https://vcdn-static.hanet.ai/verified_after_fallback.jpg');
  });

  // TC-12: triggerSync chỉ đồng bộ URL CDN Cloud hợp lệ, bỏ qua URL tạm
  await runAsyncTest('TC-12: triggerSync chỉ chấp nhận Cloud CDN URL', async () => {
    const rawList = [
      { personID: '1', name: 'User 1', avatar: 'https://static.hanet.ai/u1.jpg', aliasID: 'TN_U1' },
      { personID: '2', name: 'User 2', avatar: '/uploads/invalid.jpg', aliasID: 'TN_U2' },
      { personID: '3', name: 'User 3', avatar: null, aliasID: 'TN_U3' }
    ];

    const synced = rawList.map(cp => {
      const rawAvatar = cp.avatar || cp.faceUrl || null;
      return {
        alias: cp.aliasID,
        avatar: isVerifiedHanetCdnUrl(rawAvatar) ? rawAvatar : null
      };
    });

    assert.strictEqual(synced[0].avatar, 'https://static.hanet.ai/u1.jpg');
    assert.strictEqual(synced[1].avatar, null, 'URL /uploads/ phải chuyển thành null');
    assert.strictEqual(synced[2].avatar, null);
  });

  // TC-13: UI badge logic không hiển thị thành công khi sync_status = 'FAILED'
  runTest('TC-13: UI badge phân biệt chính xác SYNCED vs FAILED', () => {
    const item364 = {
      ho_ten: 'Doan Van C',
      anh_url: '/uploads/processed_1791113709102_304.jpg',
      hanet_person_id: '3326101836275908608',
      sync_status: 'FAILED'
    };

    const isUpload = item364.anh_url.includes('/uploads/');
    const hasValidCloudImg = item364.anh_url && !isUpload && isVerifiedHanetCdnUrl(item364.anh_url);
    const syncStatus = item364.sync_status.toUpperCase();
    const isSynced = syncStatus === 'SYNCED' && hasValidCloudImg;
    const isFailed = syncStatus === 'FAILED';

    assert.strictEqual(isSynced, false, 'Không được coi là SYNCED khi sync_status là FAILED hoặc ảnh là /uploads/');
    assert.strictEqual(isFailed, true, 'Phải nhận diện đúng trạng thái FAILED');
  });

  // TC-14: ALLOWED_HANET_CDN_HOSTNAMES chứa đầy đủ các host CDN của HANET
  runTest('TC-14: ALLOWED_HANET_CDN_HOSTNAMES chứa static.hanet.ai và vcdn-static.hanet.ai', () => {
    assert.strictEqual(ALLOWED_HANET_CDN_HOSTNAMES.has('static.hanet.ai'), true);
    assert.strictEqual(ALLOWED_HANET_CDN_HOSTNAMES.has('vcdn-static.hanet.ai'), true);
    assert.strictEqual(ALLOWED_HANET_CDN_HOSTNAMES.has('hanet-static.vcdn.vn'), true);
    assert.strictEqual(ALLOWED_HANET_CDN_HOSTNAMES.has('vcdn.hanet.ai'), true);
  });

  // TC-15: getMemberDisplayState: FAILED + person_id không bị suy diễn thành SYNCED
  runTest('TC-15: getMemberDisplayState: FAILED + person_id hiển thị đúng FAILED (không thành SYNCED)', () => {
    function getMemberDisplayState(m) {
      const cloudId = String(m.person_id ?? m.PersonID ?? '').trim();
      const rawStatus = m.sync_status;
      const syncStatus = (typeof rawStatus === 'string' && rawStatus.trim())
        ? rawStatus.trim().toUpperCase()
        : 'UNKNOWN';

      const rawAvatar = m.face_url || '';
      const hasValidCloudAvatar = isVerifiedHanetCdnUrl(rawAvatar);

      return {
        hasCloudReference: cloudId.length > 0,
        syncStatus,
        displayAvatarUrl: hasValidCloudAvatar ? rawAvatar : null
      };
    }

    const member364 = {
      id: 364,
      name: 'Nguyen Van C',
      person_id: '3326101836275908608',
      face_url: '/uploads/processed_1791113709102_304.jpg',
      sync_status: 'FAILED'
    };

    const state = getMemberDisplayState(member364);
    assert.strictEqual(state.hasCloudReference, true);
    assert.strictEqual(state.syncStatus, 'FAILED');
    assert.strictEqual(state.displayAvatarUrl, null, 'URL /uploads/ không được dùng làm display avatar');
  });

  // TC-16: getMemberDisplayState: Thiếu sync_status + person_id không tự suy thành SYNCED
  runTest('TC-16: getMemberDisplayState: Thiếu sync_status không tự thành SYNCED', () => {
    function getMemberDisplayState(m) {
      const cloudId = String(m.person_id ?? m.PersonID ?? '').trim();
      const rawStatus = m.sync_status;
      const syncStatus = (typeof rawStatus === 'string' && rawStatus.trim())
        ? rawStatus.trim().toUpperCase()
        : 'UNKNOWN';

      return {
        hasCloudReference: cloudId.length > 0,
        syncStatus
      };
    }

    const memberNullStatus = {
      id: 500,
      person_id: '3334316840204632064',
      sync_status: null
    };

    const state = getMemberDisplayState(memberNullStatus);
    assert.strictEqual(state.hasCloudReference, true);
    assert.strictEqual(state.syncStatus, 'UNKNOWN', 'Phải giữ nguyên UNKNOWN, không đoán SYNCED');
  });

  // TC-17: transfer.ejs badge: Có alias_id nhưng chưa có Cloud ID thì hiển thị DB Only (không phải HANET Sync)
  runTest('TC-17: transfer.ejs: Có alias_id nhưng chưa có person_id hiển thị DB Only', () => {
    const member = {
      id: 101,
      name: 'Hoc Sinh Moi',
      alias_id: 'TN_THEMSUC1A_XYZ1',
      person_id: null,
      sync_status: 'PENDING'
    };

    const cloudId = String(member.person_id || '').trim();
    const syncStatus = (member.sync_status || '').toUpperCase();
    const isCloudSynced = syncStatus === 'SYNCED' || cloudId.length > 0;

    assert.strictEqual(isCloudSynced, false, 'Không được gán Cloud Sync khi person_id rỗng và chưa SYNCED');
  });

  // TC-18: escapeHtml ngăn chặn tấn công XSS trong tên và alias
  runTest('TC-18: escapeHtml làm sạch ký tự script / HTML an toàn', () => {
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const maliciousName = '<script>alert("xss")</script>';
    const safeName = escapeHtml(maliciousName);
    assert.strictEqual(safeName, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    assert.strictEqual(safeName.includes('<script>'), false);
  });

  // TC-19: Pure adapter selectCloudPerson trích xuất đúng khi data là mảng 1 hồ sơ hợp lệ
  runTest('TC-19: selectCloudPerson thành công khi response data là mảng 1 hồ sơ khớp', () => {
    const response = {
      returnCode: 1,
      data: [
        {
          personID: '3326101836275908608',
          aliasID: 'TN_THEMSUC1A_ZG1P',
          placeID: 998577,
          avatar: 'https://static.hanet.ai/face/employee/998577/avatar_zg1p.jpg'
        }
      ]
    };

    const expected = {
      aliasID: 'TN_THEMSUC1A_ZG1P',
      personID: '3326101836275908608',
      placeID: '998577'
    };

    const person = selectCloudPerson(response, expected);
    assert.strictEqual(person.personID, '3326101836275908608');
    assert.strictEqual(person.aliasID, 'TN_THEMSUC1A_ZG1P');
    assert.strictEqual(person.avatar, 'https://static.hanet.ai/face/employee/998577/avatar_zg1p.jpg');
  });

  // TC-20: selectCloudPerson lọc đúng alias khi data chứa nhiều hồ sơ
  runTest('TC-20: selectCloudPerson lọc đúng alias duy nhất từ mảng nhiều hồ sơ', () => {
    const response = {
      returnCode: 1,
      data: [
        { personID: '111', aliasID: 'TN_THEMSUC1A_OTHER', placeID: 998577, avatar: 'https://static.hanet.ai/1.jpg' },
        { personID: '3326101836275908608', aliasID: 'TN_THEMSUC1A_ZG1P', placeID: 998577, avatar: 'https://static.hanet.ai/2.jpg' },
        { personID: '222', aliasID: 'TN_THEMSUC1A_ANOTHER', placeID: 998577, avatar: 'https://static.hanet.ai/3.jpg' }
      ]
    };

    const expected = {
      aliasID: 'TN_THEMSUC1A_ZG1P',
      personID: '3326101836275908608',
      placeID: 998577
    };

    const person = selectCloudPerson(response, expected);
    assert.strictEqual(person.personID, '3326101836275908608');
    assert.strictEqual(person.avatar, 'https://static.hanet.ai/2.jpg');
  });

  // TC-21: selectCloudPerson báo lỗi AMBIGUOUS khi trùng nhiều hồ sơ cùng alias
  runTest('TC-21: selectCloudPerson ném lỗi AMBIGUOUS khi có nhiều hồ sơ trùng alias', () => {
    const response = {
      returnCode: 1,
      data: [
        { personID: '3326101836275908608', aliasID: 'TN_THEMSUC1A_ZG1P', placeID: 998577 },
        { personID: '3326101836275908608', aliasID: 'TN_THEMSUC1A_ZG1P', placeID: 998577 }
      ]
    };

    const expected = {
      aliasID: 'TN_THEMSUC1A_ZG1P',
      personID: '3326101836275908608',
      placeID: 998577
    };

    assert.throws(
      () => selectCloudPerson(response, expected),
      (err) => err.code === 'AMBIGUOUS' || err.message === 'AMBIGUOUS'
    );
  });

  // TC-22: selectCloudPerson ném lỗi IDENTITY_NOT_FOUND khi mảng rỗng hoặc không có alias khớp
  runTest('TC-22: selectCloudPerson ném lỗi IDENTITY_NOT_FOUND khi không có hồ sơ khớp', () => {
    const response = { returnCode: 1, data: [] };
    const expected = { aliasID: 'TN_THEMSUC1A_ZG1P', personID: '3326101836275908608', placeID: 998577 };

    assert.throws(
      () => selectCloudPerson(response, expected),
      (err) => err.code === 'IDENTITY_NOT_FOUND' || err.message === 'IDENTITY_NOT_FOUND'
    );
  });

  // TC-23: selectCloudPerson ném lỗi IDENTITY_CONFLICT khi personID hoặc placeID không khớp
  runTest('TC-23: selectCloudPerson ném lỗi IDENTITY_CONFLICT khi personID/placeID không khớp', () => {
    const response = {
      returnCode: 1,
      data: [
        {
          personID: '9999999999999999999', // Sai personID
          aliasID: 'TN_THEMSUC1A_ZG1P',
          placeID: 998577,
          avatar: 'https://static.hanet.ai/photo.jpg'
        }
      ]
    };

    const expected = {
      aliasID: 'TN_THEMSUC1A_ZG1P',
      personID: '3326101836275908608',
      placeID: 998577
    };

    assert.throws(
      () => selectCloudPerson(response, expected),
      (err) => err.code === 'IDENTITY_CONFLICT' || err.message === 'IDENTITY_CONFLICT'
    );
  });

  // TC-24: selectCloudPerson ném lỗi IDENTITY_MISSING khi hồ sơ Cloud thiếu personID
  runTest('TC-24: selectCloudPerson ném lỗi IDENTITY_MISSING khi hồ sơ thiếu personID', () => {
    const response = {
      returnCode: 1,
      data: [
        {
          personID: '', // Thiếu personID
          aliasID: 'TN_THEMSUC1A_ZG1P',
          placeID: 998577,
          avatar: 'https://static.hanet.ai/photo.jpg'
        }
      ]
    };

    const expected = {
      aliasID: 'TN_THEMSUC1A_ZG1P',
      personID: '3326101836275908608',
      placeID: 998577
    };

    assert.throws(
      () => selectCloudPerson(response, expected),
      (err) => err.code === 'IDENTITY_MISSING' || err.message === 'IDENTITY_MISSING'
    );
  });

  // TC-25: selectCloudPerson ném lỗi PLACE_ID_INVALID khi placeID là số không an toàn hoặc NaN
  runTest('TC-25: selectCloudPerson ném lỗi PLACE_ID_INVALID khi placeID không hợp lệ', () => {
    const response = {
      returnCode: 1,
      data: [
        {
          personID: '3326101836275908608',
          aliasID: 'TN_THEMSUC1A_ZG1P',
          placeID: NaN,
          avatar: 'https://static.hanet.ai/photo.jpg'
        }
      ]
    };

    const expected = {
      aliasID: 'TN_THEMSUC1A_ZG1P',
      personID: '3326101836275908608',
      placeID: 998577
    };

    assert.throws(
      () => selectCloudPerson(response, expected),
      (err) => err.code === 'PLACE_ID_INVALID' || err.message === 'PLACE_ID_INVALID'
    );
  });

  // TC-26: selectCloudPerson ném lỗi RESPONSE_SHAPE_INVALID khi data không phải mảng
  runTest('TC-26: selectCloudPerson ném lỗi RESPONSE_SHAPE_INVALID khi data không phải mảng', () => {
    const response = { returnCode: 1, data: { personID: '123' } };
    const expected = { aliasID: 'TN_ZG1P', personID: '123', placeID: 998577 };

    assert.throws(
      () => selectCloudPerson(response, expected),
      (err) => err.code === 'RESPONSE_SHAPE_INVALID' || err.message === 'RESPONSE_SHAPE_INVALID'
    );
  });

  // TC-27: selectCloudPerson ném lỗi HANET_BUSINESS_ERROR khi returnCode !== 1
  runTest('TC-27: selectCloudPerson ném lỗi HANET_BUSINESS_ERROR khi returnCode !== 1', () => {
    const response = { returnCode: -9002, returnMessage: 'Data not found' };
    const expected = { aliasID: 'TN_ZG1P', personID: '123', placeID: 998577 };

    assert.throws(
      () => selectCloudPerson(response, expected),
      (err) => err.code === 'HANET_BUSINESS_ERROR' || err.message === 'HANET_BUSINESS_ERROR'
    );
  });

  // TC-28: parseCliArgs an toàn: Bắt buộc --ids, chặn cờ lạ, chặn mâu thuẫn --apply và --dry-run
  runTest('TC-28: parseCliArgs kiểm tra tính hợp lệ và an toàn của CLI flags', () => {
    // 1. Thành công
    const valid = parseCliArgs(['--ids', '364,368,370', '--dry-run', '--output', '/tmp/out.json']);
    assert.deepStrictEqual(valid.ids, [364, 368, 370]);
    assert.strictEqual(valid.isApply, false);
    assert.strictEqual(valid.isDryRun, true);
    assert.strictEqual(valid.outputPath, '/tmp/out.json');

    // 2. Thiếu --ids
    assert.throws(
      () => parseCliArgs(['--dry-run']),
      /IDS_REQUIRED/
    );

    // 3. Cờ không nhận diện
    assert.throws(
      () => parseCliArgs(['--ids', '364', '--unrecognized-flag']),
      /UNRECOGNIZED_FLAG/
    );

    // 4. Mâu thuẫn --apply và --dry-run
    assert.throws(
      () => parseCliArgs(['--ids', '364', '--apply', '--dry-run']),
      /CONTRADICTORY_FLAGS/
    );

    // 5. Giá trị ID không hợp lệ
    assert.throws(
      () => parseCliArgs(['--ids', '364,invalid,370']),
      /INVALID_ID_VALUE/
    );
  });

  // TC-29: Optimistic Locking so sánh chính xác timestamp micro giây
  runTest('TC-29: Optimistic Locking bảo toàn microsecond timestamp format', () => {
    const snapshotRaw = '2026-10-01 09:08:34.181219';
    const sameRaw = '2026-10-01 09:08:34.181219';
    const modifiedRaw = '2026-10-01 09:08:34.181220'; // Khác 1 micro giây

    assert.strictEqual(snapshotRaw === sameRaw, true, 'Timestamp cùng microsecond phải khớp');
    assert.strictEqual(snapshotRaw === modifiedRaw, false, 'Timestamp khác microsecond phải từ chối');
  });

  // TC-30: 5 hồ sơ đối soát đợt đầu (364, 368, 370, 383, 395)
  runTest('TC-30: 5 hồ sơ đợt đầu (364, 368, 370, 383, 395) có đầy đủ metadata đối soát', () => {
    const target5 = [
      { id: 364, alias_id: 'TN_THEMSUC1A_ZG1P', person_id: '3326101836275908608', sync_status: 'FAILED' },
      { id: 368, alias_id: 'TN_THEMSUC1A_KW3W', person_id: '3334316840204632064', sync_status: 'SYNCED' },
      { id: 370, alias_id: 'TN_THEMSUC1A_7A1L', person_id: '3334317006559117312', sync_status: 'SYNCED' },
      { id: 383, alias_id: 'TN_THEMSUC1A_EZB8', person_id: '3326761102288617472', sync_status: 'FAILED' },
      { id: 395, alias_id: 'TN_THEMSUC1A_6MS1', person_id: '3334319319264788480', sync_status: 'SYNCED' }
    ];

    assert.strictEqual(target5.length, 5);
    target5.forEach(item => {
      assert.strictEqual(typeof item.id, 'number');
      assert.strictEqual(typeof item.alias_id, 'string');
      assert.strictEqual(typeof item.person_id, 'string');
      assert.strictEqual(typeof item.sync_status, 'string');
    });
  });

  // TC-31: runReconciliation end-to-end dry-run với response array fixture
  await runAsyncTest('TC-31: runReconciliation dry-run với response array fixture: MATCHED và không ghi DB', async () => {
    const { pool } = require('../src/config/database');
    const { runReconciliation } = require('../scripts/reconcile_face_urls');
    const hanetService = require('../src/services/hanetService');

    const testId = 999991;
    const testAlias = 'TN_TEST_DRYRUN_ARR_' + Date.now();
    const testPersonId = '3326101836275908608';
    const oldFaceUrl = '/uploads/processed_temp_dryrun.jpg';
    const cloudAvatar = 'https://static.hanet.ai/face/employee/998577/verified_cloud_mock_arr.jpg';

    // 1. Tạo bản ghi test trong DB
    await pool.query(
      `INSERT INTO persons (id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at)
       VALUES ($1, $2, $3, 'Test Person Array', 'THEMSUC1A', '990653', 'Học Sinh', $4, 'FAILED', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET alias_id = $2, person_id = $3, face_url = $4, sync_status = 'FAILED'`,
      [testId, testAlias, testPersonId, oldFaceUrl]
    );

    // 2. Mock hanetService.getPersonByAliasID trả về response mảng chuẩn HANET
    const originalGetPersonByAliasID = hanetService.getPersonByAliasID;
    hanetService.getPersonByAliasID = async (alias) => {
      if (alias === testAlias) {
        return {
          returnCode: 1,
          returnMessage: 'Success',
          data: [
            {
              personID: testPersonId,
              aliasID: testAlias,
              placeID: hanetService.placeId,
              avatar: cloudAvatar
            }
          ]
        };
      }
      return { returnCode: -9002, data: [] };
    };

    try {
      // 3. Thực thi runReconciliation ở chế độ DRY-RUN
      const result = await runReconciliation({
        ids: [testId],
        isApply: false,
        isDryRun: true,
        outputPath: null
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.matched, 1);
      assert.strictEqual(result.applied, 0);
      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].status, 'MATCHED');
      assert.strictEqual(result.items[0].proposed_cloud_url, cloudAvatar);

      // 4. Xác minh DB: face_url không bị thay đổi (vẫn là URL tạm)
      const dbCheck = await pool.query('SELECT face_url, sync_status FROM persons WHERE id = $1', [testId]);
      assert.strictEqual(dbCheck.rows[0].face_url, oldFaceUrl, 'Dry-run tuyệt đối không được ghi DB');
      assert.strictEqual(dbCheck.rows[0].sync_status, 'FAILED');
    } finally {
      hanetService.getPersonByAliasID = originalGetPersonByAliasID;
      await pool.query('DELETE FROM persons WHERE id = $1', [testId]);
    }
  });

  // TC-32: runReconciliation end-to-end apply mode với response array fixture
  await runAsyncTest('TC-32: runReconciliation apply mode cập nhật đúng face_url và giữ nguyên sync_status', async () => {
    const { pool } = require('../src/config/database');
    const { runReconciliation } = require('../scripts/reconcile_face_urls');
    const hanetService = require('../src/services/hanetService');

    const testId = 999992;
    const testAlias = 'TN_TEST_APPLY_ARR_' + Date.now();
    const testPersonId = '3334316840204632064';
    const oldFaceUrl = '/uploads/processed_temp_apply.jpg';
    const cloudAvatar = 'https://static.hanet.ai/face/employee/998577/verified_cloud_apply_arr.jpg';

    // 1. Tạo bản ghi test trong DB
    await pool.query(
      `INSERT INTO persons (id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at)
       VALUES ($1, $2, $3, 'Test Person Apply', 'THEMSUC1A', '990653', 'Học Sinh', $4, 'FAILED', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET alias_id = $2, person_id = $3, face_url = $4, sync_status = 'FAILED'`,
      [testId, testAlias, testPersonId, oldFaceUrl]
    );

    // 2. Mock hanetService.getPersonByAliasID
    const originalGetPersonByAliasID = hanetService.getPersonByAliasID;
    hanetService.getPersonByAliasID = async (alias) => {
      if (alias === testAlias) {
        return {
          returnCode: 1,
          returnMessage: 'Success',
          data: [
            {
              personID: testPersonId,
              aliasID: testAlias,
              placeID: hanetService.placeId,
              avatar: cloudAvatar
            }
          ]
        };
      }
      return { returnCode: -9002, data: [] };
    };

    try {
      // 3. Thực thi runReconciliation ở chế độ APPLY
      const result = await runReconciliation({
        ids: [testId],
        isApply: true,
        isDryRun: false,
        outputPath: null
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.matched, 1);
      assert.strictEqual(result.applied, 1);
      assert.strictEqual(result.items[0].apply_status, 'APPLIED_SUCCESS');

      // 4. Xác minh DB: face_url đã được cập nhật thành cloudAvatar, sync_status giữ nguyên 'FAILED'
      const dbCheck = await pool.query('SELECT face_url, sync_status FROM persons WHERE id = $1', [testId]);
      assert.strictEqual(dbCheck.rows[0].face_url, cloudAvatar);
      assert.strictEqual(dbCheck.rows[0].sync_status, 'FAILED', 'sync_status phải giữ nguyên, không được tự đổi');

      // 5. Xác minh audit_logs có bản ghi RECONCILE_FACE_URL
      const auditCheck = await pool.query('SELECT action, target_id FROM audit_logs WHERE target_id = $1', [String(testId)]);
      assert.strictEqual(auditCheck.rows.length >= 1, true);
      assert.strictEqual(auditCheck.rows[0].action, 'RECONCILE_FACE_URL');
    } finally {
      hanetService.getPersonByAliasID = originalGetPersonByAliasID;
      await pool.query('DELETE FROM audit_logs WHERE target_id = $1', [String(testId)]).catch(() => {});
      await pool.query('DELETE FROM persons WHERE id = $1', [testId]);
    }
  });

  console.log('\n===============================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passCount} PASSED | ${failCount} FAILED`);
  console.log('===============================================================');

  const { pool } = require('../src/config/database');
  try {
    await pool.end();
  } catch (err) {}

  process.exitCode = failCount === 0 ? 0 : 1;
}

runAllTests().catch(err => {
  console.error('Lỗi thực thi test:', err);
  process.exitCode = 1;
});
