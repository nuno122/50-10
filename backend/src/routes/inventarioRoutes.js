const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');

router.get('/', inventarioController.getInventario);
router.post('/', inventarioController.criarArtigo);

router.put('/:id', inventarioController.editarArtigo);
router.delete('/:id', inventarioController.removerArtigo);

module.exports = router;