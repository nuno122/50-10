const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/', verificarToken, inventoryController.getInventario);
router.post('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), inventoryController.criarArtigo);
router.put('/:id', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), inventoryController.editarArtigo);
router.patch('/:id/estado', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), inventoryController.setEstadoDisponivel);
router.delete('/:id', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), inventoryController.removerArtigo);

module.exports = router;