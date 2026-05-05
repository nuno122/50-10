const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const inventoryImageUpload = require('../middleware/inventoryImageUpload');

router.get('/', inventoryController.getInventario);
router.post('/', inventoryImageUpload, inventoryController.criarArtigo);
router.put('/:id', inventoryImageUpload, inventoryController.editarArtigo);
router.delete('/:id', inventoryController.removerArtigo);

module.exports = router;
