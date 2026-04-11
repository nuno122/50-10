const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');

router.get('/estudios', masterController.getEstudios);
router.get('/estilos', masterController.getEstilos);
router.get('/geografia', masterController.getGeografia);

module.exports = router;