const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { verificarToken } = require('../authMiddleware');

router.get('/', verificarToken, classController.getAulas);
router.post('/', verificarToken, classController.criarAula);

module.exports = router;