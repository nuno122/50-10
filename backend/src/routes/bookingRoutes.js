const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), bookingController.getMarcacoes);
router.get('/minhas', verificarToken, verificarPermissao(PERMISSOES.ALUNO), bookingController.getMarcacoesDoAluno);
router.get('/aluno/:idAluno', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), bookingController.getMarcacoesDoAluno);
router.get('/:idAula/preco', verificarToken, bookingController.getPreco);
router.get('/:idMarcacao/prazo-valido', verificarToken, bookingController.isPrazoValido);
router.post('/', verificarToken, verificarPermissao(PERMISSOES.ALUNO), bookingController.criarMarcacao);
router.patch('/:idMarcacao/cancelar', verificarToken, verificarPermissao(PERMISSOES.ALUNO), bookingController.cancelarMarcacao);

module.exports = router;