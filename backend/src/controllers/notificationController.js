const notificationService = require('../services/notificationService');
const { handleControllerError } = require('./controllerError');

const getNotifications = async (req, res) => {
    try {
        const idUtilizador = req.utilizador?.IdUtilizador;
        const apenasNaoLidas = String(req.query?.apenasNaoLidas || '').toLowerCase() === 'true';
        const limit = req.query?.limit;
        const notifications = await notificationService.listForUser(
            idUtilizador,
            { apenasNaoLidas, limit },
            req.utilizador
        );
        res.json(notifications);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao carregar notificacoes.', 'notificationController.getNotifications');
    }
};

const markAsRead = async (req, res) => {
    try {
        const notification = await notificationService.markRead(req.params.id, req.utilizador?.IdUtilizador);
        res.json(notification);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao marcar a notificacao como lida.', 'notificationController.markAsRead');
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const result = await notificationService.markAllRead(req.utilizador?.IdUtilizador);
        res.json(result);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao marcar notificacoes como lidas.', 'notificationController.markAllAsRead');
    }
};

const removeNotification = async (req, res) => {
    try {
        const result = await notificationService.removeOne(req.params.id, req.utilizador?.IdUtilizador);
        res.json(result);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao remover a notificacao.', 'notificationController.removeNotification');
    }
};

const clearNotifications = async (req, res) => {
    try {
        const result = await notificationService.clearAll(req.utilizador?.IdUtilizador);
        res.json(result);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao limpar notificacoes.', 'notificationController.clearNotifications');
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications
};
