const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verificarToken } = require('../authMiddleware');

router.get('/', verificarToken, bookingController.getMarcacoes);
router.post('/', verificarToken, bookingController.criarMarcacao);

// NOVA: PATCH /:id/cancelar (protegida)
router.patch('/:id/cancelar', verificarToken, bookingController.cancelarMarcacao);

module.exports = router;
