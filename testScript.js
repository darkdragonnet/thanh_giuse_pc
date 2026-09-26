require('dotenv').config();
const fs = require('fs');
const path = require('path');
const hanetService = require('./src/services/hanetService');

(async () => {
  try {
    const filename = 'test_sample.jpg';
    const filePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, 'fake-data');
    }
    const publicUrl = `https://thanh_giuse.gaudetedomino.io.vn/uploads/${filename}`;
    console.log('Testing URL:', publicUrl);
    
    const res = await hanetService.registerPerson({
      name: 'Test Real JPG',
      aliasID: 'TEST_JPG_01',
      title: 'Tester',
      publicImageUrl: publicUrl
    });
    console.log('Success:', res);
  } catch (err) {
    console.log('HANET Error Data:', err.response?.data || err.message);
  }
})();

