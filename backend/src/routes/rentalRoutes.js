const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');
const { verificarToken } = require('../authMiddleware');

router.get('/', verificarToken, rentalController.getAlugueres);
router.post('/', verificarToken, rentalController.criarAluguer);
router.post('/:id/extensao', verificarToken, rentalController.solicitarExtensao);
router.patch('/pedidos-extensao/:id/avaliar', verificarToken, rentalController.avaliarPedidoExtensao);
router.patch('/:id/devolucao', verificarToken, rentalController.registarDevolucao);

module.exports = router;
