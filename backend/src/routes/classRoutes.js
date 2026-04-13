const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');

router.get('/', classController.getAulas);
router.post('/', classController.criarAula);

module.exports = router;