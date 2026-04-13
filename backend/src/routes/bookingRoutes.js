const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

router.get('/', bookingController.getMarcacoes);
router.post('/', bookingController.criarMarcacao);

module.exports = router;