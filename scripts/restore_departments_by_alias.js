require('dotenv').config();
const path = require('path');
const hanetService = require('../src/services/hanetService');

// Bảng ánh xạ tiền tố AliasID -> Tên phòng ban & ID mặc định
const PREFIX_MAPPING = {
  'TN':  { name: 'Thiếu Nhi',     defaultId: '990653' },
  'LM':  { name: 'Legiô Mariae',  defaultId: '990730' },
  'GT':  { name: 'Giới Trẻ',      defaultId: '990731' },
  'TG':  { name: 'Giới Trẻ',      defaultId: '990731' },
  'TG1': { name: 'Gia Trưởng',    defaultId: '990735' },
  'GTR': { name: 'Gia Trưởng',    defaultId: '990735' },
  'HM':  { name: 'Hiền Mẫu',      defaultId: '990736' }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function matchDeptPrefix(alias) {
  if (!alias) return null;
  const upper = alias.trim().toUpperCase();
  if (upper.startsWith('TG1_') || upper.startsWith('TG1')) return 'TG1';
  if (upper.startsWith('GTR_') || upper.startsWith('GTR')) return 'GTR';
  if (upper.startsWith('TN_') || upper.startsWith('TN')) return 'TN';
  if (upper.startsWith('LM_') || upper.startsWith('LM')) return 'LM';
  if (upper.startsWith('GT_') || upper.startsWith('GT')) return 'GT';
  if (upper.startsWith('TG_') || upper.startsWith('TG')) return 'TG';
  if (upper.startsWith('HM_') || upper.startsWith('HM')) return 'HM';
  return null;
}

// Helper bóc tách mảng an toàn từ response HANET
function extractArray(res) {
  if (!res) return [];
  let d = res;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch (e) { return []; }
  }
  if (Array.isArray(d)) return d;
  if (d.data) {
    let sub = d.data;
    if (typeof sub === 'string') {
      try { sub = JSON.parse(sub); } catch (e) { return []; }
    }
    if (Array.isArray(sub)) return sub;
    if (sub.data && Array.isArray(sub.data)) return sub.data;
    if (sub.hits && Array.isArray(sub.hits)) return sub.hits;
  }
  return [];
}

async function restoreDepartmentsByAlias() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 BẮT ĐẦU QUÉT VÀ PHỤC HỒI PHÒNG BAN TỪ ALIASID CHO TẤT CẢ NHÂN SỰ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Lấy danh sách phòng ban hiện có trên Cloud
  console.log('📋 Đang lấy danh sách phòng ban hiện tại từ HANET Cloud...');
  const deptListRes = await hanetService.getDepartmentList(1, 100, '');
  const existingDepts = extractArray(deptListRes);
  console.log(`   Tìm thấy ${existingDepts.length} phòng ban trên Cloud.`);

  // Map tên phòng ban -> ID
  const deptNameToId = {};
  for (const dept of existingDepts) {
    const name = dept.department_name || dept.name || '';
    const id = dept.id || dept.department_id;
    if (name && id) {
      deptNameToId[name.trim().toLowerCase()] = id.toString();
    }
  }

  // 2. Xác định ID phòng ban chính xác
  const finalDeptMap = {};
  for (const [prefix, info] of Object.entries(PREFIX_MAPPING)) {
    const key = info.name.trim().toLowerCase();
    if (deptNameToId[key]) {
      finalDeptMap[prefix] = deptNameToId[key];
    } else if (info.defaultId) {
      finalDeptMap[prefix] = info.defaultId;
    } else {
      console.log(`➕ Đang tạo mới phòng ban "${info.name}" trên HANET Cloud...`);
      try {
        const createRes = await hanetService.createDepartment(info.name, `Phòng ban ${info.name}`);
        const resData = (createRes && createRes.data) ? createRes.data : createRes;
        const newId = resData.id || (typeof resData === 'object' && resData.data && resData.data.id);
        if (newId) {
          finalDeptMap[prefix] = newId.toString();
          console.log(`   -> Tạo thành công "${info.name}" (ID: ${finalDeptMap[prefix]})`);
        }
      } catch (err) {
        console.error(`   ❌ Lỗi tạo phòng ban "${info.name}":`, err.message);
      }
    }
  }

  console.log('\n📌 Bảng ID phòng ban sử dụng:', finalDeptMap);

  // 3. Lấy toàn bộ nhân sự từ HANET Cloud (đã có phân trang tự động)
  console.log('\n👥 Đang lấy danh sách toàn bộ nhân sự từ HANET Cloud...');
  const placeRes = await hanetService.getListByPlace();
  const persons = extractArray(placeRes);
  console.log(`   Tổng cộng tải được: ${persons.length} nhân sự trên Cloud.`);

  // 4. Lọc nhân sự bị thiếu phòng ban
  const pendingByDept = {};
  for (const deptId of new Set(Object.values(finalDeptMap))) {
    pendingByDept[deptId] = [];
  }

  let countMissing = 0;
  for (const p of persons) {
    const alias = (p.aliasID || '').trim().toUpperCase();
    const deptId = p.department_id || p.departmentID;
    const hasDept = deptId && String(deptId) !== '0';

    if (!hasDept && alias) {
      const matchedPrefix = matchDeptPrefix(alias);
      if (matchedPrefix && finalDeptMap[matchedPrefix]) {
        const targetDeptId = finalDeptMap[matchedPrefix];
        if (!pendingByDept[targetDeptId]) {
          pendingByDept[targetDeptId] = [];
        }
        pendingByDept[targetDeptId].push({
          id: p.id || p.personID,
          name: p.name,
          aliasID: alias
        });
        countMissing++;
      }
    }
  }

  console.log(`🔍 Tìm thấy ${countMissing} nhân sự chưa được gán phòng ban (departmentID == 0).`);

  if (countMissing === 0) {
    console.log('🎉 Tất cả nhân sự đã được gán phòng ban đầy đủ 100%!');
    return;
  }

  // 5. Gán vào phòng ban qua API addPersonsToDepartment theo batch 20 người
  let totalAssigned = 0;
  for (const [deptId, list] of Object.entries(pendingByDept)) {
    if (!list || list.length === 0) continue;

    console.log(`\n⚙️ Đang gán ${list.length} người vào Phòng Ban ID: ${deptId}...`);
    const batchSize = 20;
    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize);
      const personIds = batch.map((item) => String(item.id));

      try {
        const addRes = await hanetService.addPersonsToDepartment(deptId, personIds);
        if (addRes && addRes.returnCode === 1) {
          console.log(`   ✅ Đã gán thành công ${batch.length} người (${i + 1} - ${i + batch.length})`);
          batch.forEach(item => console.log(`      - [${item.aliasID}] ${item.name} (ID: ${item.id})`));
          totalAssigned += batch.length;
        } else {
          console.error(`   ❌ Lỗi gán nhóm (Mã ${addRes?.returnCode}):`, addRes?.returnMessage);
        }
      } catch (err) {
        console.error(`   ❌ Lỗi khi gán nhóm [${personIds.join(', ')}]:`, err.message);
      }

      await sleep(1000);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`🎉 HOÀN TẤT: Đã phục hồi và gán phòng ban thành công cho ${totalAssigned}/${countMissing} nhân sự!`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

if (require.main === module) {
  restoreDepartmentsByAlias().catch((err) => {
    console.error('❌ Lỗi tiến trình:', err);
    process.exit(1);
  });
}

module.exports = restoreDepartmentsByAlias;
