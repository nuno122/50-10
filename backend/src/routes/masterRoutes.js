const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get('/estudios', masterController.getEstudios);
router.get('/estilos', masterController.getEstilos);
router.get('/professores', masterController.getProfessores);
router.get('/geografia', masterController.getGeografia);
router.post('/estudios', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.createEstudio);
router.patch('/estudios/:id', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.updateEstudio);
router.patch('/estudios/:id/estado', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.updateEstudioStatus);
router.delete('/estudios/:id', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.deleteEstudio);
router.post('/estilos', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.createEstilo);
router.patch('/estilos/:id', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.updateEstilo);
router.patch('/estilos/:id/estado', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.updateEstiloStatus);
router.delete('/estilos/:id', verificarToken, verificarPermissao(PERMISSOES.DIRECAO), masterController.deleteEstilo);

module.exports = router;
