const express = require('express');
const router = express.Router();
const aluguerController = require('../controllers/aluguerController');

router.get('/', aluguerController.getAlugueres);
router.post('/', aluguerController.criarAluguer);

module.exports = router;
