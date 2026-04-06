const express = require('express');
const router = express.Router();
const marcacaoController = require('../controllers/marcacaoController');

router.get('/', marcacaoController.getMarcacoes);
router.post('/', marcacaoController.criarMarcacao);

module.exports = router;