const axios = require('axios');
const qs = require('qs');
const FormData = require('form-data');
const fs = require('fs');
const { sanitizeErrorMessage, validateAndParseReturnCode } = require('../utils/sanitizer');
const { sanitizeImageUrl, isVerifiedHanetCdnUrl } = require('../utils/urlHelper');

/**
 * Lớp lỗi chuẩn hóa cho tất cả các cuộc gọi API tới HANET Cloud
 * Đảm bảo giữ đủ endpoint, httpStatus, cloudStatusCode, returnCode, returnMessage và không bao giờ lộ token/config
 */
class HanetApiError extends Error {
  constructor({
    endpoint,
    httpStatus = null,
    cloudStatusCode = null,
    returnCode = null,
    returnMessage = null,
    data = null,
    rawMessage = '',
    isTransportError = false
  }) {
    const safeMsg = sanitizeErrorMessage(returnMessage || rawMessage || 'Lỗi không xác định');
    const formattedMsg = `[HANET API Error] ${endpoint} | HTTP: ${httpStatus ?? 'N/A'} | CloudStatus: ${cloudStatusCode ?? 'N/A'} | ReturnCode: ${returnCode ?? 'N/A'} | ${safeMsg}`;
    super(formattedMsg);
    this.name = 'HanetApiError';
    this.endpoint = endpoint;
    this.httpStatus = typeof httpStatus === 'number' && Number.isInteger(httpStatus) ? httpStatus : null;
    this.cloudStatusCode = cloudStatusCode !== null && cloudStatusCode !== undefined ? String(cloudStatusCode).trim() : null;
    this.returnCode = validateAndParseReturnCode(returnCode);
    this.returnMessage = safeMsg;
    this.data = data;
    this.isTransportError = isTransportError;
  }
}

// Cấu hình axios instance với timeout 25s và Accept header chuẩn
const hanetAxios = axios.create({
  baseURL: process.env.HANET_API_BASE || 'https://partner.hanet.ai',
  timeout: 25000,
  headers: {
    'Accept': 'application/json'
  }
});

class HanetService {
  constructor() {
    this.apiBase = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
    this.oauthBase = process.env.HANET_OAUTH_BASE || 'https://oauth.hanet.com';
    this.clientId = process.env.HANET_CLIENT_ID;
    this.clientSecret = process.env.HANET_CLIENT_SECRET;

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
    return String(pId || '').trim();
  }

  // Quản lý và làm mới OAuth2 Access Token
  async getAccessToken(forceRefresh = false) {
    if (!forceRefresh && this.accessToken) {
      if (!this.tokenExpiry || new Date() < this.tokenExpiry) {
        return this.accessToken;
      }
    }

    if (this.clientId && this.clientSecret) {
      try {
        const res = await axios.post(
          `${this.oauthBase}/token`,
          qs.stringify({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            timeout: 25000
          }
        );

        this.accessToken = res.data.access_token;
        this.tokenExpiry = new Date(Date.now() + ((res.data.expires_in || 3600) - 300) * 1000);
        return this.accessToken;
      } catch (err) {
        throw new HanetApiError({
          endpoint: '/oauth/token',
          httpStatus: err.response?.status ?? null,
          returnMessage: sanitizeErrorMessage(err.response?.data?.error_description || err.message),
          rawMessage: err.message
        });
      }
    }

    if (this.accessToken) {
      return this.accessToken;
    }

    throw new HanetApiError({
      endpoint: '/oauth/token',
      returnMessage: 'Thiếu cấu hình HANET_ACCESS_TOKEN hoặc cặp HANET_CLIENT_ID / HANET_CLIENT_SECRET'
    });
  }

  // Helper phân tích và cấu trúc hóa lỗi từ Axios/HTTP/Network
  parseHanetError(err, endpoint) {
    if (err instanceof HanetApiError) {
      return err;
    }

    const httpStatus = typeof err.response?.status === 'number' ? err.response.status : null;
    const errData = err.response?.data;
    let returnCode = null;
    let cloudStatusCode = null;
    let returnMessage = null;
    let payloadData = null;

    if (errData && typeof errData === 'object' && !Array.isArray(errData)) {
      returnCode = validateAndParseReturnCode(errData.returnCode);
      cloudStatusCode = errData.statusCode !== undefined ? errData.statusCode : null;
      returnMessage = sanitizeErrorMessage(errData.returnMessage || errData.message || (typeof errData.data === 'string' ? errData.data : null));
      payloadData = errData.data !== undefined ? errData.data : null;
    } else if (typeof errData === 'string') {
      returnMessage = sanitizeErrorMessage(errData);
    } else {
      returnMessage = sanitizeErrorMessage(err.message);
    }

    return new HanetApiError({
      endpoint,
      httpStatus,
      cloudStatusCode,
      returnCode,
      returnMessage: returnMessage || sanitizeErrorMessage(err.message),
      data: payloadData,
      rawMessage: err.message,
      isTransportError: !err.response
    });
  }

  // Helper kiểm tra lỗi xác thực token (401 hoặc -103)
  isAuthError(err) {
    const httpStatus = err.httpStatus ?? err.response?.status ?? null;
    let code = err.returnCode;
    if (code === undefined || code === null) {
      if (err.response?.data && typeof err.response.data === 'object' && !Array.isArray(err.response.data)) {
        code = validateAndParseReturnCode(err.response.data.returnCode);
      }
    }
    return httpStatus === 401 || code === -103;
  }

  // Helper phân tích HTTP response từ HANET
  parseHanetResponse(response, endpoint) {
    const httpStatus = typeof response?.status === 'number' ? response.status : null;
    const resData = response?.data;

    // 1. Kiểm tra HTTP Status Transport: Nếu không nằm trong 200..299, coi là lỗi HTTP
    if (httpStatus !== null && (httpStatus < 200 || httpStatus >= 300)) {
      const errData = resData && typeof resData === 'object' && !Array.isArray(resData) ? resData : null;
      const parsedReturnCode = errData ? validateAndParseReturnCode(errData.returnCode) : null;
      const rawMsg = typeof resData === 'string' ? resData : (errData?.returnMessage || errData?.message || `HTTP error ${httpStatus}`);
      throw new HanetApiError({
        endpoint,
        httpStatus,
        cloudStatusCode: errData?.statusCode ?? null,
        returnCode: parsedReturnCode,
        returnMessage: sanitizeErrorMessage(rawMsg),
        data: errData?.data ?? null,
        rawMessage: `HTTP status ${httpStatus}`,
        isTransportError: false
      });
    }

    // 2. Kiểm tra format response body
    if (!resData || typeof resData !== 'object' || Array.isArray(resData)) {
      throw new HanetApiError({
        endpoint,
        httpStatus,
        returnCode: null,
        returnMessage: sanitizeErrorMessage(typeof resData === 'string' ? resData : 'Phản hồi từ HANET rỗng hoặc không đúng định dạng JSON'),
        rawMessage: 'Invalid or non-JSON response body'
      });
    }

    // 3. Strict validation: CHỈ chấp nhận resData.returnCode (không fallback code)
    if (resData.returnCode === undefined || resData.returnCode === null) {
      throw new HanetApiError({
        endpoint,
        httpStatus,
        cloudStatusCode: resData.statusCode ?? null,
        returnCode: null,
        returnMessage: sanitizeErrorMessage(resData.returnMessage || resData.message || 'Phản hồi từ HANET thiếu trường returnCode bắt buộc'),
        data: resData.data !== undefined ? resData.data : null,
        rawMessage: 'Missing returnCode in response body'
      });
    }

    const returnCode = validateAndParseReturnCode(resData.returnCode);
    if (returnCode === null) {
      throw new HanetApiError({
        endpoint,
        httpStatus,
        cloudStatusCode: resData.statusCode ?? null,
        returnCode: null,
        returnMessage: sanitizeErrorMessage(`Trường returnCode không đúng định dạng số nguyên (${typeof resData.returnCode})`),
        data: resData.data !== undefined ? resData.data : null,
        rawMessage: 'Invalid returnCode type in response body'
      });
    }

    const returnMessage = sanitizeErrorMessage(resData.returnMessage || resData.message || null);
    const payloadData = resData.data !== undefined ? resData.data : null;

    // 4. Hợp đồng chuẩn của HANET AI Cloud: returnCode === 1 là thành công
    if (returnCode !== 1) {
      throw new HanetApiError({
        endpoint,
        httpStatus,
        cloudStatusCode: resData.statusCode ?? null,
        returnCode,
        returnMessage: returnMessage || `Lỗi nghiệp vụ HANET mã ${returnCode}`,
        data: payloadData,
        rawMessage: `Business error code ${returnCode}`
      });
    }

    return resData;
  }

  // Helper gửi request POST chuẩn hóa, bắt lỗi an toàn và bọc trong HanetApiError
  async postWithToken(endpoint, data = {}, isRetry = false) {
    try {
      const token = await this.getAccessToken(isRetry);
      const payload = { ...data, token };

      const res = await hanetAxios.post(endpoint, qs.stringify(payload), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 25000
      });

      const resData = res.data;
      const returnCode = (resData && typeof resData === 'object' && !Array.isArray(resData))
        ? validateAndParseReturnCode(resData.returnCode)
        : null;

      // Xử lý token hết hạn trả về trong body mã -103 (tối đa retry 1 lần)
      if (returnCode === -103 && !isRetry) {
        console.warn(`[HANET Service] Access token đã hết hạn (Mã -103) tại ${endpoint}. Đang tự động làm mới token...`);
        return this.postWithToken(endpoint, data, true);
      }

      return this.parseHanetResponse(res, endpoint);
    } catch (err) {
      if (err instanceof HanetApiError) {
        if (err.returnCode === -103 && !isRetry) {
          console.warn(`[HANET Service] Access token đã hết hạn (Mã -103) tại ${endpoint}. Đang thử làm mới token...`);
          return this.postWithToken(endpoint, data, true);
        }
        console.error(`❌ [HANET API Call Failed] Endpoint: ${endpoint} | HTTP: ${err.httpStatus ?? 'N/A'} | ReturnCode: ${err.returnCode !== null ? err.returnCode : 'N/A'} | Message: ${err.returnMessage}`);
        throw err;
      }

      const apiErr = this.parseHanetError(err, endpoint);

      // Tự động retry 1 lần nếu gặp lỗi HTTP 401 hoặc mã -103
      if (this.isAuthError(err) && !isRetry) {
        console.warn(`[HANET Service] Xác thực thất bại (HTTP ${apiErr.httpStatus} / Code ${apiErr.returnCode}) tại ${endpoint}. Đang thử làm mới token...`);
        return this.postWithToken(endpoint, data, true);
      }

      // Log an toàn: CHỈ log các trường cần thiết, KHÔNG log token / headers / axios config
      console.error(`❌ [HANET API Call Failed] Endpoint: ${endpoint} | HTTP: ${apiErr.httpStatus ?? 'N/A'} | ReturnCode: ${apiErr.returnCode !== null ? apiErr.returnCode : 'N/A'} | Message: ${apiErr.returnMessage}`);

      throw apiErr;
    }
  }

  /* =========================================================================
   * PERSON APIs
   * ========================================================================= */

  // Đăng ký nhân sự kèm tệp ảnh nhị phân trực tiếp (Multipart Form-Data)
  async registerPerson(data, isRetry = false) {
    const token = await this.getAccessToken(isRetry);
    const formData = new FormData();

    const cleanAliasID = String(data.aliasID || '').trim().replace(/\s+/g, '_');
    const cleanName = String(data.name || '').trim();
    const cleanTitle = String(data.title || 'Nhân viên').trim();
    const cleanDepartmentID = String(data.departmentID || '').trim();

    formData.append('token', token);
    formData.append('placeID', this.placeId);
    formData.append('name', cleanName);
    formData.append('aliasID', cleanAliasID);
    formData.append('title', cleanTitle);
    formData.append('departmentID', cleanDepartmentID);

    if (data.imagePath && fs.existsSync(data.imagePath)) {
      formData.append('file', fs.createReadStream(data.imagePath));
    } else {
      throw new HanetApiError({
        endpoint: '/person/register',
        returnMessage: 'Không tìm thấy file ảnh tại đường dẫn để upload.'
      });
    }

    try {
      const response = await hanetAxios.post('/person/register', formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 25000
      });

      const resData = response.data;
      const returnCode = resData ? (resData.returnCode !== undefined ? Number(resData.returnCode) : null) : null;

      if (returnCode === -103 && !isRetry) {
        console.warn('[HANET Service] Access token đã hết hạn (Mã -103). Đang tự động xoay vòng lấy token mới...');
        return this.registerPerson(data, true);
      }

      return this.parseHanetResponse(response, '/person/register');
    } catch (err) {
      if (err instanceof HanetApiError) {
        if (err.returnCode === -103 && !isRetry) {
          console.warn('[HANET Service] Access token đã hết hạn (Mã -103). Đang thử làm mới token...');
          return this.registerPerson(data, true);
        }
        console.error(`❌ [HANET registerPerson Error] HTTP: ${err.httpStatus || 'N/A'} | Code: ${err.returnCode !== null ? err.returnCode : 'N/A'} | Message: ${err.returnMessage}`);
        throw err;
      }

      const apiErr = this.parseHanetError(err, '/person/register');

      if (this.isAuthError(err) && !isRetry) {
        return this.registerPerson(data, true);
      }

      console.error(`❌ [HANET registerPerson Error] HTTP: ${apiErr.httpStatus || 'N/A'} | Code: ${apiErr.returnCode !== null ? apiErr.returnCode : 'N/A'} | Message: ${apiErr.returnMessage}`);

      throw apiErr;
    }
  }

  /**
   * Cập nhật thông tin nhân sự trên HANET Cloud
   * Luôn giữ personID dạng chuỗi
   */
  async updatePerson(personID, name, aliasID, departmentID, title = 'Học Sinh') {
    let pId, pName, pAlias, pDept, pTitle;

    if (typeof personID === 'object' && personID !== null) {
      pId = personID.personID || personID.id || personID.person_id;
      pName = personID.name;
      pAlias = personID.aliasID || personID.alias_id;
      pDept = personID.departmentID || personID.department_id;
      pTitle = personID.title;
    } else {
      pId = personID;
      pName = name;
      pAlias = aliasID;
      pDept = departmentID;
      pTitle = title;
    }

    const cleanPersonID = String(pId || '').trim();
    const cleanName = String(pName || '').trim();
    const cleanAliasID = String(pAlias || '').trim().replace(/\s+/g, '_');
    const cleanTitle = String(pTitle || 'Học Sinh').trim();
    const cleanDeptID = String(pDept || '').trim();

    const finalDeptID = (!cleanDeptID || cleanDeptID === '0' || cleanDeptID === 'undefined' || cleanDeptID === 'null')
      ? '990653'
      : cleanDeptID;

    const payload = {
      placeID: this.placeId,
      name: cleanName,
      title: cleanTitle,
      departmentID: String(finalDeptID)
    };

    if (cleanPersonID) {
      payload.personID = cleanPersonID;
    }
    if (cleanAliasID) {
      payload.aliasID = cleanAliasID;
    }

    const res = await this.postWithToken('/person/updateInfo', payload);
    return res;
  }

  // Alias tương thích cho updateInfo
  async updateInfo(data) {
    return this.updatePerson(data);
  }

  async updatePersonInfo(personID, name, title, aliasID, departmentID) {
    return this.updatePerson(personID, name, aliasID, departmentID, title);
  }

  // Cập nhật Face ID cho nhân sự qua URL ảnh (/person/updateByFaceUrl)
  async updateByFaceUrl(data) {
    if (!data || typeof data !== 'object') {
      throw new HanetApiError({
        endpoint: '/person/updateByFaceUrl',
        returnMessage: 'Dữ liệu đầu vào cho updateByFaceUrl không hợp lệ hoặc rỗng.'
      });
    }

    const cleanAliasID = String(data.aliasID || '').trim().replace(/\s+/g, '_');
    const cleanPlaceID = String(data.placeID || this.placeId || '').trim();
    const rawPhotoUrl = String(data.url || data.publicImageUrl || data.faceUrl || data.fileUrl || data.avatar || '').trim();
    const cleanPersonID = data.personID !== undefined && data.personID !== null ? String(data.personID).trim() : '';

    if (!cleanAliasID) {
      throw new HanetApiError({
        endpoint: '/person/updateByFaceUrl',
        returnMessage: 'Thiếu aliasID bắt buộc để cập nhật Face ID.'
      });
    }

    if (!cleanPlaceID) {
      throw new HanetApiError({
        endpoint: '/person/updateByFaceUrl',
        returnMessage: 'Thiếu placeID bắt buộc để cập nhật Face ID.'
      });
    }

    if (!rawPhotoUrl) {
      throw new HanetApiError({
        endpoint: '/person/updateByFaceUrl',
        returnMessage: 'Thiếu URL ảnh hợp lệ để cập nhật Face ID.'
      });
    }

    const sanitizedUrl = sanitizeImageUrl(rawPhotoUrl);
    if (!sanitizedUrl) {
      throw new HanetApiError({
        endpoint: '/person/updateByFaceUrl',
        returnMessage: 'URL ảnh không hợp lệ sau khi làm sạch.'
      });
    }

    try {
      const parsedUrl = new URL(sanitizedUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new HanetApiError({
          endpoint: '/person/updateByFaceUrl',
          returnMessage: `Giao thức URL ảnh không được phép (${parsedUrl.protocol}). Chỉ chấp nhận http: hoặc https:.`
        });
      }
      if (parsedUrl.username || parsedUrl.password) {
        throw new HanetApiError({
          endpoint: '/person/updateByFaceUrl',
          returnMessage: 'URL ảnh không được chứa credentials.'
        });
      }
    } catch (urlErr) {
      if (urlErr instanceof HanetApiError) throw urlErr;
      throw new HanetApiError({
        endpoint: '/person/updateByFaceUrl',
        returnMessage: `URL ảnh không đúng định dạng: ${urlErr.message}`
      });
    }

    const payload = {
      placeID: cleanPlaceID,
      aliasID: cleanAliasID,
      url: sanitizedUrl
    };

    if (cleanPersonID) {
      payload.personID = cleanPersonID;
    }

    const res = await this.postWithToken('/person/updateByFaceUrl', payload);
    const returnCode = validateAndParseReturnCode(res?.returnCode);

    if (returnCode === 1) {
      const resData = res.data;
      const cloudPath = typeof resData === 'object' && resData !== null
        ? (resData.path || resData.avatar || resData.faceUrl || resData.file || null)
        : null;

      const isValidCdn = cloudPath ? isVerifiedHanetCdnUrl(cloudPath) : false;
      const verifiedPath = isValidCdn ? sanitizeImageUrl(cloudPath) : null;

      return {
        ...res,
        data: {
          ...(typeof resData === 'object' && resData !== null ? resData : {}),
          path: verifiedPath || (typeof resData === 'object' ? resData?.path : null),
          avatar: verifiedPath || (typeof resData === 'object' ? resData?.avatar : null),
          faceUrl: verifiedPath || (typeof resData === 'object' ? resData?.faceUrl : null),
          isVerifiedCdn: isValidCdn,
          needsReconciliation: !isValidCdn
        }
      };
    }

    return res;
  }

  async updatePersonByFaceUrl(personID, faceUrl) {
    if (typeof personID === 'object' && personID !== null) {
      return this.updateByFaceUrl(personID);
    }
    return this.updateByFaceUrl({ personID, url: faceUrl });
  }

  // Đăng ký nhân sự qua URL ảnh
  async registerPersonByUrl(data) {
    const payload = {
      placeID: this.placeId,
      name: String(data.name || '').trim(),
      aliasID: String(data.aliasID || '').trim().replace(/\s+/g, '_'),
      title: String(data.title || 'Nhân viên').trim(),
      faceUrl: data.faceUrl || data.publicImageUrl
    };
    if (data.departmentID) payload.departmentID = String(data.departmentID).trim();
    return this.postWithToken('/person/registerByUrl', payload);
  }

  /**
   * Lấy danh sách nhân sự từ Cloud HANET (Hỗ trợ gom phân trang)
   */
  async getListByPlace(options = { fetchAll: true, size: 50 }) {
    const isFetchAll = typeof options === 'boolean' ? options : (options?.fetchAll !== false);
    const requestedPage = typeof options === 'object' && options?.page ? Number(options.page) : 1;
    const pageSize = typeof options === 'object' && options?.size ? Number(options.size) : 50;

    if (!isFetchAll) {
      return this.postWithToken('/person/getListByPlace', {
        placeID: this.placeId,
        page: requestedPage,
        size: pageSize
      });
    }

    const personMap = new Map();
    let currentPage = 1;
    let keepPaging = true;
    const maxPages = 50;

    while (keepPaging && currentPage <= maxPages) {
      try {
        const res = await this.postWithToken('/person/getListByPlace', {
          placeID: this.placeId,
          page: currentPage,
          size: pageSize
        });

        let items = [];
        if (res && Array.isArray(res.data)) {
          items = res.data;
        } else if (res && res.data && Array.isArray(res.data.data)) {
          items = res.data.data;
        } else if (res && res.data && Array.isArray(res.data.hits)) {
          items = res.data.hits;
        } else if (Array.isArray(res)) {
          items = res;
        }

        if (Array.isArray(items) && items.length > 0) {
          items.forEach(p => {
            const id = String(p.id || p.personID || '').trim();
            if (id) {
              personMap.set(id, p);
            } else {
              personMap.set(`temp_${Math.random()}`, p);
            }
          });

          if (items.length < pageSize) {
            keepPaging = false;
          } else {
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        } else {
          keepPaging = false;
        }
      } catch (err) {
        console.error(`[HanetService] Lỗi quét danh sách nhân sự tại trang ${currentPage}:`, err.message);
        keepPaging = false;
      }
    }

    const allPersons = Array.from(personMap.values());
    return {
      returnCode: 1,
      returnMessage: 'Success',
      data: allPersons,
      total: allPersons.length
    };
  }

  async getAllPersonsByPlace(size = 50) {
    return this.getListByPlace({ fetchAll: true, size });
  }

  async getPersonByAliasID(aliasID, placeID = this.placeId) {
    return this.postWithToken('/person/getUserInfoByAliasID', {
      placeID: placeID || this.placeId,
      aliasID: String(aliasID || '').trim()
    });
  }

  async getCheckinByTimestamp(fromTimestamp, toTimestamp) {
    return this.postWithToken('/person/getCheckinByPlaceIdInTimestamp', {
      placeID: this.placeId,
      from: fromTimestamp,
      to: toTimestamp,
      size: 500
    });
  }

  async removePerson(personID) {
    return this.postWithToken('/person/removePersonByID', {
      placeID: this.placeId,
      personID: String(personID).trim()
    });
  }

  /* =========================================================================
   * DEPARTMENT APIs
   * ========================================================================= */

  async getDepartmentList(page = 1, size = 100, keyword = '') {
    const payload = {
      placeID: this.placeId,
      page,
      size
    };
    if (keyword) payload.keyword = keyword;
    return this.postWithToken('/department/list', payload);
  }

  async createDepartment(name, desc = '') {
    return this.postWithToken('/department/create', {
      placeID: this.placeId,
      name,
      desc
    });
  }

  async updateDepartment(departmentID, name, desc = '') {
    return this.postWithToken('/department/update', {
      placeID: this.placeId,
      id: String(departmentID).trim(),
      name,
      desc
    });
  }

  async removeDepartment(departmentID) {
    return this.postWithToken('/department/remove', {
      placeID: this.placeId,
      id: String(departmentID).trim()
    });
  }

  async getPersonsByDepartment(departmentID, page = 1, size = 50) {
    return this.postWithToken('/department/list-person', {
      placeID: this.placeId,
      departmentID: String(departmentID).trim(),
      page,
      size
    });
  }

  async addPersonsToDepartment(departmentID, personIDs) {
    const formattedPersonIDs = Array.isArray(personIDs) ? personIDs.map(String).join(',') : String(personIDs);
    return this.postWithToken('/department/add-person', {
      placeID: this.placeId,
      departmentID: String(departmentID).trim(),
      personIDs: formattedPersonIDs
    });
  }

  async removePersonsFromDepartment(departmentID, personIDs) {
    const formattedPersonIDs = Array.isArray(personIDs) ? personIDs.map(String).join(',') : String(personIDs);
    return this.postWithToken('/department/remove-person', {
      placeID: this.placeId,
      departmentID: String(departmentID).trim(),
      personID: formattedPersonIDs
    });
  }
}

const hanetServiceInstance = new HanetService();
hanetServiceInstance.HanetApiError = HanetApiError;

module.exports = hanetServiceInstance;
module.exports.HanetApiError = HanetApiError;
