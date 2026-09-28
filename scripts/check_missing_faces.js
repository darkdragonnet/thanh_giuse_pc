const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  console.error('Thư mục data không tồn tại:', dataDir);
  process.exit(1);
}

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv') && !f.startsWith('.'));
let totalMissing = 0;
let totalPersons = 0;

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    const parts = trimmed.split(',');
    if (parts.length < 4) return;
    
    totalPersons++;
    const name = parts[0].replace(/^["'\s]+|["'\s]+$/g, '');
    const personId = (parts[5] || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
    
    if (!personId || personId === '""' || personId === "''" || personId === 'null') {
      console.log(`⚠️ [Chưa đăng ký]: [${file}] Dòng ${idx + 1}: ${name}`);
      totalMissing++;
    }
  });
});

console.log('\n===============================================================');
console.log(`📊 TỔNG KẾT HỆ THỐNG:`);
console.log(`- Tổng số nhân sự trong CSV: ${totalPersons}`);
console.log(`- Đã đăng ký Face ID:        ${totalPersons - totalMissing}`);
console.log(`- Chưa đăng ký Face ID:      ${totalMissing}`);
console.log('===============================================================\n');
