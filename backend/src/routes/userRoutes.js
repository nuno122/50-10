const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getUtilizadores);
router.post('/', userController.criarUtilizador);
router.post('/login', userController.login);

module.exports = router;