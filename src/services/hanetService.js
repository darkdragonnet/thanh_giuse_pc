const axios = require('axios');
const qs = require('qs');
const FormData = require('form-data');
const fs = require('fs');

class HanetService {
  constructor() {
    this.apiBase = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
    this.oauthBase = process.env.HANET_OAUTH_BASE || 'https://oauth.hanet.com';
    this.clientId = process.env.HANET_CLIENT_ID;
    this.clientSecret = process.env.HANET_CLIENT_SECRET;

    // Ưu tiên sử dụng Token tĩnh từ biến môi trường (nếu có)
    this.envAccessToken = process.env.HANET_ACCESS_TOKEN || null;
    this.accessToken = this.envAccessToken;
    this.tokenExpiry = null;
  }

  // Getter động - luôn đọc giá trị mới nhất từ process.env tại thời điểm gọi
  get placeId() {
    const pId = process.env.HANET_PLACE_ID;
    if (!pId) {
      console.warn('[HanetService] CẢNH BÁO: HANET_PLACE_ID chưa được định nghĩa trong .env!');
    }
    return pId;
  }

  // Tự động quản lý, ưu tiên token cấu hình và xoay vòng OAuth2 Token
  async getAccessToken(forceRefresh = false) {
    if (!forceRefresh && this.accessToken) {
      // Nếu có tokenExpiry và chưa hết hạn, hoặc dùng token tĩnh chưa bị đánh dấu hết hạn
      if (!this.tokenExpiry || new Date() < this.tokenExpiry) {
        return this.accessToken;
      }
    }

    // Nếu cần làm mới token hoặc token hết hạn, gọi OAuth2 nếu có Client ID & Client Secret
    if (this.clientId && this.clientSecret) {
      try {
        const res = await axios.post(
          `${this.oauthBase}/token`,
          qs.stringify({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        this.accessToken = res.data.access_token;
        this.tokenExpiry = new Date(Date.now() + ((res.data.expires_in || 3600) - 300) * 1000);
        return this.accessToken;
      } catch (err) {
        throw new Error(`[HANET OAuth Error] Không thể lấy Access Token: ${err.response?.data?.error_description || err.message}`);
      }
    }

    // Nếu không có Client credentials nhưng có envAccessToken
    if (this.accessToken) {
      return this.accessToken;
    }

    throw new Error('[HANET Config Error] Vui lòng cấu hình HANET_ACCESS_TOKEN hoặc cặp HANET_CLIENT_ID / HANET_CLIENT_SECRET trong .env');
  }

  // Helper gửi request tự động retry xoay vòng token khi gặp mã lỗi -103 (ACCESS_TOKEN_EXPIRE)
  async postWithToken(endpoint, data = {}, isRetry = false) {
    const token = await this.getAccessToken(isRetry);
    const payload = { ...data, token };

    const res = await axios.post(`${this.apiBase}${endpoint}`, qs.stringify(payload), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // Kiểm tra nếu mã lỗi là -103 (Token hết hạn) và chưa retry
    if (res.data && res.data.returnCode === -103 && !isRetry) {
      console.warn('[HANET Service] Access token đã hết hạn (Mã -103). Đang tự động xoay vòng lấy token mới qua OAuth2...');
      return this.postWithToken(endpoint, data, true);
    }

    return res.data;
  }

  /* =========================================================================
   * PERSON APIs
   * ========================================================================= */

  // Đăng ký nhân sự kèm tệp ảnh nhị phân trực tiếp (Multipart Form-Data)
  async registerPerson(data, isRetry = false) {
    const token = await this.getAccessToken(isRetry);
    const formData = new FormData();

    // Đưa token vào form-data body thay vì HTTP Header
    formData.append('token', token);
    formData.append('placeID', this.placeId);
    formData.append('name', data.name);
    formData.append('aliasID', data.aliasID);
    formData.append('title', data.title || 'Nhân viên');
    formData.append('departmentID', data.departmentID || '');

    // Đọc file ảnh từ local path và đính kèm binary stream
    if (data.imagePath && fs.existsSync(data.imagePath)) {
      formData.append('faceImage', fs.createReadStream(data.imagePath));
    } else {
      throw new Error('[HanetService] Không tìm thấy file ảnh tại đường dẫn để upload.');
    }

    // Gửi request với headers của form-data (không cần truyền token qua headers nữa)
    const response = await axios.post(`${this.apiBase}/person/register`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    // Kiểm tra token hết hạn (Mã -103) và xoay vòng
    if (response.data && response.data.returnCode === -103 && !isRetry) {
      console.warn('[HANET Service] Access token đã hết hạn (Mã -103). Đang tự động xoay vòng lấy token mới qua OAuth2...');
      return this.registerPerson(data, true);
    }

    return response.data;
  }

  // Cập nhật thông tin nhân sự (Name, AliasID, Title)
  async updateInfo(data) {
    const payload = {
      placeID: this.placeId,
      personID: data.personID,
      aliasID: data.aliasID,
      name: data.name,
      title: data.title || 'Nhân viên'
    };
    return this.postWithToken('/person/updateInfo', payload);
  }

  // Cập nhật Face ID cho nhân sự qua faceUrl
  async updateByFaceUrl(data) {
    const payload = {
      placeID: this.placeId,
      personID: data.personID,
      faceUrl: data.publicImageUrl || data.faceUrl
    };
    return this.postWithToken('/person/updateByFaceUrl', payload);
  }

  // Lấy danh sách nhân sự trực tiếp từ Cloud
  async getListByPlace() {
    return this.postWithToken('/person/getListByPlace', { placeID: this.placeId });
  }

  // Lấy dữ liệu Check-in theo timestamp (Ràng buộc: cùng 1 tháng dương lịch)
  async getCheckinByTimestamp(fromTimestamp, toTimestamp) {
    return this.postWithToken('/person/getCheckinByPlaceIdInTimestamp', {
      placeID: this.placeId,
      from: fromTimestamp,
      to: toTimestamp,
      size: 500
    });
  }

  // Xóa nhân sự trên Cloud
  async removePerson(personID) {
    return this.postWithToken('/person/removePersonByID', {
      placeID: this.placeId,
      personID
    });
  }

  /* =========================================================================
   * DEPARTMENT APIs
   * ========================================================================= */

  // Lấy danh sách phòng ban
  async getDepartmentList(page = 1, size = 100, keyword = '') {
    const payload = {
      placeID: this.placeId,
      page,
      size
    };
    if (keyword) payload.keyword = keyword;
    return this.postWithToken('/department/list', payload);
  }

  // Tạo mới phòng ban
  async createDepartment(name, desc = '') {
    return this.postWithToken('/department/create', {
      placeID: this.placeId,
      name,
      desc
    });
  }

  // Cập nhật phòng ban
  async updateDepartment(departmentID, name, desc = '') {
    return this.postWithToken('/department/update', {
      placeID: this.placeId,
      id: departmentID,
      name,
      desc
    });
  }

  // Xóa phòng ban
  async removeDepartment(departmentID) {
    return this.postWithToken('/department/remove', {
      placeID: this.placeId,
      id: departmentID
    });
  }

  // Lấy danh sách nhân sự thuộc phòng ban
  async getPersonsByDepartment(departmentID, page = 1, size = 50) {
    return this.postWithToken('/department/list-person', {
      placeID: this.placeId,
      departmentID,
      page,
      size
    });
  }

  // Thêm nhân sự vào phòng ban
  async addPersonsToDepartment(departmentID, personIDs) {
    const formattedPersonIDs = Array.isArray(personIDs) ? personIDs.join(',') : String(personIDs);
    return this.postWithToken('/department/add-person', {
      placeID: this.placeId,
      departmentID,
      personIDs: formattedPersonIDs
    });
  }

  // Xóa nhân sự khỏi phòng ban
  async removePersonsFromDepartment(departmentID, personIDs) {
    const formattedPersonIDs = Array.isArray(personIDs) ? personIDs.join(',') : String(personIDs);
    return this.postWithToken('/department/remove-person', {
      placeID: this.placeId,
      departmentID,
      personID: formattedPersonIDs
    });
  }
}

module.exports = new HanetService();
