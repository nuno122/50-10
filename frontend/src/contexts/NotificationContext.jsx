import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
    getAulas,
    getEventos,
    getPagamentosEncarregado,
    getPedidosAulaPrivada,
    getPedidosAulaPrivadaEncarregado,
    getPedidosAulaPrivadaProfessor
} from '../services/api';
import { PERMISSOES } from '../utils/permissions';

const NotificationContext = createContext();

const POLL_INTERVAL_MS = 15000;
const MAX_POPUP_NOTIFICATIONS = 4;
const MAX_INBOX_NOTIFICATIONS = 40;

const pad = (value) => String(value).padStart(2, '0');

const buildSnapshotStorageKey = (user) => (
    user?.Id ? `entartes-alert-snapshot-${user.Id}-${user.Permissoes}` : ''
);

const buildInboxStorageKey = (user) => (
    user?.Id ? `entartes-notification-feed-${user.Id}-${user.Permissoes}` : ''
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

const isPendingPayment = (payment) => {
    const status = normalizePaymentStatus(payment?.EstadoPagamento);
    return Boolean(payment)
        && payment?.Marcacao?.EstaAtivo !== false
        && status !== 'pago'
        && status !== 'cancelado';
};

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

const normalizeLessonsForRole = (aulas, user) => {
    const futureLessons = (aulas || []).filter((lesson) => lesson.EstaAtivo !== false);

    if (user?.Permissoes === PERMISSOES.PROFESSOR) {
        return futureLessons.filter((lesson) => lesson.IdProfessor === user?.Id);
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

const buildDirectorSnapshot = async () => {
    const [aulas, requests] = await Promise.all([
        getAulas(),
        getPedidosAulaPrivada()
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
            validated: Boolean(lesson.ValidacaoDirecao)
        })),
        pendingValidationCount: activeLessons.filter((lesson) => !lesson.ValidacaoDirecao).length,
        coachingRequests
    };
};

const buildTeacherSnapshot = async (user) => {
    const [aulas, requests, events] = await Promise.all([
        getAulas(),
        getPedidosAulaPrivadaProfessor(),
        getEventos()
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
            validated: Boolean(lesson.ValidacaoDirecao)
        })),
        events: (events || []).map(mapPublishedEvent),
        coachingRequests
    };
};

const buildGuardianSnapshot = async () => {
    const [aulas, pagamentos, requests, events] = await Promise.all([
        getAulas(),
        getPagamentosEncarregado(),
        getPedidosAulaPrivadaEncarregado(),
        getEventos()
    ]);

    const availableLessons = (aulas || [])
        .filter((lesson) => isFutureRegularLesson(lesson));

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
        coachingRequests: (requests || []).map(mapCoachingRequest),
        events: (events || []).map(mapPublishedEvent)
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
    const previousIds = new Set((previousSnapshot.lessons || []).map((lesson) => lesson.id));
    const newLessons = (nextSnapshot.lessons || []).filter((lesson) => !previousIds.has(lesson.id));

    if (newLessons.length > 0) {
        const firstLesson = newLessons[0];
        notifications.push({
            title: newLessons.length === 1 ? 'Nova aula criada' : 'Novas aulas criadas',
            message: newLessons.length === 1
                ? `${firstLesson.label} em ${firstLesson.when}.`
                : `${newLessons.length} novas aulas foram adicionadas ao horario.`,
            tone: 'info'
        });
    }

    if ((nextSnapshot.pendingValidationCount || 0) > (previousSnapshot.pendingValidationCount || 0)) {
        notifications.push({
            title: 'Novas validacoes pendentes',
            message: 'A Direcao tem novas aulas por validar.',
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
                ? `${firstRequest.label} em ${firstRequest.when} aguarda decisao da Direcao.`
                : `${newCoachingRequests.length} pedidos de Coaching aguardam decisao da Direcao.`,
            tone: 'warning'
        });
    }

    return notifications;
};

const buildTeacherNotifications = (previousSnapshot, nextSnapshot) => {
    const notifications = [];
    const previousLessons = new Map((previousSnapshot.lessons || []).map((lesson) => [lesson.id, lesson]));
    const nextLessons = nextSnapshot.lessons || [];
    const previousEventIds = new Set((previousSnapshot.events || []).map((eventItem) => eventItem.id));
    const newEvents = (nextSnapshot.events || []).filter((eventItem) => !previousEventIds.has(eventItem.id));

    const newLessons = nextLessons.filter((lesson) => !previousLessons.has(lesson.id));
    if (newLessons.length > 0) {
        const firstLesson = newLessons[0];
        notifications.push({
            title: newLessons.length === 1 ? 'Nova aula atribuida' : 'Novas aulas atribuidas',
            message: newLessons.length === 1
                ? `${firstLesson.label} em ${firstLesson.when}.`
                : `${newLessons.length} novas aulas foram associadas ao teu horario.`,
            tone: 'info'
        });
    }

    if (newEvents.length > 0) {
        const firstEvent = newEvents[0];
        notifications.push({
            title: newEvents.length === 1 ? 'Novo evento publicado' : 'Novos eventos publicados',
            message: newEvents.length === 1
                ? `${firstEvent.title} para ${firstEvent.when}.`
                : `${newEvents.length} novos eventos ficaram visiveis no portal.`,
            tone: 'info'
        });
    }

    nextLessons.forEach((lesson) => {
        const previousLesson = previousLessons.get(lesson.id);
        if (!previousLesson) return;

        if (previousLesson.validated === false && lesson.validated === true) {
            notifications.push({
                title: 'Aula validada pela Direcao',
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
                : `${newCoachingRequests.length} pedidos de Coaching aguardam a tua confirmacao.`,
            tone: 'warning'
        });
    }

    return notifications;
};

const buildGuardianNotifications = (previousSnapshot, nextSnapshot) => {
    const notifications = [];
    const previousLessonIds = new Set((previousSnapshot.availableLessons || []).map((lesson) => lesson.id));
    const newAvailableLessons = (nextSnapshot.availableLessons || []).filter((lesson) => !previousLessonIds.has(lesson.id));
    const previousEventIds = new Set((previousSnapshot.events || []).map((eventItem) => eventItem.id));
    const newEvents = (nextSnapshot.events || []).filter((eventItem) => !previousEventIds.has(eventItem.id));

    if (newAvailableLessons.length > 0) {
        const firstLesson = newAvailableLessons[0];
        notifications.push({
            title: newAvailableLessons.length === 1 ? 'Nova aula disponivel' : 'Novas aulas disponiveis',
            message: newAvailableLessons.length === 1
                ? `${firstLesson.label} em ${firstLesson.when}.`
                : `${newAvailableLessons.length} novas aulas ficaram disponiveis para inscricao.`,
            tone: 'info'
        });
    }

    if (newEvents.length > 0) {
        const firstEvent = newEvents[0];
        notifications.push({
            title: newEvents.length === 1 ? 'Novo evento publicado' : 'Novos eventos publicados',
            message: newEvents.length === 1
                ? `${firstEvent.title} para ${firstEvent.when}.`
                : `${newEvents.length} novos eventos ficaram disponiveis para consulta.`,
            tone: 'info'
        });
    }

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
                message: `${request.label} em ${request.when} segue agora para decisao da Direcao.`,
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
                message: request.observacaoProfessor || `${request.label} nao foi confirmado pelo professor.`,
                tone: 'danger'
            });
            return;
        }

        if (request.status === 'RejeitadoDirecao') {
            notifications.push({
                title: 'Coaching rejeitado pela Direcao',
                message: request.observacaoDirecao || `${request.label} nao foi aprovado pela Direcao.`,
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

    const dismiss = useCallback((id) => {
        setPopupNotifications((current) => current.filter((item) => item.id !== id));
    }, []);

    const markAsRead = useCallback((id) => {
        setNotificationFeed((current) => current.map((item) => (
            item.id === id ? { ...item, read: true } : item
        )));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotificationFeed((current) => current.map((item) => ({ ...item, read: true })));
    }, []);

    const notify = useCallback(({ title, message = '', tone = 'info', duration = 6000, persist = true }) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const notification = {
            id,
            title,
            message,
            tone,
            read: false,
            createdAt: new Date().toISOString()
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

    const refreshSnapshot = useCallback(async () => {
        if (!isAuthenticated || !user?.Id) return;

        const nextSnapshot = await buildSnapshot(user);
        if (!nextSnapshot) return;

        lastSnapshotRef.current = nextSnapshot;
        const storageKey = buildSnapshotStorageKey(user);
        if (storageKey) {
            sessionStorage.setItem(storageKey, JSON.stringify(nextSnapshot));
        }
        isHydratingRef.current = false;
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (!isAuthenticated || !user?.Id) {
            lastSnapshotRef.current = null;
            isHydratingRef.current = true;
            setPopupNotifications([]);
            setNotificationFeed([]);
            return;
        }

        const snapshotStorageKey = buildSnapshotStorageKey(user);
        const inboxStorageKey = buildInboxStorageKey(user);
        const storedSnapshot = snapshotStorageKey ? sessionStorage.getItem(snapshotStorageKey) : null;
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

        setPopupNotifications([]);
        isHydratingRef.current = true;
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (!isAuthenticated || !user?.Id) {
            return;
        }

        const inboxStorageKey = buildInboxStorageKey(user);
        if (inboxStorageKey) {
            localStorage.setItem(inboxStorageKey, JSON.stringify(notificationFeed));
        }
    }, [notificationFeed, isAuthenticated, user]);

    useEffect(() => {
        if (!isAuthenticated || !user?.Id) return undefined;

        let isCancelled = false;

        const storageKey = buildSnapshotStorageKey(user);

        const pollNotifications = async () => {
            try {
                const nextSnapshot = await buildSnapshot(user);
                if (!nextSnapshot || isCancelled) return;

                const previousSnapshot = lastSnapshotRef.current;

                if (previousSnapshot && !isHydratingRef.current) {
                    compareSnapshots(previousSnapshot, nextSnapshot).forEach((notification) => notify(notification));
                }

                lastSnapshotRef.current = nextSnapshot;
                if (storageKey) {
                    sessionStorage.setItem(storageKey, JSON.stringify(nextSnapshot));
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
    }, [isAuthenticated, notify, user]);

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
        markAllAsRead
    }), [dismiss, markAllAsRead, markAsRead, notificationFeed, notify, refreshSnapshot, unreadCount]);

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
