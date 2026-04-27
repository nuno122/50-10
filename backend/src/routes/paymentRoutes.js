// paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), paymentController.getPagamentos);
router.get('/atraso', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), paymentController.getAtrasados);
router.patch('/:id/pagar', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), paymentController.pagar);

module.exports = router;