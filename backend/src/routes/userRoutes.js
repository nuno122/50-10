const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.post('/login', userController.login);
router.post('/registar', userController.criarUtilizador);
router.get('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), userController.getUtilizadores);

module.exports = router;