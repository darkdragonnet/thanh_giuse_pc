const express = require('express');
const multer = require('multer');
const path = require('path');
const personController = require('../controllers/personController');

const router = express.Router();

const upload = multer({
  dest: path.join(process.cwd(), 'uploads/temp/'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// [READ]
router.get('/', personController.listPersons);
router.get('/checkin', personController.renderCheckin);

// [CREATE]
router.get('/register', personController.renderRegisterForm);
router.post('/register', upload.single('face_image'), personController.handleRegister);

// [UPDATE]
router.get('/edit/:personID', personController.renderEditForm);
router.put('/update/:personID', upload.single('face_image'), personController.handleUpdate);

// [DELETE]
router.delete('/delete/:personID', personController.handleDelete);

module.exports = router;
