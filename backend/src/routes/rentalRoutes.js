const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');

router.get('/', rentalController.getAlugueres);
router.post('/', rentalController.criarAluguer);

module.exports = router;
