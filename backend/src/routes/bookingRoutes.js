const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verificarToken } = require('../authMiddleware');

router.get('/', verificarToken, bookingController.getMarcacoes);
router.post('/', verificarToken, bookingController.criarMarcacao);

module.exports = router;