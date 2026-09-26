require('dotenv').config();
const hanetService = require('../src/services/hanetService');

const DEPARTMENT_PREFIX_MAP = {
  'TN_': { id: '990653', name: 'Thiếu Nhi' },
  'LM_': { id: '990730', name: 'Legiô Mariae' },
  'GT_': { id: '990731', name: 'Giới Trẻ' },
  'LS_': { id: '990732', name: 'Ban Lễ Sinh' },
  'CD_': { id: '990733', name: 'Ca Đoàn' }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function repairDepartments() {
  console.log('====================================================');
  console.log('🔄 BẮT ĐẦU QUÉT VÀ PHỤC HỒI PHÒNG BAN TRÊN HANET CLOUD');
  console.log('====================================================\n');

  try {
    // 1. Lấy danh sách nhân sự trên HANET Cloud
    console.log('📡 Đang tải danh sách nhân sự từ HANET Cloud...');
    const result = await hanetService.getListByPlace();
    const persons = result?.data || [];

    console.log(`✅ Tìm thấy tổng cộng ${persons.length} nhân sự trên Cloud.\n`);

    let missingCount = 0;
    let repairedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < persons.length; i++) {
      const p = persons[i];
      const personID = String(p.id || p.personID);
      const aliasID = String(p.aliasID || p.alias_id || '').trim();
      const currentDeptID = String(p.departmentID || p.department_id || '0');

      // Kiểm tra xem person có bị mất phòng ban không (departmentID === '0' hoặc rỗng)
      if (currentDeptID === '0' || !currentDeptID) {
        missingCount++;

        // Tìm phòng ban theo tiền tố aliasID
        let matchedDept = null;
        for (const [prefix, dept] of Object.entries(DEPARTMENT_PREFIX_MAP)) {
          if (aliasID.toUpperCase().startsWith(prefix.toUpperCase())) {
            matchedDept = dept;
            break;
          }
        }

        if (matchedDept) {
          console.log(`[${i + 1}/${persons.length}] 🔧 Đang phục hồi cho: "${p.name}" (Mã: ${aliasID || 'N/A'}, ID: ${personID})`);
          try {
            // Gán vào phòng ban trên Cloud
            const addRes = await hanetService.addPersonsToDepartment(matchedDept.id, personID);
            
            // Cập nhật thông tin kèm departmentID
            await hanetService.updatePersonInfo(personID, p.name, p.title, aliasID, matchedDept.id);

            console.log(`   👉 Thành công: Gán vào "${matchedDept.name}" (ID: ${matchedDept.id}) | returnCode=${addRes?.returnCode || 1}`);
            repairedCount++;
          } catch (err) {
            console.error(`   ❌ Thất bại: ${err.message}`);
          }

          // Nghỉ 250ms giữa các request để tránh rate limit
          await delay(250);
        } else {
          console.log(`[${i + 1}/${persons.length}] ⚠️ Bỏ qua: "${p.name}" (${aliasID}) không khớp tiền tố phòng ban nào.`);
          skippedCount++;
        }
      }
    }

    console.log('\n====================================================');
    console.log('📊 TỔNG KẾT QUÁ TRÌNH PHỤC HỒI');
    console.log('====================================================');
    console.log(`- Tổng số nhân sự quét:       ${persons.length}`);
    console.log(`- Nhân sự bị mất phòng ban:   ${missingCount}`);
    console.log(`- Đã phục hồi thành công:     ${repairedCount}`);
    console.log(`- Bỏ qua (không rõ tiền tố):  ${skippedCount}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('❌ Lỗi trong quá trình quét phục hồi:', error.message);
  }
}

// Chạy script
repairDepartments();
