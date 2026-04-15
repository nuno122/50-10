const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');
const { verificarToken } = require('../authMiddleware');

router.get('/', verificarToken, rentalController.getAlugueres);
router.post('/', verificarToken, rentalController.criarAluguer);

module.exports = router;
