const express = require('express');
const router = express.Router();
const aulaController = require('../controllers/aulaController');

router.get('/', aulaController.getAulas);
router.post('/', aulaController.criarAula);

module.exports = router;