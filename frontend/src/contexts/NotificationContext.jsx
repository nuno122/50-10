import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
    getAulas,
    getAlunosEncarregado,
    getEventos,
    getInventario,
    getMarcacoesEncarregado,
    getNotificacoes,
    getPagamentosEncarregado,
    getPedidosCancelamentoPendentes,
    getPedidosAulaPrivada,
    getPedidosAulaPrivadaEncarregado,
    getPedidosAulaPrivadaProfessor,
    limparNotificacoes,
    marcarNotificacaoComoLida,
    marcarTodasNotificacoesComoLidas,
    removerNotificacao
} from '../services/api';
import { PERMISSOES } from '../utils/permissions';

const NotificationContext = createContext();

const POLL_INTERVAL_MS = 15000;
const MAX_POPUP_NOTIFICATIONS = 4;
const MAX_INBOX_NOTIFICATIONS = 40;
const SUPPRESSED_NOTIFICATION_TITLES = new Set([
    'Artigo publicado',
    'Artigo atualizado',
    'Artigo de aluguer criado',
    'Artigo de aluguer atualizado'
]);

const getUserId = (user) => user?.IdUtilizador || user?.Id || null;

const pad = (value) => String(value).padStart(2, '0');

const buildSnapshotStorageKey = (user) => (
    getUserId(user) ? `entartes-alert-snapshot-${getUserId(user)}-${user.Permissoes}` : ''
);

const buildInboxStorageKey = (user) => (
    getUserId(user) ? `entartes-notification-feed-${getUserId(user)}-${user.Permissoes}` : ''
);

const formatDateTime = (dateValue, timeValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'data por definir';

    const text = String(timeValue || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    const time = match ? `${match[1]}:${match[2]}` : `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    return `${new Intl.DateTimeFormat('pt-PT').format(date)} as ${time}`;
};

const formatDateOnly = (dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'data por definir';
    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const normalizePaymentStatus = (value) => String(value || '').trim().toLowerCase();

const buildNotificationStorage = () => (
    typeof window !== 'undefined' ? window.localStorage : null
);

const mapServerNotification = (notification) => ({
    id: notification.IdNotificacao,
    title: notification.Titulo,
    message: notification.Mensagem || '',
    tone: notification.Tipo || 'info',
    read: Boolean(notification.Lida),
    createdAt: notification.DataCriacao || new Date().toISOString(),
    persisted: true
});

const mergeNotifications = (current, incoming) => {
    const localOnly = (current || []).filter((item) => !item.persisted);
    const merged = [...(incoming || []), ...localOnly];

    return merged
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, MAX_INBOX_NOTIFICATIONS);
};

const isPendingPayment = (payment) => {
    const status = normalizePaymentStatus(payment?.EstadoPagamento);
    return Boolean(payment)
        && payment?.Marcacao?.EstaAtivo !== false
        && status !== 'pago'
        && status !== 'cancelado';
};

const countActiveBookings = (lesson) => (
    Array.isArray(lesson?.Marcacao)
        ? lesson.Marcacao.filter((booking) => booking?.EstaAtivo !== false).length
        : 0
);

const hasAvailableSeats = (lesson) => (
    countActiveBookings(lesson) < Number(lesson?.CapacidadeMaxima || 0)
);

const countInventoryStock = (item) => (
    Array.isArray(item?.TamanhoArtigo)
        ? item.TamanhoArtigo.reduce((sum, entry) => sum + Number(entry?.Quantidade || 0), 0)
        : 0
);

const isMarketplaceItemAvailable = (item) => (
    Boolean(item)
    && item.EstadoArtigo !== false
    && countInventoryStock(item) > 0
);

const isFutureRegularLesson = (lesson) => {
    if (!lesson || lesson.EstaAtivo === false) return false;
    if ((lesson.TipoAula || 'Regular') !== 'Regular') return false;

    const lessonDate = new Date(lesson.Data);
    if (Number.isNaN(lessonDate.getTime())) return false;

    lessonDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return lessonDate >= today;
};

const isFutureBooking = (booking) => {
    const lesson = booking?.Aula;
    if (!booking || !lesson || lesson.EstaAtivo === false) return false;

    const lessonDate = new Date(lesson.Data);
    if (Number.isNaN(lessonDate.getTime())) return false;

    const timeText = String(lesson.HoraInicio || '');
    const match = timeText.match(/(\d{2}):(\d{2})/);
    if (match) {
        lessonDate.setHours(Number(match[1]), Number(match[2]), 0, 0);
    } else {
        lessonDate.setHours(0, 0, 0, 0);
    }

    return lessonDate >= new Date();
};

const normalizeLessonsForRole = (aulas, user) => {
    const futureLessons = (aulas || []).filter((lesson) => lesson.EstaAtivo !== false);

    if (user?.Permissoes === PERMISSOES.PROFESSOR) {
        return futureLessons.filter((lesson) => lesson.IdProfessor === getUserId(user));
    }

    return futureLessons;
};

const mapCoachingRequest = (request) => ({
    id: request.IdPedidoAulaPrivada,
    label: request.EstiloDanca?.Nome || 'Coaching',
    when: formatDateTime(request.DataPretendida, request.HoraPretendida),
    status: request.EstadoPedido || 'PendenteProfessor',
    student: request.Aluno?.Utilizador?.NomeCompleto || 'Aluno',
    teacher: request.ProfessorSolicitado?.Utilizador?.NomeCompleto
        || request.ProfessorConfirmado?.Utilizador?.NomeCompleto
        || 'Professor',
    observacaoProfessor: request.ObservacaoProfessor || '',
    observacaoDirecao: request.ObservacaoDirecao || ''
});

const mapPublishedEvent = (eventItem) => ({
    id: eventItem.IdEvento,
    title: eventItem.Titulo || 'Evento',
    type: eventItem.TipoEvento || 'Geral',
    when: formatDateOnly(eventItem.DataEvento)
});

const mapMarketplaceItem = (item) => ({
    id: item.IdArtigo,
    title: item.Nome || 'Artigo',
    email: item.Criador?.Email || '',
    stock: countInventoryStock(item)
});

const buildMarketplaceNotifications = (previousItems = [], nextItems = []) => {
    const previousIds = new Set(previousItems.map((item) => item.id));
    const newItems = nextItems.filter((item) => !previousIds.has(item.id));

    if (newItems.length === 0) {
        return [];
    }

    const firstItem = newItems[0];

    return [{
        title: newItems.length === 1 ? 'Novo artigo disponível para aluguer' : 'Novos artigos disponíveis para aluguer',
        message: newItems.length === 1
            ? `${firstItem.title}${firstItem.email ? ` publicado por ${firstItem.email}` : ''}.`
            : `${newItems.length} artigos ficaram disponíveis no marketplace.`,
        tone: 'info'
    }];
};

const buildDirectorSnapshot = async () => {
    const [aulas, requests, inventory, cancellationRequests] = await Promise.all([
        getAulas(),
        getPedidosAulaPrivada(),
        getInventario({ disponivelParaAluguer: true }),
        getPedidosCancelamentoPendentes()
    ]);

    const activeLessons = (aulas || []).filter((lesson) => lesson.EstaAtivo !== false);
    const coachingRequests = (requests || [])
        .filter((request) => request.EstadoPedido === 'PendenteDirecao')
        .map(mapCoachingRequest);

    return {
        role: 'director',
        lessons: activeLessons.map((lesson) => ({
            id: lesson.IdAula,
            label: lesson.EstiloDanca?.Nome || 'Aula',
            when: formatDateTime(lesson.Data, lesson.HoraInicio),
            validated: Boolean(lesson.ValidacaoDirecao),
            bookingCount: countActiveBookings(lesson)
        })),
        pendingValidationCount: activeLessons.filter((lesson) => !lesson.ValidacaoDirecao).length,
        coachingRequests,
        pendingCancellationCount: (cancellationRequests || []).length,
        marketplaceItems: (inventory || [])
            .filter(isMarketplaceItemAvailable)
            .map(mapMarketplaceItem)
    };
};

const buildTeacherSnapshot = async (user) => {
    const [aulas, requests, events, inventory] = await Promise.all([
        getAulas(),
        getPedidosAulaPrivadaProfessor(),
        getEventos(),
        getInventario({ disponivelParaAluguer: true })
    ]);

    const ownLessons = normalizeLessonsForRole(aulas, user);
    const coachingRequests = (requests || [])
        .filter((request) => request.EstadoPedido === 'PendenteProfessor')
        .map(mapCoachingRequest);

    return {
        role: 'teacher',
        lessons: ownLessons.map((lesson) => ({
            id: lesson.IdAula,
            label: lesson.EstiloDanca?.Nome || 'Aula',
            when: formatDateTime(lesson.Data, lesson.HoraInicio),
            active: lesson.EstaAtivo !== false,
            validated: Boolean(lesson.ValidacaoDirecao),
            bookingCount: countActiveBookings(lesson),
            lessonType: lesson.TipoAula || 'Regular'
        })),
        events: (events || []).map(mapPublishedEvent),
        coachingRequests,
        marketplaceItems: (inventory || [])
            .filter(isMarketplaceItemAvailable)
            .map(mapMarketplaceItem)
    };
};

const buildGuardianSnapshot = async () => {
    const [aulas, pagamentos, requests, events, inventory, students] = await Promise.all([
        getAulas(),
        getPagamentosEncarregado(),
        getPedidosAulaPrivadaEncarregado(),
        getEventos(),
        getInventario({ disponivelParaAluguer: true }),
        getAlunosEncarregado()
    ]);

    const bookingGroups = await Promise.all(
        (students || []).map(async (student) => ({
            student,
            bookings: await getMarcacoesEncarregado(student.IdAluno)
        }))
    );

    const availableLessons = (aulas || [])
        .filter((lesson) => isFutureRegularLesson(lesson))
        .filter(hasAvailableSeats);

    return {
        role: 'guardian',
        availableLessons: availableLessons.map((lesson) => ({
            id: lesson.IdAula,
            label: lesson.EstiloDanca?.Nome || 'Aula',
            when: formatDateTime(lesson.Data, lesson.HoraInicio)
        })),
        pendingPaymentIds: (pagamentos || [])
            .filter(isPendingPayment)
            .map((payment) => payment.IdPagamento),
        bookings: bookingGroups.flatMap(({ student, bookings }) => (
            (bookings || [])
                .filter(isFutureBooking)
                .map((booking) => ({
                    id: booking.IdMarcacao,
                    lessonId: booking.IdAula,
                    label: booking.Aula?.EstiloDanca?.Nome || 'Aula',
                    lessonType: booking.Aula?.TipoAula || 'Regular',
                    when: formatDateTime(booking.Aula?.Data, booking.Aula?.HoraInicio),
                    student: student?.Nome || booking.Aluno?.Utilizador?.NomeCompleto || 'Educando',
                    active: booking.EstaAtivo !== false,
                    cancellationStatus: booking.EstadoCancelamento || 'SemPedido',
                    cancellationNote: booking.ObservacaoDirecaoCancelamento || booking.MotivoCancelamento || ''
                }))
        )),
        coachingRequests: (requests || []).map(mapCoachingRequest),
        events: (events || []).map(mapPublishedEvent),
        marketplaceItems: (inventory || [])
            .filter(isMarketplaceItemAvailable)
            .map(mapMarketplaceItem)
    };
};

const buildSnapshot = async (user) => {
    if (!user?.Permissoes) return null;

    if (user.Permissoes === PERMISSOES.DIRECAO) {
        return buildDirectorSnapshot();
    }

    if (user.Permissoes === PERMISSOES.PROFESSOR) {
        return buildTeacherSnapshot(user);
    }

    if (user.Permissoes === PERMISSOES.ENCARREGADO) {
        return buildGuardianSnapshot();
    }

    return null;
};

const buildDirectorNotifications = (previousSnapshot, nextSnapshot) => {
    const notifications = [];
    const previousLessons = new Map((previousSnapshot.lessons || []).map((lesson) => [lesson.id, lesson]));
    const previousIds = new Set((previousSnapshot.lessons || []).map((lesson) => lesson.id));
    const newLessons = (nextSnapshot.lessons || []).filter((lesson) => !previousIds.has(lesson.id));

    if (newLessons.length > 0) {
        const firstLesson = newLessons[0];
        notifications.push({
            title: newLessons.length === 1 ? 'Nova aula criada' : 'Novas aulas criadas',
            message: newLessons.length === 1
                ? `${firstLesson.label} em ${firstLesson.when}.`
                : `${newLessons.length} novas aulas foram adicionadas ao horário.`,
            tone: 'info'
        });
    }

    (nextSnapshot.lessons || []).forEach((lesson) => {
        const previousLesson = previousLessons.get(lesson.id);
        if (!previousLesson) {
            return;
        }

        if ((lesson.bookingCount || 0) > (previousLesson.bookingCount || 0)) {
            const newBookings = lesson.bookingCount - previousLesson.bookingCount;
            notifications.push({
                title: newBookings === 1 ? 'Nova marcação em aula' : 'Novas marcações em aula',
                message: newBookings === 1
                    ? `${lesson.label} recebeu uma nova inscrição.`
                    : `${lesson.label} recebeu ${newBookings} novas inscrições.`,
                tone: 'info'
            });
        }

        if ((lesson.bookingCount || 0) < (previousLesson.bookingCount || 0)) {
            const cancelledBookings = previousLesson.bookingCount - lesson.bookingCount;
            const isCoaching = (lesson.lessonType || 'Regular') === 'Particular';
            notifications.push({
                title: cancelledBookings === 1 ? 'Inscrição cancelada' : 'Inscrições canceladas',
                message: cancelledBookings === 1
                    ? `${isCoaching ? 'O Coaching' : lesson.label} perdeu uma inscrição em ${lesson.when}.`
                    : `${isCoaching ? 'O Coaching' : lesson.label} perdeu ${cancelledBookings} inscrições em ${lesson.when}.`,
                tone: 'warning'
            });
        }
    });

    if ((nextSnapshot.pendingValidationCount || 0) > (previousSnapshot.pendingValidationCount || 0)) {
        notifications.push({
            title: 'Novas validações pendentes',
            message: 'A Direção tem novas aulas por validar.',
            tone: 'warning'
        });
    }

    if ((nextSnapshot.pendingCancellationCount || 0) > (previousSnapshot.pendingCancellationCount || 0)) {
        notifications.push({
            title: 'Novos cancelamentos pendentes',
            message: 'Existem novos pedidos de cancelamento para validar.',
            tone: 'warning'
        });
    }

    const previousRequestIds = new Set((previousSnapshot.coachingRequests || []).map((request) => request.id));
    const newCoachingRequests = (nextSnapshot.coachingRequests || []).filter((request) => !previousRequestIds.has(request.id));

    if (newCoachingRequests.length > 0) {
        const firstRequest = newCoachingRequests[0];
        notifications.push({
            title: newCoachingRequests.length === 1 ? 'Novo pedido de Coaching' : 'Novos pedidos de Coaching',
            message: newCoachingRequests.length === 1
                ? `${firstRequest.label} em ${firstRequest.when} aguarda decisão da Direção.`
                : `${newCoachingRequests.length} pedidos de Coaching aguardam decisão da Direção.`,
            tone: 'warning'
        });
    }

    notifications.push(...buildMarketplaceNotifications(previousSnapshot.marketplaceItems, nextSnapshot.marketplaceItems));

    return notifications;
};

const buildTeacherNotifications = (previousSnapshot, nextSnapshot) => {
    const notifications = [];
    const previousLessons = new Map((previousSnapshot.lessons || []).map((lesson) => [lesson.id, lesson]));
    const nextLessons = nextSnapshot.lessons || [];
    const nextLessonIds = new Set(nextLessons.map((lesson) => lesson.id));
    const previousEventIds = new Set((previousSnapshot.events || []).map((eventItem) => eventItem.id));
    const newEvents = (nextSnapshot.events || []).filter((eventItem) => !previousEventIds.has(eventItem.id));
    const cancelledLessons = (previousSnapshot.lessons || []).filter((lesson) => !nextLessonIds.has(lesson.id));

    const newLessons = nextLessons.filter((lesson) => !previousLessons.has(lesson.id));
    if (newLessons.length > 0) {
        const firstLesson = newLessons[0];
        notifications.push({
            title: newLessons.length === 1 ? 'Nova aula atribuída' : 'Novas aulas atribuídas',
            message: newLessons.length === 1
                ? `${firstLesson.label} em ${firstLesson.when}.`
                : `${newLessons.length} novas aulas foram associadas ao teu horário.`,
            tone: 'info'
        });
    }

    nextLessons.forEach((lesson) => {
        const previousLesson = previousLessons.get(lesson.id);
        if (!previousLesson) return;

        if ((lesson.bookingCount || 0) > (previousLesson.bookingCount || 0)) {
            const newBookings = lesson.bookingCount - previousLesson.bookingCount;
            notifications.push({
                title: newBookings === 1 ? 'Nova marcação na tua aula' : 'Novas marcações nas tuas aulas',
                message: newBookings === 1
                    ? `${lesson.label} recebeu uma nova inscrição.`
                    : `${lesson.label} recebeu ${newBookings} novas inscrições.`,
                tone: 'info'
            });
        }
    });

    if (cancelledLessons.length > 0) {
        const firstLesson = cancelledLessons[0];
        notifications.push({
            title: cancelledLessons.length === 1 ? 'Aula cancelada' : 'Aulas canceladas',
            message: cancelledLessons.length === 1
                ? `${firstLesson.label} em ${firstLesson.when} foi cancelada.`
                : `${cancelledLessons.length} aulas foram canceladas no teu horario.`,
            tone: 'warning'
        });
    }

    if (newEvents.length > 0) {
        const firstEvent = newEvents[0];
        notifications.push({
            title: newEvents.length === 1 ? 'Novo evento publicado' : 'Novos eventos publicados',
            message: newEvents.length === 1
                ? `${firstEvent.title} para ${firstEvent.when}.`
                : `${newEvents.length} novos eventos ficaram visíveis no portal.`,
            tone: 'info'
        });
    }

    nextLessons.forEach((lesson) => {
        const previousLesson = previousLessons.get(lesson.id);
        if (!previousLesson) return;

        if (previousLesson.validated === false && lesson.validated === true) {
            notifications.push({
                title: 'Aula validada pela Direção',
                message: `${lesson.label} foi validada em ${lesson.when}.`,
                tone: 'success'
            });
        }
    });

    const previousRequestIds = new Set((previousSnapshot.coachingRequests || []).map((request) => request.id));
    const newCoachingRequests = (nextSnapshot.coachingRequests || []).filter((request) => !previousRequestIds.has(request.id));

    if (newCoachingRequests.length > 0) {
        const firstRequest = newCoachingRequests[0];
        notifications.push({
            title: newCoachingRequests.length === 1 ? 'Novo pedido de Coaching' : 'Novos pedidos de Coaching',
            message: newCoachingRequests.length === 1
                ? `${firstRequest.student} pediu ${firstRequest.label} para ${firstRequest.when}.`
                : `${newCoachingRequests.length} pedidos de Coaching aguardam a tua confirmação.`,
            tone: 'warning'
        });
    }

    notifications.push(...buildMarketplaceNotifications(previousSnapshot.marketplaceItems, nextSnapshot.marketplaceItems));

    return notifications;
};

const buildGuardianNotifications = (previousSnapshot, nextSnapshot) => {
    const notifications = [];
    const previousLessonIds = new Set((previousSnapshot.availableLessons || []).map((lesson) => lesson.id));
    const newAvailableLessons = (nextSnapshot.availableLessons || []).filter((lesson) => !previousLessonIds.has(lesson.id));
    const previousBookingIds = new Set((previousSnapshot.bookings || []).map((booking) => booking.id));
    const newBookings = (nextSnapshot.bookings || []).filter((booking) => !previousBookingIds.has(booking.id));
    const nextBookingIds = new Set((nextSnapshot.bookings || []).map((booking) => booking.id));
    const previousEventIds = new Set((previousSnapshot.events || []).map((eventItem) => eventItem.id));
    const newEvents = (nextSnapshot.events || []).filter((eventItem) => !previousEventIds.has(eventItem.id));
    const cancelledBookings = (previousSnapshot.bookings || []).filter((booking) => !nextBookingIds.has(booking.id));

    if (newAvailableLessons.length > 0) {
        const firstLesson = newAvailableLessons[0];
        notifications.push({
            title: newAvailableLessons.length === 1 ? 'Nova aula disponível' : 'Novas aulas disponíveis',
            message: newAvailableLessons.length === 1
                ? `${firstLesson.label} em ${firstLesson.when}.`
                : `${newAvailableLessons.length} novas aulas ficaram disponíveis para inscrição.`,
            tone: 'info'
        });
    }

    if (newEvents.length > 0) {
        const firstEvent = newEvents[0];
        notifications.push({
            title: newEvents.length === 1 ? 'Novo evento publicado' : 'Novos eventos publicados',
            message: newEvents.length === 1
                ? `${firstEvent.title} para ${firstEvent.when}.`
                : `${newEvents.length} novos eventos ficaram disponíveis para consulta.`,
            tone: 'info'
        });
    }

    if (newBookings.length > 0) {
        const firstBooking = newBookings[0];
        const isCoaching = (firstBooking.lessonType || 'Regular') === 'Particular';
        notifications.push({
            title: newBookings.length === 1
                ? (isCoaching ? 'Novo Coaching agendado' : 'Nova aula agendada')
                : 'Novas aulas agendadas',
            message: newBookings.length === 1
                ? `${firstBooking.student} tem ${isCoaching ? 'Coaching' : firstBooking.label} em ${firstBooking.when}.`
                : `${newBookings.length} novas marcações foram associadas aos educandos.`,
            tone: 'info'
        });
    }

    if (cancelledBookings.length > 0) {
        const firstBooking = cancelledBookings[0];
        const isCoaching = (firstBooking.lessonType || 'Regular') === 'Particular';
        notifications.push({
            title: cancelledBookings.length === 1
                ? (isCoaching ? 'Coaching cancelado' : 'Aula cancelada')
                : 'Aulas canceladas',
            message: cancelledBookings.length === 1
                ? `${firstBooking.student} ficou sem ${isCoaching ? 'o Coaching' : firstBooking.label} em ${firstBooking.when}.`
                : `${cancelledBookings.length} marcações dos educandos foram canceladas.`,
            tone: 'warning'
        });
    }

    const previousBookings = new Map((previousSnapshot.bookings || []).map((booking) => [booking.id, booking]));

    (nextSnapshot.bookings || []).forEach((booking) => {
        const previousBooking = previousBookings.get(booking.id);
        if (!previousBooking || previousBooking.cancellationStatus === booking.cancellationStatus) {
            return;
        }

        if (booking.cancellationStatus === 'AprovadoDirecao') {
            notifications.push({
                title: 'Cancelamento aprovado',
                message: booking.cancellationNote || `${booking.student} teve o cancelamento de ${booking.label} aprovado para ${booking.when}.`,
                tone: 'success'
            });
            return;
        }

        if (booking.cancellationStatus === 'RejeitadoDirecao') {
            notifications.push({
                title: 'Cancelamento rejeitado',
                message: booking.cancellationNote || `${booking.student} mantém ${booking.label} em ${booking.when}.`,
                tone: 'warning'
            });
        }
    });

    notifications.push(...buildMarketplaceNotifications(previousSnapshot.marketplaceItems, nextSnapshot.marketplaceItems));

    if ((nextSnapshot.pendingPaymentIds || []).length > (previousSnapshot.pendingPaymentIds || []).length) {
        notifications.push({
            title: 'Novo pagamento pendente',
            message: 'A conta do encarregado tem um novo pagamento por liquidar.',
            tone: 'warning'
        });
    }

    const previousRequests = new Map((previousSnapshot.coachingRequests || []).map((request) => [request.id, request]));

    (nextSnapshot.coachingRequests || []).forEach((request) => {
        const previousRequest = previousRequests.get(request.id);
        if (!previousRequest || previousRequest.status === request.status) {
            return;
        }

        if (request.status === 'PendenteDirecao') {
            notifications.push({
                title: 'Coaching confirmado pelo professor',
                message: `${request.label} em ${request.when} segue agora para decisão da Direção.`,
                tone: 'info'
            });
            return;
        }

        if (request.status === 'Aprovado') {
            notifications.push({
                title: 'Coaching aprovado',
                message: `${request.label} em ${request.when} foi aprovado com sucesso.`,
                tone: 'success'
            });
            return;
        }

        if (request.status === 'RejeitadoProfessor') {
            notifications.push({
                title: 'Coaching rejeitado pelo professor',
                message: request.observacaoProfessor || `${request.label} não foi confirmado pelo professor.`,
                tone: 'danger'
            });
            return;
        }

        if (request.status === 'RejeitadoDirecao') {
            notifications.push({
                title: 'Coaching rejeitado pela Direção',
                message: request.observacaoDirecao || `${request.label} não foi aprovado pela Direção.`,
                tone: 'danger'
            });
        }
    });

    return notifications;
};

const compareSnapshots = (previousSnapshot, nextSnapshot) => {
    if (!previousSnapshot || !nextSnapshot || previousSnapshot.role !== nextSnapshot.role) {
        return [];
    }

    if (nextSnapshot.role === 'director') {
        return buildDirectorNotifications(previousSnapshot, nextSnapshot);
    }

    if (nextSnapshot.role === 'teacher') {
        return buildTeacherNotifications(previousSnapshot, nextSnapshot);
    }

    if (nextSnapshot.role === 'guardian') {
        return buildGuardianNotifications(previousSnapshot, nextSnapshot);
    }

    return [];
};

const NotificationViewport = ({ notifications, onDismiss }) => (
    <div className="app-notifications" aria-live="polite" aria-atomic="true">
        {notifications.map((notification) => (
            <article
                key={notification.id}
                className={`app-notification app-notification--${notification.tone || 'info'}`}
            >
                <div className="app-notification-copy">
                    <strong>{notification.title}</strong>
                    {notification.message && <p>{notification.message}</p>}
                </div>
                <button type="button" className="app-notification-close" onClick={() => onDismiss(notification.id)}>
                    Fechar
                </button>
            </article>
        ))}
    </div>
);

export const NotificationProvider = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const [popupNotifications, setPopupNotifications] = useState([]);
    const [notificationFeed, setNotificationFeed] = useState([]);
    const lastSnapshotRef = useRef(null);
    const isHydratingRef = useRef(true);
    const lastRequestErrorRef = useRef({ key: '', timestamp: 0 });
    const seenPersistentPopupIdsRef = useRef(new Set());

    const dismiss = useCallback((id) => {
        setPopupNotifications((current) => current.filter((item) => item.id !== id));
    }, []);

    const markAsRead = useCallback(async (id) => {
        let persisted = false;

        setNotificationFeed((current) => current.map((item) => {
            if (item.id !== id) return item;
            persisted = Boolean(item.persisted);
            return { ...item, read: true };
        }));

        if (persisted) {
            try {
                await marcarNotificacaoComoLida(id);
            } catch {
                // Mantemos a UI otimista; o próximo sync do servidor repõe o estado real se falhar.
            }
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        setNotificationFeed((current) => current.map((item) => ({ ...item, read: true })));

        try {
            await marcarTodasNotificacoesComoLidas();
        } catch {
            // Mantemos a UI otimista; o próximo sync do servidor repõe o estado real se falhar.
        }
    }, []);

    const removeNotification = useCallback(async (id) => {
        let persisted = false;

        setNotificationFeed((current) => current.filter((item) => {
            if (item.id === id) {
                persisted = Boolean(item.persisted);
                return false;
            }
            return true;
        }));
        setPopupNotifications((current) => current.filter((item) => item.id !== id));

        if (persisted) {
            try {
                await removerNotificacao(id);
            } catch {
                // O próximo sync do servidor volta a inserir se a remoção falhar.
            }
        }
    }, []);

    const clearNotifications = useCallback(async () => {
        const previousFeed = notificationFeed;
        setPopupNotifications([]);
        setNotificationFeed([]);
        seenPersistentPopupIdsRef.current = new Set();

        try {
            await limparNotificacoes();
        } catch {
            setNotificationFeed(previousFeed);
            // O próximo sync do servidor repõe o estado real se a limpeza falhar.
        }
    }, [notificationFeed]);

    const notify = useCallback(({ title, message = '', tone = 'info', duration = 6000, persist = true }) => {
        if (SUPPRESSED_NOTIFICATION_TITLES.has(String(title || '').trim())) {
            return;
        }

        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const notification = {
            id,
            title,
            message,
            tone,
            read: false,
            createdAt: new Date().toISOString(),
            persisted: false
        };

        if (persist) {
            setNotificationFeed((current) => [
                notification,
                ...current
            ].slice(0, MAX_INBOX_NOTIFICATIONS));
        }

        setPopupNotifications((current) => [
            notification,
            ...current
        ].slice(0, MAX_POPUP_NOTIFICATIONS));

        if (duration > 0) {
            window.setTimeout(() => {
                dismiss(id);
            }, duration);
        }
    }, [dismiss]);

    useEffect(() => {
        const handleRequestError = (event) => {
            const detail = event?.detail || {};
            const title = String(detail.title || 'Operação não concluída').trim();
            const message = String(detail.message || 'O pedido não foi concluído.').trim();
            const key = `${title}::${message}`;
            const now = Date.now();

            if (
                lastRequestErrorRef.current.key === key &&
                now - lastRequestErrorRef.current.timestamp < 1500
            ) {
                return;
            }

            lastRequestErrorRef.current = {
                key,
                timestamp: now
            };

            notify({
                title,
                message,
                tone: 'danger',
                duration: 8000,
                persist: false
            });
        };

        window.addEventListener('entartes:request-error', handleRequestError);

        return () => {
            window.removeEventListener('entartes:request-error', handleRequestError);
        };
    }, [notify]);

    const syncServerNotifications = useCallback(async ({ showUnreadPopups = false } = {}) => {
        if (!isAuthenticated || !getUserId(user)) {
            return [];
        }

        const serverNotifications = (await getNotificacoes({ limit: 100 })).map(mapServerNotification);

        setNotificationFeed((current) => mergeNotifications(current, serverNotifications));

        if (showUnreadPopups) {
            serverNotifications
                .filter((item) => !item.read && !seenPersistentPopupIdsRef.current.has(item.id))
                .slice(0, MAX_POPUP_NOTIFICATIONS)
                .forEach((item) => {
                    seenPersistentPopupIdsRef.current.add(item.id);
                    notify({
                        title: item.title,
                        message: item.message,
                        tone: item.tone,
                        persist: false
                    });
                });
        }

        return serverNotifications;
    }, [isAuthenticated, notify, user]);

    const refreshSnapshot = useCallback(async () => {
        if (!isAuthenticated || !getUserId(user)) return;

        const nextSnapshot = await buildSnapshot(user);
        if (!nextSnapshot) return;

        lastSnapshotRef.current = nextSnapshot;
        const storageKey = buildSnapshotStorageKey(user);
        const storage = buildNotificationStorage();
        if (storageKey) {
            storage?.setItem(storageKey, JSON.stringify(nextSnapshot));
        }
        isHydratingRef.current = false;
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (!isAuthenticated || !getUserId(user)) {
            lastSnapshotRef.current = null;
            isHydratingRef.current = true;
            seenPersistentPopupIdsRef.current = new Set();
            setPopupNotifications([]);
            setNotificationFeed([]);
            return;
        }

        const snapshotStorageKey = buildSnapshotStorageKey(user);
        const inboxStorageKey = buildInboxStorageKey(user);
        const storage = buildNotificationStorage();
        const storedSnapshot = snapshotStorageKey ? storage?.getItem(snapshotStorageKey) : null;
        const storedFeed = inboxStorageKey ? localStorage.getItem(inboxStorageKey) : null;

        if (storedSnapshot) {
            try {
                lastSnapshotRef.current = JSON.parse(storedSnapshot);
            } catch {
                lastSnapshotRef.current = null;
            }
        } else {
            lastSnapshotRef.current = null;
        }

        if (storedFeed) {
            try {
                setNotificationFeed(JSON.parse(storedFeed));
            } catch {
                setNotificationFeed([]);
            }
        } else {
            setNotificationFeed([]);
        }

        seenPersistentPopupIdsRef.current = new Set();
        setPopupNotifications([]);
        isHydratingRef.current = true;
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (!isAuthenticated || !getUserId(user)) {
            return;
        }

        const inboxStorageKey = buildInboxStorageKey(user);
        if (inboxStorageKey) {
            localStorage.setItem(inboxStorageKey, JSON.stringify(notificationFeed));
        }
    }, [notificationFeed, isAuthenticated, user]);

    useEffect(() => {
        if (!isAuthenticated || !getUserId(user)) return undefined;

        let isCancelled = false;

        const storageKey = buildSnapshotStorageKey(user);
        const storage = buildNotificationStorage();

        const pollNotifications = async () => {
            try {
                const [nextSnapshot] = await Promise.all([
                    buildSnapshot(user),
                    syncServerNotifications({ showUnreadPopups: true })
                ]);
                if (!nextSnapshot || isCancelled) return;

                const previousSnapshot = lastSnapshotRef.current;

                if (previousSnapshot && !isHydratingRef.current) {
                    compareSnapshots(previousSnapshot, nextSnapshot).forEach((notification) => notify(notification));
                }

                lastSnapshotRef.current = nextSnapshot;
                if (storageKey) {
                    storage?.setItem(storageKey, JSON.stringify(nextSnapshot));
                }

                isHydratingRef.current = false;
            } catch {
                // Mantemos o polling silencioso para nao gerar ruido quando a API falha momentaneamente.
            }
        };

        pollNotifications();
        const timer = window.setInterval(pollNotifications, POLL_INTERVAL_MS);

        return () => {
            isCancelled = true;
            window.clearInterval(timer);
        };
    }, [isAuthenticated, notify, syncServerNotifications, user]);

    const unreadCount = useMemo(
        () => notificationFeed.filter((notification) => !notification.read).length,
        [notificationFeed]
    );

    const contextValue = useMemo(() => ({
        notify,
        dismiss,
        refreshSnapshot,
        notifications: notificationFeed,
        unreadCount,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearNotifications
    }), [clearNotifications, dismiss, markAllAsRead, markAsRead, notificationFeed, notify, refreshSnapshot, removeNotification, unreadCount]);

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
            <NotificationViewport notifications={popupNotifications} onDismiss={dismiss} />
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
};

