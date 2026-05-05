const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { connect, getQR, getStatus, disconnect, sendTest, broadcast } = require('../controllers/whatsappController');

router.use(protect);
router.post('/connect', connect);
router.get('/qr', getQR);
router.get('/status', getStatus);
router.post('/disconnect', disconnect);
router.post('/test', sendTest);
router.post('/broadcast', broadcast);

module.exports = router;
