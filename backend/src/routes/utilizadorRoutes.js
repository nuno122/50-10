const express = require('express');
const router = express.Router();
const utilizadorController = require('../controllers/utilizadorController');

router.get('/', utilizadorController.getUtilizadores);
router.post('/', utilizadorController.criarUtilizador);
router.post('/login', utilizadorController.login);

module.exports = router;