const express = require('express');
const router = express.Router();
const dbClassService = require('../services/dbClassService');

// 1. Hiển thị trang quản lý lớp học (PostgreSQL)
router.get('/class/:className', async (req, res) => {
  try {
    const { className } = req.params;
    const members = await dbClassService.getClassMembers(className);
    const department = members.length > 0 ? (members[0].department_id || '990653') : '990653';
    res.render('class_manager', { className, members, department, layout: false });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi tải danh sách lớp từ PostgreSQL:', err.message);
    res.status(500).send('Lỗi máy chủ khi tải thông tin lớp');
  }
});

// 2. Thêm thành viên mới vào lớp (PostgreSQL)
router.post('/class/:className/member', async (req, res) => {
  try {
    const { className } = req.params;
    const { name, title, department, aliasId, alias_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên thành viên không được để trống' });
    }

    const member = await dbClassService.addMember({
      name: name.trim(),
      className,
      departmentId: department,
      title: title || 'Học Sinh',
      aliasId: aliasId || alias_id || null
    });

    res.json({
      success: true,
      member,
      aliasID: member.alias_id || member.AliasID
    });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi thêm thành viên:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Chỉnh sửa thông tin / Đổi tên thành viên (PostgreSQL)
router.put('/class/:className/member', async (req, res) => {
  try {
    const { className } = req.params;
    const { alias, alias_id, name, title, department, class: newClass } = req.body;
    const targetAlias = alias || alias_id;

    if (!targetAlias) {
      return res.status(400).json({ success: false, message: 'Thiếu AliasID của thành viên cần sửa' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên thành viên không được để trống' });
    }

    const updated = await dbClassService.updateMember(targetAlias, {
      name: name.trim(),
      title,
      className: newClass || className,
      departmentId: department
    });

    res.json({ success: true, member: updated });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi cập nhật thành viên:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Xóa thành viên (PostgreSQL)
router.delete('/class/:className/member/:alias', async (req, res) => {
  try {
    const { alias } = req.params;

    if (!alias) {
      return res.status(400).json({ success: false, message: 'Thiếu AliasID cần xóa' });
    }

    await dbClassService.deleteMember(alias);
    res.json({ success: true, message: 'Đã xóa thành viên thành công' });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi xóa thành viên:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Đổi tên Lớp (PostgreSQL)
router.post('/class/:className/rename', async (req, res) => {
  try {
    const { className } = req.params;
    const { newClassName } = req.body;

    if (!newClassName || !newClassName.trim()) {
      return res.status(400).json({ success: false, message: 'Tên lớp mới không được để trống' });
    }

    const result = await dbClassService.renameClass(className, newClassName.trim());
    res.json({ success: true, newClassName: newClassName.trim(), result });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi đổi tên lớp:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
