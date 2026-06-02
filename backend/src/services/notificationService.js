const notificationRepository = require('../repositories/notificationRepository');
const eventRepository = require('../repositories/eventRepository');
const userRepository = require('../repositories/userRepository');
const PERMISSOES = require('../config/permissions');

const criarErro = (mensagem, statusCode = 400) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const normalizeTone = (value) => {
    const tone = String(value || 'info').trim().toLowerCase();
    if (['success', 'warning', 'danger', 'info'].includes(tone)) {
        return tone;
    }
    return 'info';
};

const ensureStorage = async () => {
    await notificationRepository.ensureTable();
};

const buildEventNotificationPayload = (eventItem) => {
    const dataEvento = new Intl.DateTimeFormat('pt-PT').format(new Date(eventItem.DataEvento));

    return {
        title: 'Novo evento publicado',
        message: `${eventItem.Titulo} para ${dataEvento}.`,
        tone: 'info',
        entityType: 'Evento',
        entityId: eventItem.IdEvento
    };
};

const createDueEventNotificationsForUser = async (utilizador) => {
    if (
        !utilizador?.IdUtilizador
        || ![PERMISSOES.PROFESSOR, PERMISSOES.ENCARREGADO].includes(utilizador.Permissoes)
    ) {
        return [];
    }

    await ensureStorage();

    const [publishedEvents, notifiedEventIds] = await Promise.all([
        eventRepository.findPublished(new Date()),
        notificationRepository.findEntityIdsByUserAndType(utilizador.IdUtilizador, 'Evento')
    ]);

    const notifiedIds = new Set(notifiedEventIds.map(id => String(id).toLowerCase()));
    const eventsToNotify = (publishedEvents || []).filter((eventItem) => (
        eventItem?.IdEvento && !notifiedIds.has(String(eventItem.IdEvento).toLowerCase())
    ));

    if (eventsToNotify.length === 0) {
        return [];
    }

    const created = [];
    for (const eventItem of eventsToNotify) {
        const notifications = await createForUsers([utilizador.IdUtilizador], buildEventNotificationPayload(eventItem));
        created.push(...notifications);
    }

    return created;
};

const filterEventNotificationsByPublication = async (notifications = []) => {
    const eventNotifications = notifications.filter((notification) => (
        notification.EntidadeTipo === 'Evento' && notification.EntidadeId
    ));

    if (eventNotifications.length === 0) {
        return notifications;
    }

    const publishedEvents = await eventRepository.findPublished(new Date());
    const publishedEventIds = new Set((publishedEvents || []).map((eventItem) => String(eventItem.IdEvento).toLowerCase()));

    return notifications.filter((notification) => (
        notification.EntidadeTipo !== 'Evento'
        || !notification.EntidadeId
        || publishedEventIds.has(String(notification.EntidadeId).toLowerCase())
    ));
};

const listForUser = async (idUtilizador, options = {}, utilizador = null) => {
    if (!idUtilizador) {
        throw criarErro('IdUtilizador e obrigatorio.', 400);
    }

    await ensureStorage();
    await createDueEventNotificationsForUser(utilizador);
    const notifications = await notificationRepository.findByUser(idUtilizador, options);
    return await filterEventNotificationsByPublication(notifications);
};

const createForUsers = async (userIds, { title, message = '', tone = 'info', entityType = null, entityId = null } = {}) => {
    const recipients = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean))];
    const trimmedTitle = String(title || '').trim();

    if (recipients.length === 0 || !trimmedTitle) {
        return [];
    }

    await ensureStorage();
    return await notificationRepository.createMany(recipients.map((idUtilizador) => ({
        IdUtilizador: idUtilizador,
        Titulo: trimmedTitle,
        Mensagem: String(message || '').trim(),
        Tipo: normalizeTone(tone),
        EntidadeTipo: entityType,
        EntidadeId: entityId || null
    })));
};

const createEventPublishedForUsers = async (userIds, eventItem) => (
    await createForUsers(userIds, buildEventNotificationPayload(eventItem))
);

const createForUser = async (idUtilizador, payload) => (
    await createForUsers([idUtilizador], payload)
);

const markRead = async (idNotificacao, idUtilizador) => {
    if (!idNotificacao || !idUtilizador) {
        throw criarErro('IdNotificacao e IdUtilizador sao obrigatorios.', 400);
    }

    await ensureStorage();
    const notification = await notificationRepository.markAsRead(idNotificacao, idUtilizador);
    if (!notification) {
        throw criarErro('Notificacao nao encontrada.', 404);
    }
    return notification;
};

const markAllRead = async (idUtilizador) => {
    if (!idUtilizador) {
        throw criarErro('IdUtilizador e obrigatorio.', 400);
    }

    await ensureStorage();
    const total = await notificationRepository.markAllAsRead(idUtilizador);
    return { total };
};

const removeOne = async (idNotificacao, idUtilizador) => {
    if (!idNotificacao || !idUtilizador) {
        throw criarErro('IdNotificacao e IdUtilizador sao obrigatorios.', 400);
    }

    await ensureStorage();
    const total = await notificationRepository.removeOne(idNotificacao, idUtilizador);
    if (total === 0) {
        throw criarErro('Notificacao nao encontrada.', 404);
    }
    return { total };
};

const clearAll = async (idUtilizador) => {
    if (!idUtilizador) {
        throw criarErro('IdUtilizador e obrigatorio.', 400);
    }

    await ensureStorage();
    const total = await notificationRepository.removeAllByUser(idUtilizador);
    return { total };
};

const getGuardianIdsByStudentIds = async (studentIds = []) => {
    const relationRows = await userRepository.findGuardianIdsByStudentIds(studentIds);
    return [...new Set(relationRows.map((item) => item.IdEncarregado).filter(Boolean))];
};

module.exports = {
    ensureStorage,
    listForUser,
    createForUser,
    createForUsers,
    createEventPublishedForUsers,
    createDueEventNotificationsForUser,
    markRead,
    markAllRead,
    removeOne,
    clearAll,
    getGuardianIdsByStudentIds
};
