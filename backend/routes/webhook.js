const express = require('express');
const router = express.Router();
const { verifyWebhook, handleWebhook } = require('../controllers/webhookController');

router.get('/:businessId', verifyWebhook);
router.post('/:businessId', handleWebhook);

module.exports = router;
