const fs = require('fs');
const Queue = require('bull');
const hanetService = require('./hanetService');
const imageService = require('./imageService');
const csvService = require('./csvService');
const { getErrorMessage } = require('../utils/hanetErrorMap');

// Danh sách mã lỗi không thể phục hồi bằng retry tự động (lỗi tham số, lỗi ảnh, lỗi quyền)
const NON_RETRIABLE_CODES = new Set([
  -1, -1005, -2035, -5005, -5006, -5010, -5011, -9002, -9005, -9006, -9008
]);

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
hanetQueue.process('register_person_job', 2, async (job) => {
  const { name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename, source_csv, className, class_name } = job.data;
  const targetClass = source_csv || className || class_name || null;
  const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const faceUrl = publicImageUrl || (imageFilename ? `${fallbackBaseUrl}/uploads/${imageFilename}` : null);

  console.log(`[Queue register_person_job] Bắt đầu xử lý: ${name} (${aliasID})`);

  let finalPersonID = null;
  let finalAvatarUrl = faceUrl;

  try {
    try {
      // 1. Thử gọi API đăng ký nhân sự (ưu tiên binary multipart nếu có imagePath, hoặc bằng URL)
      let registerRes;
      if (imagePath && fs.existsSync(imagePath)) {
        registerRes = await hanetService.registerPerson({
          name,
          aliasID,
          title,
          departmentID,
          imagePath,
          publicImageUrl,
          faceUrl
        });
      } else {
        registerRes = await hanetService.registerPersonByUrl({
          name,
          aliasID,
          title,
          departmentID,
          faceUrl: faceUrl || publicImageUrl
        });
      }

      if (registerRes && registerRes.returnCode === 1) {
        finalPersonID = registerRes.data?.personID || registerRes.data?.id;
        finalAvatarUrl = registerRes.data?.avatar || registerRes.data?.faceUrl || faceUrl;
        console.log(`[Queue register_person_job] ✅ Đăng ký mới thành công: ${finalPersonID}`);

        // Tự động ghi ngược thông tin đăng ký vào file CSV
        if (targetClass && finalPersonID) {
          await csvService.writeBackRegistration(targetClass, name, finalAvatarUrl, finalPersonID, title || '');
        }
      } else if (registerRes && registerRes.returnCode === -9007 && (registerRes.data?.personID || registerRes.data?.id)) {
        // Trường hợp HANET trả HTTP 200 kèm returnCode -9007
        finalPersonID = registerRes.data?.personID || registerRes.data?.id;
        console.warn(`[Queue register_person_job] ${getErrorMessage(-9007)} (PersonID: ${finalPersonID}). Tiến hành cập nhật ảnh Face ID & thông tin...`);

        // a. Cập nhật khuôn mặt mới (Face ID)
        const targetFaceUrl = faceUrl || publicImageUrl;
        if (targetFaceUrl) {
          try {
            await hanetService.updatePersonByFaceUrl(finalPersonID, targetFaceUrl);
            console.log(`[Queue register_person_job] ✅ Đã cập nhật ảnh Face ID mới cho ${finalPersonID}`);
          } catch (faceErr) {
            const errCode = faceErr.response?.data?.returnCode;
            console.warn(`[Queue register_person_job] Cập nhật Face ID thất bại:`, getErrorMessage(errCode, faceErr.message));
          }
        }

        // b. Cập nhật thông tin cá nhân
        try {
          await hanetService.updatePersonInfo(finalPersonID, name, title, aliasID);
          console.log(`[Queue register_person_job] ✅ Đã cập nhật thông tin cho ${finalPersonID}`);
        } catch (infoErr) {
          const errCode = infoErr.response?.data?.returnCode;
          console.warn(`[Queue register_person_job] Cập nhật info thất bại:`, getErrorMessage(errCode, infoErr.message));
        }

        // Tự động ghi ngược thông tin đăng ký vào file CSV
        if (targetClass && finalPersonID) {
          await csvService.writeBackRegistration(targetClass, name, targetFaceUrl || finalAvatarUrl, finalPersonID, title || '');
        }
      } else {
        const errorMsg = getErrorMessage(registerRes?.returnCode, registerRes?.returnMessage);
        const code = Number(registerRes?.returnCode);

        // Kiểm tra nếu là lỗi vĩnh viễn (ảnh hỏng, sai tham số, trùng mã) -> không retry vô ích
        if (NON_RETRIABLE_CODES.has(code)) {
          console.error(`[Queue register_person_job] ❌ Lỗi không thể retry (Mã ${code}): ${errorMsg}`);
          return { returnCode: code, returnMessage: errorMsg, error: true };
        }

        throw new Error(`[Mã lỗi ${registerRes?.returnCode}]: ${errorMsg}`);
      }
    } catch (apiErr) {
      const errData = apiErr.response?.data;
      const code = Number(errData?.returnCode || apiErr.code);

      // 2. Xử lý lỗi -9007: Người này / Khuôn mặt này đã tồn tại trên HANET
      if (errData && errData.returnCode === -9007 && (errData.data?.personID || errData.data?.id)) {
        finalPersonID = errData.data.personID || errData.data.id;
        console.warn(`[Queue register_person_job] ${getErrorMessage(-9007)} (PersonID: ${finalPersonID}). Tiến hành cập nhật ảnh Face ID & thông tin...`);

        // a. Cập nhật khuôn mặt mới (Face ID)
        const targetFaceUrl = faceUrl || publicImageUrl;
        if (targetFaceUrl) {
          try {
            await hanetService.updatePersonByFaceUrl(finalPersonID, targetFaceUrl);
            console.log(`[Queue register_person_job] ✅ Đã cập nhật ảnh Face ID mới cho ${finalPersonID}`);
          } catch (faceErr) {
            const errCode = faceErr.response?.data?.returnCode;
            console.warn(`[Queue register_person_job] Cập nhật Face ID thất bại:`, getErrorMessage(errCode, faceErr.message));
          }
        }

        // b. Cập nhật thông tin cá nhân
        try {
          await hanetService.updatePersonInfo(finalPersonID, name, title, aliasID);
          console.log(`[Queue register_person_job] ✅ Đã cập nhật thông tin cho ${finalPersonID}`);
        } catch (infoErr) {
          const errCode = infoErr.response?.data?.returnCode;
          console.warn(`[Queue register_person_job] Cập nhật info thất bại:`, getErrorMessage(errCode, infoErr.message));
        }

        // Tự động ghi ngược thông tin đăng ký vào file CSV
        if (targetClass && finalPersonID) {
          await csvService.writeBackRegistration(targetClass, name, targetFaceUrl || finalAvatarUrl, finalPersonID, title || '');
        }
      } else {
        const errorMsg = getErrorMessage(code, apiErr.message);
        console.error(`[Queue register_person_job] Lỗi khi xử lý: ${errorMsg}`);

        // Nếu mã lỗi nằm trong danh sách không thể retry -> không ném lỗi tiếp
        if (NON_RETRIABLE_CODES.has(code)) {
          console.error(`[Queue register_person_job] ❌ Bỏ qua retry cho mã lỗi ${code}`);
          return { returnCode: code, returnMessage: errorMsg, error: true };
        }

        // Lỗi kết nối / timeout -> ném ra để Bull Queue retry với exponential backoff
        throw apiErr;
      }
    }

    // 3. Gán vào phòng ban nếu có
    if (finalPersonID && departmentID) {
      try {
        await hanetService.addPersonsToDepartment(departmentID, finalPersonID);
        console.log(`[Queue register_person_job] ✅ Đã gán ${finalPersonID} vào phòng ban ${departmentID}`);
      } catch (deptErr) {
        const errCode = deptErr.response?.data?.returnCode;
        console.warn(`[Queue register_person_job] Gán phòng ban thất bại:`, getErrorMessage(errCode, deptErr.message));
      }
    }

    return { returnCode: 1, returnMessage: 'Success', personID: finalPersonID };

  } finally {
    // [RULE-022] Luôn delay 30 giây mới dọn dẹp ảnh để HANET fetch xong
    if (imagePath) {
      imageService.cleanupDelayed(imagePath, 30000);
    }
  }
});

// Xử lý Job cập nhật nhân sự ngầm
hanetQueue.process('update_person_job', 3, async (job) => {
  const { personID, name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename } = job.data;
  console.log(`[Queue update_person_job] Bắt đầu xử lý: ${name} (${personID})`);

  try {
    // 1. Cập nhật thông tin cơ bản
    const infoResult = await hanetService.updateInfo({
      personID,
      name,
      aliasID,
      title,
      departmentID
    });

    if (infoResult.returnCode !== 1) {
      const errorMsg = getErrorMessage(infoResult.returnCode, infoResult.returnMessage);
      const code = Number(infoResult.returnCode);
      if (NON_RETRIABLE_CODES.has(code)) {
        console.error(`[Queue update_person_job] ❌ Lỗi không thể retry (Mã ${code}): ${errorMsg}`);
        return { returnCode: code, returnMessage: errorMsg, error: true };
      }
      throw new Error(`[Mã lỗi ${infoResult.returnCode}]: ${errorMsg}`);
    }

    // Gán phòng ban để khóa liên kết phòng ban 100% trên HANET Cloud
    if (departmentID && String(departmentID) !== '0') {
      try {
        await hanetService.addPersonsToDepartment(departmentID, personID);
        console.log(`[Queue update_person_job] ✅ Đã khóa liên kết phòng ban ${departmentID} cho PersonID: ${personID}`);
      } catch (deptErr) {
        console.warn(`[Queue update_person_job] Gán phòng ban thất bại:`, deptErr.message);
      }
    }

    // 2. Nếu có ảnh mới, cập nhật Face ID
    const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
    const faceUrl = publicImageUrl || (imageFilename ? `${fallbackBaseUrl}/uploads/${imageFilename}` : null);

    if (faceUrl) {
      const faceResult = await hanetService.updateByFaceUrl({
        personID,
        faceUrl
      });

      if (faceResult.returnCode !== 1) {
        const errorMsg = getErrorMessage(faceResult.returnCode, faceResult.returnMessage);
        const code = Number(faceResult.returnCode);
        if (NON_RETRIABLE_CODES.has(code)) {
          console.error(`[Queue update_person_job] ❌ Lỗi không thể retry khi cập nhật ảnh (Mã ${code}): ${errorMsg}`);
          return { returnCode: code, returnMessage: errorMsg, error: true };
        }
        throw new Error(`[Mã lỗi ${faceResult.returnCode}]: ${errorMsg}`);
      }
    }

    return { success: true, personID };
  } finally {
    // [RULE-022] Xử lý thành công hoặc kết thúc -> Luôn delay 30 giây trước khi xóa file tạm
    if (imagePath) {
      imageService.cleanupDelayed(imagePath, 30000);
    }
  }
});

module.exports = {
  enqueueRegisterPerson: (payload) => hanetQueue.add('register_person_job', payload),
  enqueueUpdatePerson: (payload) => hanetQueue.add('update_person_job', payload)
};
