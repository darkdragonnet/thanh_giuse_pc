const Queue = require('bull');
const hanetService = require('./hanetService');
const imageService = require('./imageService');

// Khởi tạo Bull Queue chạy trên Redis DB 4
const hanetQueue = new Queue('hanet-sync', {
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    db: parseInt(process.env.REDIS_DB || '4', 10)
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000 // 3s, 6s, 12s, 24s, 48s
    },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});

// Xử lý Job đăng ký nhân sự ngầm
hanetQueue.process('register_person_job', 3, async (job) => {
  const { name, aliasID, title, departmentID, imagePath, publicImageUrl } = job.data;
  const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

  let result;
  try {
    try {
      // 1. Gọi HANET AI Cloud API
      result = await hanetService.registerPerson({
        name,
        aliasID,
        title,
        departmentID,
        imagePath,
        publicImageUrl,
        faceUrl: publicImageUrl || `${fallbackBaseUrl}/uploads/${job.data.imageFilename}`
      });

      // Bắt trường hợp HANET trả HTTP 200 nhưng returnCode là -9007
      if (result && result.returnCode === -9007 && (result.data?.personID || result.data?.id)) {
        const existingPersonID = result.data.personID || result.data.id;
        console.warn(`[Queue register_person_job] Khuôn mặt đã tồn tại trên HANET với PersonID: ${existingPersonID}. Chuyển sang cập nhật info.`);

        await hanetService.updatePersonInfo(existingPersonID, name, title, aliasID);

        if (departmentID) {
          try {
            await hanetService.addPersonsToDepartment(departmentID, existingPersonID);
          } catch (deptErr) {
            console.warn('[Queue register_person_job] Gán phòng ban bổ sung thất bại:', deptErr.message);
          }
        }

        if (imagePath) {
          imageService.cleanupDelayed(imagePath, 30000);
        }

        return { returnCode: 1, returnMessage: 'Merged with existing person', personID: existingPersonID };
      }

      // Bắt mã lỗi đặc thù từ HANET Cloud
      if (result.returnCode === -9006) {
        throw new Error('Mã lỗi -9006: Ảnh không đạt tiêu chuẩn (mờ, che mắt/mũi/miệng hoặc có nhiều hơn 1 mặt)');
      } else if (result.returnCode === -9008) {
        throw new Error('Mã lỗi -9008: Dung lượng lưu trữ Face ID cho địa điểm đã hết trên HANET Cloud');
      } else if (result.returnCode !== 1) {
        throw new Error(`HANET API Error [${result.returnCode}]: ${result.returnMessage}`);
      }
    } catch (apiErr) {
      const errData = apiErr.response?.data;
      // Bắt trường hợp HANET ném HTTP 400 kèm returnCode: -9007 (Person already exist)
      if (errData && errData.returnCode === -9007 && (errData.data?.personID || errData.data?.id)) {
        const existingPersonID = errData.data.personID || errData.data.id;
        console.warn(`[Queue register_person_job] Khuôn mặt đã tồn tại trên HANET với PersonID: ${existingPersonID}. Chuyển sang cập nhật info.`);

        // Tự động cập nhật thông tin theo personID sẵn có
        await hanetService.updatePersonInfo(existingPersonID, name, title, aliasID);

        // Gán vào phòng ban nếu có
        if (departmentID) {
          try {
            await hanetService.addPersonsToDepartment(departmentID, existingPersonID);
          } catch (deptErr) {
            console.warn('[Queue register_person_job] Gán phòng ban bổ sung thất bại:', deptErr.message);
          }
        }

        if (imagePath) {
          imageService.cleanupDelayed(imagePath, 30000);
        }

        // Hoàn tất job êm đẹp
        return { returnCode: 1, returnMessage: 'Merged with existing person', personID: existingPersonID };
      }

      // Nếu là các lỗi khác thì throw để Bull Queue xử lý retry
      throw apiErr;
    }

    // Nếu có chọn phòng ban, gán person vào phòng ban sau khi đăng ký thành công
    if (departmentID) {
      try {
        const newPersonID = result.data?.id || result.data?.personID || result.data?.personId;
        if (newPersonID) {
          const addRes = await hanetService.addPersonsToDepartment(departmentID, newPersonID);
          console.log(`[Queue register_person_job] Gán person ${newPersonID} vào phòng ban ${departmentID}: returnCode=${addRes.returnCode}`);
        }
      } catch (deptErr) {
        console.warn(`[Queue register_person_job] Lỗi gán phòng ban ${departmentID}:`, deptErr.message);
      }
    }

    // [RULE-022] Xử lý thành công -> Bắt buộc delay 30 giây (30000ms) trước khi xóa file ảnh trong uploads/ để HANET kịp fetch public URL qua Cloudflare
    if (imagePath) {
      imageService.cleanupDelayed(imagePath, 30000);
    }

    return result;
  } catch (error) {
    // Nếu là lần thử cuối cùng bị thất bại thì mới hẹn giờ xóa file giải phóng ổ đĩa
    const maxAttempts = job.opts?.attempts || 5;
    if (job.attemptsMade + 1 >= maxAttempts && imagePath) {
      imageService.cleanupDelayed(imagePath, 60000);
    }
    throw error;
  }
});

// Xử lý Job cập nhật nhân sự ngầm
hanetQueue.process('update_person_job', 3, async (job) => {
  const { personID, name, aliasID, title, imagePath, publicImageUrl } = job.data;

  try {
    // 1. Cập nhật thông tin cơ bản
    const infoResult = await hanetService.updateInfo({
      personID,
      name,
      aliasID,
      title
    });

    if (infoResult.returnCode === -5005) {
      throw new Error('Mã lỗi -5005: Lỗi cập nhật hồ sơ nhân sự trên HANET Cloud');
    } else if (infoResult.returnCode !== 1) {
      throw new Error(`HANET Update Info Error [${infoResult.returnCode}]: ${infoResult.returnMessage}`);
    }

    // 2. Nếu có ảnh mới, cập nhật Face ID
    if (job.data.imageFilename) {
      const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
      const faceResult = await hanetService.updateByFaceUrl({
        personID,
        faceUrl: publicImageUrl || `${fallbackBaseUrl}/uploads/${job.data.imageFilename}`
      });

      if (faceResult.returnCode === -9006) {
        throw new Error('Mã lỗi -9006: Ảnh khuôn mặt mới không đạt tiêu chuẩn');
      } else if (faceResult.returnCode === -5008) {
        throw new Error('Mã lỗi -5008: Lỗi cập nhật Face ID trên Cloud');
      } else if (faceResult.returnCode !== 1) {
        throw new Error(`HANET Update Face Error [${faceResult.returnCode}]: ${faceResult.returnMessage}`);
      }
    }

    // [RULE-022] Xử lý thành công -> Bắt buộc delay 30 giây (30000ms) trước khi xóa file ảnh trong uploads/ để HANET kịp fetch public URL qua Cloudflare
    if (imagePath) {
      imageService.cleanupDelayed(imagePath, 30000);
    }

    return { success: true, personID };
  } catch (error) {
    // Nếu là lần thử cuối cùng bị thất bại thì mới hẹn giờ xóa file
    const maxAttempts = job.opts?.attempts || 5;
    if (job.attemptsMade + 1 >= maxAttempts && imagePath) {
      imageService.cleanupDelayed(imagePath, 60000);
    }
    throw error;
  }
});

module.exports = {
  enqueueRegisterPerson: (payload) => hanetQueue.add('register_person_job', payload),
  enqueueUpdatePerson: (payload) => hanetQueue.add('update_person_job', payload)
};
