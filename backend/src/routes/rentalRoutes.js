const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), rentalController.getAlugueres);
router.post('/', verificarToken, rentalController.criarAluguer);
router.get('/:id/custo', verificarToken, rentalController.calcularCusto);
router.post('/:id/extensao', verificarToken, rentalController.solicitarExtensao);
router.post('/:id/devolucao', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), rentalController.registrarDevolucao);
router.patch('/pedidos-extensao/:id/avaliar', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), rentalController.avaliarPedidoExtensao);

module.exports = router;