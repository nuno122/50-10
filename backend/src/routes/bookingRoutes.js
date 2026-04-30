const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), bookingController.getMarcacoes);

router.get('/minhas', verificarToken, verificarPermissao(PERMISSOES.ALUNO), bookingController.getMarcacoesDoAluno);
router.get('/aluno/:idAluno', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), bookingController.getMarcacoesDoAluno);

router.get(
    '/encarregado/alunos',
    verificarToken,
    verificarPermissao(PERMISSOES.ENCARREGADO),
    bookingController.getAlunosDoEncarregado
);

router.get(
    '/encarregado/minhas',
    verificarToken,
    verificarPermissao(PERMISSOES.ENCARREGADO),
    bookingController.getMarcacoesDoEncarregado
);

router.post('/', verificarToken, verificarPermissao(PERMISSOES.ALUNO), bookingController.criarMarcacao);

router.post(
    '/encarregado',
    verificarToken,
    verificarPermissao(PERMISSOES.ENCARREGADO),
    bookingController.criarMarcacaoEncarregado
);

router.patch('/:idMarcacao/cancelar', verificarToken, verificarPermissao(PERMISSOES.ALUNO), bookingController.cancelarMarcacao);

router.patch(
    '/encarregado/:idMarcacao/cancelar',
    verificarToken,
    verificarPermissao(PERMISSOES.ENCARREGADO),
    bookingController.cancelarMarcacaoEncarregado
);

router.patch('/:id/cancelar', verificarToken, bookingController.cancelarMarcacao);

module.exports = router;
