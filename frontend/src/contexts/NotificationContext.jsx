import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getAulas, getMinhasMarcacoes, getPagamentosEncarregado } from '../services/api';
import { PERMISSOES } from '../utils/permissions';

const NotificationContext = createContext();

const POLL_INTERVAL_MS = 45000;
const MAX_NOTIFICATIONS = 4;

const pad = (value) => String(value).padStart(2, '0');

const buildSnapshotStorageKey = (user) => (
    user?.Id ? `entartes-alert-snapshot-${user.Id}-${user.Permissoes}` : ''
);

const formatDateTime = (dateValue, timeValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'data por definir';

    const text = String(timeValue || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    const time = match ? `${match[1]}:${match[2]}` : `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    return `${new Intl.DateTimeFormat('pt-PT').format(date)} as ${time}`;
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

const buildDirectorSnapshot = async () => {
    const aulas = await getAulas();
    const activeLessons = (aulas || []).filter((lesson) => lesson.EstaAtivo !== false);

    return {
        role: 'director',
        lessons: activeLessons.map((lesson) => ({
            id: lesson.IdAula,
            label: lesson.EstiloDanca?.Nome || 'Aula',
            when: formatDateTime(lesson.Data, lesson.HoraInicio),
            validated: Boolean(lesson.ValidacaoDirecao)
        })),
        pendingValidationCount: activeLessons.filter((lesson) => !lesson.ValidacaoDirecao).length
    };
};

const buildTeacherSnapshot = async (user) => {
    const aulas = await getAulas();
    const ownLessons = normalizeLessonsForRole(aulas, user);

    return {
        role: 'teacher',
        lessons: ownLessons.map((lesson) => ({
            id: lesson.IdAula,
            label: lesson.EstiloDanca?.Nome || 'Aula',
            when: formatDateTime(lesson.Data, lesson.HoraInicio),
            active: lesson.EstaAtivo !== false,
            validated: Boolean(lesson.ValidacaoDirecao)
        }))
    };
};

const buildStudentSnapshot = async () => {
    const [marcacoes, aulas] = await Promise.all([
        getMinhasMarcacoes(),
        getAulas()
    ]);

    const aulasMap = new Map((aulas || []).map((lesson) => [lesson.IdAula, lesson]));
    const activeBookings = (marcacoes || []).filter((booking) => booking.EstaAtivo !== false);

    return {
        role: 'student',
        bookings: activeBookings.map((booking) => {
            const lesson = aulasMap.get(booking.IdAula) || booking.Aula;
            return {
                id: booking.IdMarcacao,
                lessonId: booking.IdAula,
                label: lesson?.EstiloDanca?.Nome || 'Aula',
                when: formatDateTime(lesson?.Data, lesson?.HoraInicio),
                teacherConfirmed: Boolean(lesson?.ConfirmacaoProfessor),
                directorValidated: Boolean(lesson?.ValidacaoDirecao),
                pendingPaymentIds: (booking.Pagamento || [])
                    .filter((payment) => payment.EstadoPagamento !== 'Pago')
                    .map((payment) => payment.IdPagamento)
            };
        })
    };
};

const buildGuardianSnapshot = async () => {
    const [aulas, pagamentos] = await Promise.all([
        getAulas(),
        getPagamentosEncarregado()
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
            .filter((payment) => payment.EstadoPagamento !== 'Pago')
            .map((payment) => payment.IdPagamento)
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

    if (user.Permissoes === PERMISSOES.ALUNO) {
        return buildStudentSnapshot();
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

    return notifications;
};

const buildTeacherNotifications = (previousSnapshot, nextSnapshot) => {
    const notifications = [];
    const previousLessons = new Map((previousSnapshot.lessons || []).map((lesson) => [lesson.id, lesson]));
    const nextLessons = nextSnapshot.lessons || [];

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

    return notifications;
};

const buildStudentNotifications = (previousSnapshot, nextSnapshot) => {
    const notifications = [];
    const previousBookings = new Map((previousSnapshot.bookings || []).map((booking) => [booking.id, booking]));
    const nextBookings = nextSnapshot.bookings || [];

    const newBookings = nextBookings.filter((booking) => !previousBookings.has(booking.id));
    if (newBookings.length > 0) {
        const firstBooking = newBookings[0];
        notifications.push({
            title: newBookings.length === 1 ? 'Nova aula na agenda' : 'Novas aulas na agenda',
            message: newBookings.length === 1
                ? `${firstBooking.label} em ${firstBooking.when}.`
                : `${newBookings.length} novas aulas foram adicionadas a tua agenda.`,
            tone: 'info'
        });
    }

    nextBookings.forEach((booking) => {
        const previousBooking = previousBookings.get(booking.id);
        if (!previousBooking) return;

        if (previousBooking.teacherConfirmed === false && booking.teacherConfirmed === true && booking.directorValidated === false) {
            notifications.push({
                title: 'Aula confirmada pelo professor',
                message: `${booking.label} aguarda agora validacao da Direcao.`,
                tone: 'warning'
            });
        }

        if (previousBooking.directorValidated === false && booking.directorValidated === true) {
            notifications.push({
                title: 'Aula validada',
                message: `${booking.label} foi validada pela Direcao.`,
                tone: 'success'
            });
        }

        if ((booking.pendingPaymentIds || []).length > (previousBooking.pendingPaymentIds || []).length) {
            notifications.push({
                title: 'Novo pagamento pendente',
                message: `Foi gerado um pagamento associado a ${booking.label}.`,
                tone: 'warning'
            });
        }
    });

    return notifications;
};

const buildGuardianNotifications = (previousSnapshot, nextSnapshot) => {
    const notifications = [];
    const previousLessonIds = new Set((previousSnapshot.availableLessons || []).map((lesson) => lesson.id));
    const newAvailableLessons = (nextSnapshot.availableLessons || []).filter((lesson) => !previousLessonIds.has(lesson.id));

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

    if ((nextSnapshot.pendingPaymentIds || []).length > (previousSnapshot.pendingPaymentIds || []).length) {
        notifications.push({
            title: 'Novo pagamento pendente',
            message: 'A conta do encarregado tem um novo pagamento por liquidar.',
            tone: 'warning'
        });
    }

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

    if (nextSnapshot.role === 'student') {
        return buildStudentNotifications(previousSnapshot, nextSnapshot);
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
    const [notifications, setNotifications] = useState([]);
    const lastSnapshotRef = useRef(null);
    const isHydratingRef = useRef(true);

    const dismiss = (id) => {
        setNotifications((current) => current.filter((item) => item.id !== id));
    };

    const notify = ({ title, message = '', tone = 'info', duration = 6000 }) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        setNotifications((current) => [
            { id, title, message, tone },
            ...current
        ].slice(0, MAX_NOTIFICATIONS));

        window.setTimeout(() => {
            dismiss(id);
        }, duration);
    };

    const refreshSnapshot = async () => {
        if (!isAuthenticated || !user?.Id) return;

        const nextSnapshot = await buildSnapshot(user);
        if (!nextSnapshot) return;

        lastSnapshotRef.current = nextSnapshot;
        const storageKey = buildSnapshotStorageKey(user);
        if (storageKey) {
            sessionStorage.setItem(storageKey, JSON.stringify(nextSnapshot));
        }
        isHydratingRef.current = false;
    };

    useEffect(() => {
        if (!isAuthenticated || !user?.Id) {
            lastSnapshotRef.current = null;
            isHydratingRef.current = true;
            setNotifications([]);
            return;
        }

        const storageKey = buildSnapshotStorageKey(user);
        const storedSnapshot = storageKey ? sessionStorage.getItem(storageKey) : null;

        if (storedSnapshot) {
            try {
                lastSnapshotRef.current = JSON.parse(storedSnapshot);
            } catch {
                lastSnapshotRef.current = null;
            }
        } else {
            lastSnapshotRef.current = null;
        }

        isHydratingRef.current = true;
    }, [isAuthenticated, user]);

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
                // Mantemos o polling silencioso para nao gerar ruído quando a API falha momentaneamente.
            }
        };

        pollNotifications();
        const timer = window.setInterval(pollNotifications, POLL_INTERVAL_MS);

        return () => {
            isCancelled = true;
            window.clearInterval(timer);
        };
    }, [isAuthenticated, user]);

    const contextValue = useMemo(() => ({
        notify,
        dismiss,
        refreshSnapshot
    }));

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
            <NotificationViewport notifications={notifications} onDismiss={dismiss} />
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
