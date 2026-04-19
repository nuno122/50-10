const express = require('express');
const disponibilidadeController = require('../controllers/disponibilidadeController');
const { verificarToken } = require('../authMiddleware');
const router = express.Router();

router.post('/', verificarToken, disponibilidadeController.criarDisponibilidade);
router.get('/minhas', verificarToken, disponibilidadeController.listarMinhasDisponibilidades);

module.exports = router;

