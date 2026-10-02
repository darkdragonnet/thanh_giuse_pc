const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { authorize, ROLES } = require('../middlewares/authMiddleware');
const { auditLog } = require('../middlewares/auditMiddleware');

/* =========================================================================
 * 1. GIAO DIỆN QUẢN LÝ CHUYỂN LỚP (Admin Interface)
 * ========================================================================= */
router.get(
  '/admin/transfers',
  authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  transferController.renderTransferPage
);

/* =========================================================================
 * 2. RESTful APIs ĐIỀU PHỐI CHUYỂN LỚP & HOÀN TÁC
 * ========================================================================= */

// Lấy danh sách học sinh theo lớp
router.get(
  '/api/transfers/members',
  authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  transferController.getMembersByClass
);

// Xem trước tác động chuyển lớp
router.post(
  '/api/transfers/preview',
  authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  transferController.preview
);

// Thực thi chuyển lớp (Saga flow + Audit Log)
router.post(
  '/api/transfers',
  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  auditLog('TRANSFER_CLASS'),
  transferController.executeTransfer
);

// Hoàn tác đợt chuyển lớp (Restore + Audit Log)
router.post(
  '/api/transfers/:batchId/restore',
  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  auditLog('RESTORE_CLASS_TRANSFER'),
  transferController.restore
);

module.exports = router;
