const express = require('express');
const multer = require('multer');
const path = require('path');
const personController = require('../controllers/personController');
const authController = require('../controllers/authController');
const { authorize, ROLES } = require('../middlewares/authMiddleware');
const { auditLog } = require('../middlewares/auditMiddleware');

const router = express.Router();

const upload = multer({
  dest: path.join(process.cwd(), 'uploads/temp/'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/* =========================================================================
 * 1. PUBLIC ROUTES (Không dùng authorize - Dành cho Zalo WebView & Công khai)
 * ========================================================================= */
router.get('/links', personController.showLinks);
router.get('/login', authController.showLogin);
router.post('/login', authController.handleLogin);
router.get('/logout', authController.handleLogout);

// Đăng ký theo lớp / file danh mục CSV (Tối ưu Zalo WebView)
router.get('/register/:file_name', personController.showRegisterForm);
router.get('/register', personController.renderRegisterForm);
router.post('/register/:file_name', upload.any(), auditLog('REGISTER_FACE_BY_FILE'), personController.handleRegister);
router.post('/register', upload.any(), auditLog('REGISTER_FACE_GENERAL'), personController.handleRegister);

/* =========================================================================
 * 2. PROTECTED ROUTES (Áp dụng RBAC & Audit Log)
 * ========================================================================= */

// Quản lý danh sách nhân sự trên Cloud
router.get('/admin/person/list', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.list);
router.get('/admin/list', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.list);

// Cập nhật thông tin / FaceID nhân sự
router.post('/admin/person/update', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), upload.any(), auditLog('UPDATE_PERSON'), personController.update);
router.get('/edit/:personID', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.renderEditForm);
router.put('/update/:personID', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), upload.any(), auditLog('UPDATE_PERSON'), personController.update);
router.post('/update/:personID', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), upload.any(), auditLog('UPDATE_PERSON'), personController.update);

// Xóa nhân sự khỏi Cloud và CSV
router.post('/admin/person/delete', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);
router.delete('/delete/:personID', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);
router.post('/delete/:personID', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);
router.delete('/person/delete/:personID', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);
router.post('/person/delete/:personID', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);

// Đồng bộ Cloud về CSV
router.post('/admin/sync/cloud-to-csv', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('TRIGGER_CLOUD_SYNC'), personController.triggerSync);

// Quản lý Dead Letter Queue (DLQ)
router.get('/admin/dlq', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.viewDLQ);

// Lịch sử Check-in Real-time
router.get('/checkin', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.renderCheckin);

module.exports = router;
