require('dotenv').config();
const path = require('path');
const queueService = require('../src/services/queueService');
const Queue = require('bull');

async function runTest() {
  console.log('--- [TEST QUEUE UPDATE PERSON] ---');

  // 1. Mock context variables
  const personID = "3318304752428646400"; // Test person: PHÊRÔ Trần Minh Mẫn
  const name = "PHÊRÔ Trần Minh Mẫn";
  const aliasID = "TN_GLV_0001";
  const title = "Giáo Lý Viên";

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  
  // Test mock image
  const mockFilename = 'test.jpg';
  const processedImage = {
    filename: mockFilename,
    processedPath: path.join(__dirname, '../uploads', mockFilename)
  };
  const publicImageUrl = `${baseUrl}/uploads/${processedImage.filename}`;

  try {
    console.log(`1. Đang đẩy job update cho: ${name} (${personID})...`);
    const job = await queueService.enqueueUpdatePerson({
      personID,
      name,
      aliasID,
      title,
      imagePath: processedImage.processedPath,
      imageFilename: processedImage.filename,
      publicImageUrl
    });

    console.log(`✅ Đã đẩy job vào Bull Queue thành công! Job ID: ${job.id}`);

    // 2. Kiểm tra hàng đợi Redis
    const q = new Queue('hanet-sync', {
      redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        db: Number(process.env.REDIS_DB) || 4
      }
    });

    console.log('2. Đang đọc thống kê hàng đợi Redis (DB ' + (process.env.REDIS_DB || 4) + ')...');
    const [waiting, active, completed, failed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount()
    ]);

    console.log(`   - Waiting:   ${waiting}`);
    console.log(`   - Active:    ${active}`);
    console.log(`   - Completed: ${completed}`);
    console.log(`   - Failed:    ${failed}`);

    if (failed > 0) {
      const failedJobs = await q.getFailed(0, 1);
      if (failedJobs.length > 0) {
        console.warn('⚠️ Lỗi gần nhất:', failedJobs[0].failedReason);
      }
    }

    await q.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi enqueue:', err.message);
    process.exit(1);
  }
}

runTest();
