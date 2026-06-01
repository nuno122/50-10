const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verificarToken } = require('../authMiddleware');

router.get('/', verificarToken, notificationController.getNotifications);
router.patch('/ler-todas', verificarToken, notificationController.markAllAsRead);
router.patch('/:id/lida', verificarToken, notificationController.markAsRead);
router.delete('/limpar', verificarToken, notificationController.clearNotifications);
router.delete('/:id', verificarToken, notificationController.removeNotification);

module.exports = router;
