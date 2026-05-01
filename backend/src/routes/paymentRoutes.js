const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/', verificarToken, paymentController.getPagamentos);
router.get('/encarregado', verificarToken, verificarPermissao(PERMISSOES.ENCARREGADO), paymentController.getPagamentosEncarregado);
router.patch('/:id/pagar', verificarToken, verificarPermissao(PERMISSOES.ENCARREGADO, PERMISSOES.DIRECAO), paymentController.pagar);

module.exports = router;
