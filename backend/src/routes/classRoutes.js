const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { verificarToken } = require('../authMiddleware');

router.get('/', verificarToken, classController.getAulas);
router.post('/', verificarToken, classController.criarAula);
router.patch('/:id/confirmar-professor', verificarToken, classController.confirmarAula);
router.patch('/:id/validar-direcao', verificarToken, classController.validarAula);

module.exports = router;
