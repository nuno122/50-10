const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verificarToken } = require('../authMiddleware');

router.post('/login', userController.login);
router.post('/registar', userController.criarUtilizador);
router.get('/', verificarToken, userController.getUtilizadores);

module.exports = router;