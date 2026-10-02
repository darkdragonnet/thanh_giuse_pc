const { pool } = require('../config/database');
const transferService = require('../services/transferService');

/**
 * Controller Điều phối Nghiệp vụ Chuyển Lớp & Hoàn Tác (transferController)
 */

/**
 * [GET] Render trang Quản lý Chuyển Lớp
 */
exports.renderTransferPage = async (req, res) => {
  try {
    const [classesRes, batchRes] = await Promise.all([
      pool.query('SELECT name, department_id FROM classes ORDER BY name ASC'),
      pool.query(`
        SELECT batch_id, from_class, to_class, 
               COUNT(*) AS total_count,
               COUNT(*) FILTER (WHERE sync_status = 'SYNCED') AS synced_count,
               COUNT(*) FILTER (WHERE sync_status = 'FAILED') AS failed_count,
               MAX(created_at) AS created_at,
               MAX(restored_at) AS restored_at
        FROM transfer_snapshots
        GROUP BY batch_id, from_class, to_class
        ORDER BY MAX(created_at) DESC
        LIMIT 30;
      `)
    ]);

    res.render('transfer', {
      title: 'Quản Lý Chuyển Lớp & Điểm Phục Hồi (Saga)',
      classes: classesRes.rows || [],
      recentBatches: batchRes.rows || []
    });
  } catch (err) {
    console.error('[TransferController renderTransferPage Error]', err.message);
    req.flash('error', `Lỗi tải trang chuyển lớp: ${err.message}`);
    res.redirect('/links');
  }
};

/**
 * [GET] API Lấy danh sách thành viên theo lớp
 * Endpoint: /api/transfers/members?className=...
 */
exports.getMembersByClass = async (req, res) => {
  try {
    const { className } = req.query;
    if (!className || !className.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu tên lớp cần truy vấn' });
    }

    const query = `
      SELECT id, name, alias_id, person_id, class_name, department_id, title, face_url, sync_status 
      FROM persons 
      WHERE class_name = $1 
      ORDER BY id ASC;
    `;
    const result = await pool.query(query, [className.trim()]);

    res.json({
      success: true,
      className: className.trim(),
      total: result.rows.length,
      members: result.rows
    });
  } catch (err) {
    console.error('[TransferController getMembersByClass Error]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [POST] API Xem trước tác động chuyển lớp
 * Endpoint: /api/transfers/preview
 */
exports.preview = async (req, res) => {
  try {
    const { fromClass, toClass, personIds } = req.body;

    if (!fromClass || !toClass) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn lớp nguồn và lớp đích' });
    }
    if (fromClass.trim().toUpperCase() === toClass.trim().toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Lớp đích không được trùng với lớp nguồn' });
    }

    const previewData = await transferService.previewTransfer(
      fromClass.trim(),
      toClass.trim(),
      Array.isArray(personIds) ? personIds : []
    );

    res.json({
      success: true,
      data: previewData
    });
  } catch (err) {
    console.error('[TransferController preview Error]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [POST] API Thực thi chuyển lớp (Saga Flow)
 * Endpoint: /api/transfers
 */
exports.executeTransfer = async (req, res) => {
  try {
    const { fromClass, toClass, personIds } = req.body;
    const actor = req.user || req.session?.user || {
      id: 'ANONYMOUS',
      username: 'anonymous',
      role: 'ADMIN'
    };

    if (!fromClass || !toClass) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn lớp nguồn và lớp đích' });
    }
    if (fromClass.trim().toUpperCase() === toClass.trim().toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Lớp đích không được trùng với lớp nguồn' });
    }

    const transferResult = await transferService.transferMembers(
      fromClass.trim(),
      toClass.trim(),
      Array.isArray(personIds) ? personIds : [],
      actor
    );

    res.json({
      success: true,
      message: `Đã hoàn tất chuyển lớp: ${transferResult.successCount}/${transferResult.total} thành công.`,
      result: transferResult
    });
  } catch (err) {
    console.error('[TransferController executeTransfer Error]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [POST] API Hoàn tác đợt chuyển lớp
 * Endpoint: /api/transfers/:batchId/restore
 */
exports.restore = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId || !batchId.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu mã đợt chuyển lớp (batchId)' });
    }

    const restoreResult = await transferService.restoreTransfer(batchId.trim());

    res.json({
      success: true,
      message: `Đã hoàn tác ${restoreResult.restoredCount}/${restoreResult.total} thành viên về lớp cũ.`,
      result: restoreResult
    });
  } catch (err) {
    console.error('[TransferController restore Error]', err.message);
    const status = (err.code === 'RESTORE_NOT_ALLOWED' || err.message.includes('RESTORE_NOT_ALLOWED')) ? 400 : 500;
    res.status(status).json({ success: false, error: err.code || 'RESTORE_ERROR', message: err.message });
  }
};
