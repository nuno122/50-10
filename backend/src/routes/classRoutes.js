const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/', verificarToken, classController.getAulas);
router.post('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), classController.criarAula);
router.patch('/:id/confirmar-professor', verificarToken, verificarPermissao(PERMISSOES.PROFESSOR, PERMISSOES.DIRECAO), classController.confirmarAula);
router.patch('/:id/validar-direcao', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), classController.validarAula);

module.exports = router;
