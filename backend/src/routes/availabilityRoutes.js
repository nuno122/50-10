const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), availabilityController.getDisponibilidades);
router.get('/minhas', verificarToken, verificarPermissao(PERMISSOES.PROFESSOR), availabilityController.getMinhasDisponibilidades);
router.put('/minhas', verificarToken, verificarPermissao(PERMISSOES.PROFESSOR), availabilityController.guardarMinhasDisponibilidades);

module.exports = router;
