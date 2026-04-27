const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/estudios', verificarToken, masterController.getEstudios);
router.get('/estilos', verificarToken, masterController.getEstilos);
router.get('/geografia', masterController.getGeografia); // sem auth — usado no registo
router.get('/exportar/mensal', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.exportarMensal);
router.get('/exportar', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.exportarFinanceiro); // ?DataInicio=&DataFim=

module.exports = router;