const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

// Direção vê todas
router.get('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), bookingController.getMarcacoes);

// Aluno vê as suas
router.get('/minhas', verificarToken, verificarPermissao(PERMISSOES.ALUNO), bookingController.getMarcacoesDoAluno);

// Direção vê as de um aluno específico
router.get('/aluno/:idAluno', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), bookingController.getMarcacoesDoAluno);

// Criar marcação — só alunos
router.post('/', verificarToken, verificarPermissao(PERMISSOES.ALUNO), bookingController.criarMarcacao);

// Cancelar — aluno cancela as suas (a validação de ownership está no service)
router.patch('/:idMarcacao/cancelar', verificarToken, verificarPermissao(PERMISSOES.ALUNO), bookingController.cancelarMarcacao);

// NOVA: PATCH /:id/cancelar (protegida)
router.patch('/:id/cancelar', verificarToken, bookingController.cancelarMarcacao);

module.exports = router;
