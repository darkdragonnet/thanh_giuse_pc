require('dotenv').config();
const hanetService = require('../src/services/hanetService');

// Bảng ánh xạ tiền tố -> Tên phòng ban & ID mặc định (nếu có sẵn)
const PREFIX_MAPPING = {
  'TN':  { name: 'Thiếu Nhi',     defaultId: '990653' },
  'LM':  { name: 'Legiô Mariae',  defaultId: '990730' },
  'TG':  { name: 'Giới Trẻ',      defaultId: '990731' },
  'TG1': { name: 'Gia Trưởng',    defaultId: null },
  'HM':  { name: 'Hiền Mẫu',      defaultId: null }
};

// Hàm delay để tránh vượt quá Rate Limit của HANET API
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Bắt đầu quét và phục hồi phòng ban từ AliasID...');

  // 1. Lấy danh sách toàn bộ phòng ban hiện có trên HANET Cloud
  console.log('📋 Đang lấy danh sách phòng ban hiện tại từ Cloud...');
  const deptListRes = await hanetService.getDepartmentList(1, 100, '');
  const existingDepts = (deptListRes && deptListRes.data) ? deptListRes.data : [];

  // Tạo map tra cứu: Tên phòng ban chuẩn hóa -> deptID
  const deptNameToId = {};
  for (const dept of existingDepts) {
    deptNameToId[dept.department_name.trim().toLowerCase()] = dept.id.toString();
  }

  // 2. Đảm bảo tất cả phòng ban mục tiêu đều đã tồn tại trên Cloud
  const finalDeptMap = {}; // Lưu: prefix -> deptID thực tế
  for (const [prefix, info] of Object.entries(PREFIX_MAPPING)) {
    const key = info.name.trim().toLowerCase();
    if (deptNameToId[key]) {
      finalDeptMap[prefix] = deptNameToId[key];
    } else if (info.defaultId) {
      finalDeptMap[prefix] = info.defaultId;
    } else {
      // Nếu chưa có (Gia Trưởng, Hiền Mẫu), tạo mới bằng hàm của app
      console.log(`➕ Đang tạo mới phòng ban "${info.name}" trên HANET Cloud...`);
      try {
        const createRes = await hanetService.createDepartment(info.name, `Phòng ban ${info.name}`);
        if (createRes && createRes.data && createRes.data.id) {
          finalDeptMap[prefix] = createRes.data.id.toString();
          console.log(`   -> Tạo thành công "${info.name}" (ID: ${finalDeptMap[prefix]})`);
        }
      } catch (err) {
        console.error(`   ❌ Lỗi tạo phòng ban "${info.name}":`, err.message);
      }
    }
  }

  console.log('\n📌 Bảng ID phòng ban sử dụng:', finalDeptMap);

  // 3. Lấy toàn bộ nhân sự theo Place ID
  console.log('\n👥 Đang lấy danh sách nhân sự từ HANET Cloud...');
  const placeRes = await hanetService.getListByPlace();
  const persons = (placeRes && placeRes.data) ? placeRes.data : [];
  console.log(`   Tổng cộng: ${persons.length} nhân sự.`);

  // 4. Lọc và gom nhóm những người bị mất phòng ban theo prefix
  // dept_id có thể là 0, null, rỗng hoặc undefined
  const pendingByDept = {};
  for (const prefix of Object.keys(finalDeptMap)) {
    pendingByDept[finalDeptMap[prefix]] = [];
  }

  let countMissing = 0;
  for (const p of persons) {
    const alias = (p.aliasID || '').trim().toUpperCase();
    const hasDept = p.department_id && p.department_id !== '0' && p.department_id !== 0;

    // Kiểm tra nếu nhân sự chưa có phòng ban
    if (!hasDept && alias) {
      // Kiểm tra tiền tố 3 ký tự trước (TG1), sau đó đến 2 ký tự (TN, LM, TG, HM)
      let matchedPrefix = null;
      if (alias.startsWith('TG1_') || alias.startsWith('TG1')) {
        matchedPrefix = 'TG1';
      } else {
        const prefix2 = alias.substring(0, 2);
        if (PREFIX_MAPPING[prefix2]) {
          matchedPrefix = prefix2;
        }
      }

      if (matchedPrefix && finalDeptMap[matchedPrefix]) {
        const targetDeptId = finalDeptMap[matchedPrefix];
        pendingByDept[targetDeptId].push({
          id: p.id,
          name: p.name,
          aliasID: alias
        });
        countMissing++;
      }
    }
  }

  console.log(`🔍 Tìm thấy ${countMissing} nhân sự bị thiếu phòng ban.`);

  // 5. Cập nhật gán vào phòng ban bằng hàm của app (addPersonsToDepartment)
  for (const [deptId, list] of Object.entries(pendingByDept)) {
    if (list.length === 0) continue;

    console.log(`\n⚙️ Đang gán ${list.length} người vào Phòng Ban ID: ${deptId}...`);
    
    // Gán theo từng batch tối đa 20 người/lần để bảo đảm ổn định
    const batchSize = 20;
    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize);
      const personIds = batch.map((item) => item.id);

      try {
        // Gọi hàm của app: addPersonsToDepartment(deptID, personIDs)
        await hanetService.addPersonsToDepartment(deptId, personIds);
        console.log(`   ✅ Đã gán thành công ${batch.length} người (${i + 1} - ${i + batch.length})`);
        
        // Log chi tiết từng người để kiểm tra
        batch.forEach(item => console.log(`      - [${item.aliasID}] ${item.name}`));
      } catch (err) {
        console.error(`   ❌ Lỗi khi gán nhóm [${personIds.join(', ')}]:`, err.message);
      }

      await sleep(1000); // Nghỉ 1s giữa các đợt gọi API
    }
  }

  console.log('\n🎉 Hoàn tất khôi phục phòng ban cho tất cả nhân sự!');
}

main().catch((err) => {
  console.error('❌ Lỗi tiến trình:', err);
  process.exit(1);
});
