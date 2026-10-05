/**
 * tests/test_payload_normalization_hardening.js
 * Bộ kiểm thử chuyên sâu kiểm tra tính toàn vẹn và an toàn của module dlqPayloadHelper.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  PayloadValidationError,
  parseStrictBoolean,
  parseAndValidateIdentifier,
  normalizeDLQJobPayload,
  verifyAndSyncImageTriad
} = require('../src/utils/dlqPayloadHelper');

async function runHardeningTests() {
  console.log('========================================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ HARDENING: DLQ PAYLOAD HELPER & DATA INTEGRITY SUITE');
  console.log('========================================================================================');

  let passedTests = 0;
  let totalTests = 0;

  function testCase(name, fn) {
    totalTests++;
    process.stdout.write(`[TC-${String(totalTests).padStart(2, '0')}] ${name} ... `);
    try {
      fn();
      console.log('✅ PASS');
      passedTests++;
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      console.error(err);
    }
  }

  // TC-01: Input có name: delete_person_job và data.personID: "123" -> ném UNSUPPORTED_JOB_TYPE
  testCase('Không suy luận đè lên jobName đã khai báo (name: delete_person_job -> UNSUPPORTED_JOB_TYPE)', () => {
    const job = {
      name: 'delete_person_job',
      data: {
        personID: '123'
      }
    };

    assert.throws(() => {
      normalizeDLQJobPayload(job);
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'UNSUPPORTED_JOB_TYPE';
    });
  });

  // TC-02: Input có name: update_person_job và operation_type: REGISTER_NEW -> ném OPERATION_TYPE_CONFLICT
  testCase('Phát hiện xung đột giữa update_person_job và operation_type: REGISTER_NEW', () => {
    const job = {
      name: 'update_person_job',
      data: {
        personID: '12345',
        operation_type: 'REGISTER_NEW'
      }
    };

    assert.throws(() => {
      normalizeDLQJobPayload(job);
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'OPERATION_TYPE_CONFLICT';
    });
  });

  // TC-03: Một object có personID: "111" và personId: "222" -> ném PAYLOAD_CONFLICT
  testCase('Phát hiện xung đột identifier trong cùng một object (personID vs personId)', () => {
    const job = {
      name: 'update_person_job',
      data: {
        personID: '111',
        personId: '222'
      }
    };

    assert.throws(() => {
      normalizeDLQJobPayload(job);
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'PAYLOAD_CONFLICT';
    });
  });

  // TC-04: Tầng ngoài có personID: "111", jobData có personID: "222" -> ném PAYLOAD_CONFLICT
  testCase('Phát hiện xung đột identifier giữa các tầng (outer personID vs jobData.personID)', () => {
    const job = {
      name: 'update_person_job',
      data: {
        personID: '111',
        jobData: {
          personID: '222'
        }
      }
    };

    assert.throws(() => {
      normalizeDLQJobPayload(job);
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'PAYLOAD_CONFLICT';
    });
  });

  // TC-05: Input update_person_job có personID hợp lệ và isPhotoOnly: "false" -> isPhotoOnly === false
  testCase('parseStrictBoolean: isPhotoOnly: "false" cho kết quả false chính xác', () => {
    const job = {
      name: 'update_person_job',
      data: {
        personID: '123456',
        isPhotoOnly: 'false'
      }
    };

    const normalized = normalizeDLQJobPayload(job);
    assert.strictEqual(normalized.isPhotoOnly, false);

    // Kiểm tra trực tiếp hàm parseStrictBoolean
    assert.strictEqual(parseStrictBoolean('false'), false);
    assert.strictEqual(parseStrictBoolean('0'), false);
    assert.strictEqual(parseStrictBoolean(0), false);
    assert.strictEqual(parseStrictBoolean(false), false);
    assert.strictEqual(parseStrictBoolean(null), false);
    assert.strictEqual(parseStrictBoolean(undefined), false);
    assert.strictEqual(parseStrictBoolean('true'), true);
    assert.strictEqual(parseStrictBoolean('1'), true);
    assert.strictEqual(parseStrictBoolean(1), true);
    assert.strictEqual(parseStrictBoolean(true), true);
  });

  // TC-06: Input có personID: { id: 123 } -> ném INVALID_IDENTIFIER_TYPE
  testCase('Từ chối identifier là object (personID: { id: 123 } -> INVALID_IDENTIFIER_TYPE)', () => {
    const job = {
      name: 'update_person_job',
      data: {
        personID: { id: 123 }
      }
    };

    assert.throws(() => {
      normalizeDLQJobPayload(job);
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'INVALID_IDENTIFIER_TYPE';
    });
  });

  // TC-07: Input update_person_job không có personID -> ném MISSING_REQUIRED_PERSON_ID
  testCase('update_person_job thiếu personID ném MISSING_REQUIRED_PERSON_ID', () => {
    const job = {
      name: 'update_person_job',
      data: {
        name: 'Nguyen Van A'
      }
    };

    assert.throws(() => {
      normalizeDLQJobPayload(job);
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'MISSING_REQUIRED_PERSON_ID';
    });
  });

  // TC-08: Input update_person_job có personID nhưng không có title -> title === null
  testCase('Không tự động gán title: title phải là null nếu không khai báo (không mặc định "Học Sinh")', () => {
    const job = {
      name: 'update_person_job',
      data: {
        personID: '123456',
        name: 'Nguyen Van A'
      }
    };

    const normalized = normalizeDLQJobPayload(job);
    assert.strictEqual(normalized.title, null);
    assert.notStrictEqual(normalized.title, 'Học Sinh');
  });

  // TC-09: Hai nguồn có personID cùng giá trị nhưng khác kiểu, ví dụ 123 và "123" -> cùng một identifier
  testCase('Hai nguồn có personID cùng giá trị khác kiểu (123 vs "123") coi là cùng một identifier', () => {
    const job = {
      name: 'update_person_job',
      data: {
        personID: 12345,
        jobData: {
          personId: '12345'
        }
      }
    };

    const normalized = normalizeDLQJobPayload(job);
    assert.strictEqual(normalized.personID, '12345');
    assert.strictEqual(typeof normalized.personID, 'string');
  });

  // TC-10: Identifier là chuỗi chỉ chứa khoảng trắng -> coi là null
  testCase('Identifier là chuỗi chỉ chứa khoảng trắng được coi là null', () => {
    const job = {
      name: 'update_person_job',
      data: {
        personID: '   ',
        name: 'Nguyen Van A'
      }
    };

    assert.throws(() => {
      normalizeDLQJobPayload(job);
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'MISSING_REQUIRED_PERSON_ID';
    });
  });

  // TC-11: Có nhiều jobName giống nhau ở các tầng khác nhau -> không bị coi là xung đột
  testCase('Nhiều jobName giống nhau ở các tầng khác nhau không bị coi là xung đột', () => {
    const job = {
      name: 'update_person_job',
      data: {
        jobName: 'update_person_job',
        originalJobName: 'update_person_job',
        personID: '123456'
      }
    };

    const normalized = normalizeDLQJobPayload(job);
    assert.strictEqual(normalized.jobName, 'update_person_job');
    assert.strictEqual(normalized.personID, '123456');
  });

  // TC-12: Có nhiều jobName khác nhau, trong đó ít nhất một job không được hỗ trợ -> ưu tiên UNSUPPORTED_JOB_TYPE
  testCase('Nhiều jobName khác nhau với ít nhất 1 job không hỗ trợ -> ưu tiên UNSUPPORTED_JOB_TYPE', () => {
    const job = {
      name: 'update_person_job',
      data: {
        jobName: 'remove_person_job',
        personID: '123456'
      }
    };

    assert.throws(() => {
      normalizeDLQJobPayload(job);
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'UNSUPPORTED_JOB_TYPE';
    });
  });

  // TC-13: operation_type được khai báo ở jobData hoặc originalData vẫn được thu thập và kiểm tra
  testCase('operation_type được khai báo ở jobData/originalData vẫn được thu thập và kiểm tra xung đột', () => {
    const job = {
      name: 'register_person_job',
      data: {
        aliasID: 'TN_THEMSUC_ABC',
        jobData: {
          operation_type: 'UPDATE_PHOTO'
        }
      }
    };

    assert.throws(() => {
      normalizeDLQJobPayload(job);
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'OPERATION_TYPE_CONFLICT';
    });
  });

  // TC-14: Payload hợp lệ của update_person_job không có ảnh và không phải isPhotoOnly
  testCase('verifyAndSyncImageTriad cho phép update_person_job không có ảnh nếu không phải isPhotoOnly', () => {
    const normalized = {
      jobName: 'update_person_job',
      personID: '123456',
      isPhotoOnly: false,
      imagePath: null,
      imageFilename: null,
      publicImageUrl: null
    };

    const triad = verifyAndSyncImageTriad(normalized);
    assert.strictEqual(triad.validImagePath, null);
    assert.strictEqual(triad.validFilename, null);
    assert.strictEqual(triad.validPublicUrl, null);
  });

  // TC-15: Payload có identifier là array hoặc boolean -> ném INVALID_IDENTIFIER_TYPE
  testCase('Payload có identifier là array hoặc boolean ném INVALID_IDENTIFIER_TYPE', () => {
    // Array
    assert.throws(() => {
      normalizeDLQJobPayload({
        name: 'update_person_job',
        data: { personID: [123, 456] }
      });
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'INVALID_IDENTIFIER_TYPE';
    });

    // Boolean
    assert.throws(() => {
      normalizeDLQJobPayload({
        name: 'register_person_job',
        data: { aliasID: true }
      });
    }, (err) => {
      return err instanceof PayloadValidationError && err.code === 'INVALID_IDENTIFIER_TYPE';
    });
  });

  console.log('========================================================================================');
  console.log(`🎉 KẾT QUẢ: ĐÃ VƯỢT QUA ${passedTests}/${totalTests} BÀI KIỂM THỬ HARDENING DLQ PAYLOAD HELPER.`);
  console.log('========================================================================================');

  process.exitCode = passedTests === totalTests ? 0 : 1;
}

if (require.main === module) {
  runHardeningTests();
}

module.exports = { runHardeningTests };
