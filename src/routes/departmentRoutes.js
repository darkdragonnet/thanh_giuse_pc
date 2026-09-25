const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');

// [READ] Danh sách phòng ban
router.get('/', departmentController.listDepartments);

// [CREATE] Tạo mới phòng ban
router.post('/create', departmentController.handleCreate);

// [UPDATE] Cập nhật phòng ban
router.put('/update/:id', departmentController.handleUpdate);

// [DELETE] Xóa phòng ban
router.delete('/delete/:id', departmentController.handleDelete);

// [READ] Xem danh sách thành viên thuộc phòng ban
router.get('/:departmentID/members', departmentController.viewMembers);

// [CREATE/ADD] Thêm thành viên vào phòng ban
router.post('/:departmentID/members/add', departmentController.handleAddMembers);

module.exports = router;
