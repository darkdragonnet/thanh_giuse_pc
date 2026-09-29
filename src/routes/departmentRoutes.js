const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authorize, ROLES } = require('../middlewares/authMiddleware');
const { auditLog } = require('../middlewares/auditMiddleware');

// [READ] Danh sách phòng ban
router.get('/', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), departmentController.listDepartments);

// [CREATE] Tạo mới phòng ban
router.post('/create', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('CREATE_DEPARTMENT'), departmentController.handleCreate);

// [UPDATE] Cập nhật phòng ban
router.put('/update/:id', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('UPDATE_DEPARTMENT'), departmentController.handleUpdate);

// [DELETE] Xóa phòng ban
router.delete('/delete/:id', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_DEPARTMENT'), departmentController.handleDelete);

// [FIX] Tự động xoá và tạo lại phòng ban qua API app (gắn đúng placeID)
router.post('/fix/:id', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('FIX_DEPARTMENT'), departmentController.handleFix);

// [READ] Xem danh sách thành viên thuộc phòng ban
router.get('/:departmentID/members', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), departmentController.viewMembers);

// [CREATE/ADD] Thêm thành viên vào phòng ban
router.post('/:departmentID/members/add', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('ADD_DEPARTMENT_MEMBERS'), departmentController.handleAddMembers);

module.exports = router;
