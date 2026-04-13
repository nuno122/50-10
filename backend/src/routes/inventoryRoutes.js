const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

router.get('/', inventoryController.getInventario);
router.post('/', inventoryController.criarArtigo);

router.put('/:id', inventoryController.editarArtigo);
router.delete('/:id', inventoryController.removerArtigo);

module.exports = router;