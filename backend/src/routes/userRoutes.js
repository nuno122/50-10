const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.post('/login', userController.login);
router.post('/registar', userController.criarUtilizador);
router.get('/', verificarToken, userController.getUtilizadores);
router.post('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), userController.criarUtilizador);
router.put('/:id', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), userController.atualizarUtilizador);
router.patch('/:id/estado', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), userController.atualizarEstadoUtilizador);

module.exports = router;
