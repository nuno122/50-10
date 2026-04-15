const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verificarToken } = require('../authMiddleware');

router.post('/login', userController.login);
router.get('/', verificarToken, userController.getUtilizadores);
router.post('/', verificarToken, userController.criarUtilizador);

module.exports = router;