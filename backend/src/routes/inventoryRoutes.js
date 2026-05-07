const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { verificarToken } = require('../authMiddleware');
const inventoryImageUpload = require('../middleware/inventoryImageUpload');

router.get('/', verificarToken, inventoryController.getInventario);
router.post('/', verificarToken, inventoryImageUpload, inventoryController.criarArtigo);
router.put('/:id', verificarToken, inventoryImageUpload, inventoryController.editarArtigo);
router.delete('/:id', verificarToken, inventoryController.removerArtigo);

module.exports = router;
