import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../utils/permissions';
import dashboardHeroImage from '../../Images/Inicio.png';
import {
    getAulas,
    getAlunosEncarregado,
    getEstudios,
    getMarcacoesEncarregado,
    getPagamentos,
    getPagamentosEncarregado
} from '../services/api';

const emptyDashboard = {
    roleLabel: 'Painel',
    title: 'Painel principal',
    welcome: "Bem-vindo a Ent'Artes",
    note: '',
    weekLabel: '',
    stats: [],
    showQuick: true,
    quickTitle: 'Pontos principais',
    quick: [],
    showActivity: true,
    activityTitle: 'Acompanhamento',
    activity: [],
    scheduleTitle: 'Agenda semanal',
    scheduleSubtitle: '',
    scheduleDays: [],
    scheduleEmpty: 'Sem registos para esta semana.'
};

const pad = (value) => String(value).padStart(2, '0');

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const extractTime = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : { hours: 0, minutes: 0 };
};

const formatTime = (value) => {
    const { hours, minutes } = extractTime(value);
    return `${pad(hours)}:${pad(minutes)}`;
};

const formatTimeRange = (startValue, endValue) => `${formatTime(startValue)} - ${formatTime(endValue)}`;

const formatCurrency = (value) => new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
}).format(Number(value || 0));

const getAulaDateTime = (aula) => {
    const date = new Date(aula?.Data);
    if (Number.isNaN(date.getTime())) return new Date(0);

    const { hours, minutes } = extractTime(aula?.HoraInicio);
    date.setHours(hours, minutes, 0, 0);
    return date;
};

const getBookingDateTime = (booking) => getAulaDateTime(booking?.Aula);

const toDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
};

const getWeekRangeLabel = (start) => {
    const weekEnd = new Date(start);
    weekEnd.setDate(start.getDate() + 6);
    return `Semana de ${formatDate(start)} a ${formatDate(weekEnd)}`;
};

const isWithinRange = (date, start, end) => date >= start && date < end;

const isSameDay = (leftValue, rightValue) => {
    const left = new Date(leftValue);
    const right = new Date(rightValue);

    if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false;

    return left.getDate() === right.getDate()
        && left.getMonth() === right.getMonth()
        && left.getFullYear() === right.getFullYear();
};

const getUpcomingLabel = (date) => {
    if (!date || Number.isNaN(date.getTime()) || date.getTime() === 0) return 'Sem registo';

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const target = new Date(date);
    const targetDay = new Date(target);
    targetDay.setHours(0, 0, 0, 0);

    const time = `${pad(target.getHours())}:${pad(target.getMinutes())}`;

    if (targetDay.getTime() === today.getTime()) return `Hoje ${time}`;
    if (targetDay.getTime() === tomorrow.getTime()) return `Amanhã ${time}`;
    return `${formatDate(target)} ${time}`;
};

const createActivity = (action, when, type) => ({ action, when, type });

const getActiveBookingsCount = (aula) => (
    (aula.Marcacao || []).filter((booking) => booking.EstaAtivo !== false).length
);

const normalizePaymentStatus = (value) => String(value || '').trim().toLowerCase();

const isPendingPayment = (payment) => {
    const status = normalizePaymentStatus(payment?.EstadoPagamento);
    return Boolean(payment)
        && payment?.Marcacao?.EstaAtivo !== false
        && status !== 'pago'
        && status !== 'cancelado';
};

const isFutureRegularLesson = (aula) => {
    if (!aula || aula.EstaAtivo === false) return false;
    if ((aula.TipoAula || 'Regular') !== 'Regular') return false;
    return getAulaDateTime(aula) > new Date();
};

const getLessonTypeLabel = (value) => {
    const normalized = String(value || 'Regular').trim().toLowerCase();
    if (normalized === 'particular' || normalized === 'privada' || normalized === 'coaching') {
        return 'Coaching';
    }

    return 'Regular';
};

const getStudioLabel = (aula) => (
    aula?.Estudio?.Numero ? `Estúdio ${aula.Estudio.Numero}` : 'Estúdio por definir'
);

const getTeacherName = (aula) => (
    aula?.Professor?.Utilizador?.NomeCompleto || 'Professor por definir'
);

const getStudentName = (student) => student?.Nome || student?.Utilizador?.NomeCompleto || 'Educando';

const hasAvailableSeats = (aula) => getActiveBookingsCount(aula) < Number(aula?.CapacidadeMaxima || 0);

const buildScheduleDays = (entries, weekStart) => {
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);

        return {
            id: toDateKey(date),
            shortLabel: new Intl.DateTimeFormat('pt-PT', { weekday: 'short' }).format(date),
            label: new Intl.DateTimeFormat('pt-PT', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit'
            }).format(date),
            dayNumber: pad(date.getDate()),
            items: []
        };
    });

    const dayMap = new Map(days.map((day) => [day.id, day]));

    [...entries]
        .sort((left, right) => left.dateTime - right.dateTime)
        .forEach((entry) => {
            const day = dayMap.get(toDateKey(entry.dateTime));
            if (day) {
                day.items.push(entry);
            }
        });

    return days;
};

const buildLessonScheduleEntry = (aula, metaTop, metaBottom) => ({
    id: aula.IdAula,
    dateTime: getAulaDateTime(aula),
    timeLabel: formatTimeRange(aula.HoraInicio, aula.HoraFim),
    title: aula.EstiloDanca?.Nome || 'Aula',
    badge: getLessonTypeLabel(aula.TipoAula),
    metaTop,
    metaBottom
});

const buildBookingScheduleEntry = (booking, studentName) => {
    const lesson = booking.Aula || {};

    return {
        id: booking.IdMarcacao,
        dateTime: getBookingDateTime(booking),
        timeLabel: formatTimeRange(lesson.HoraInicio, lesson.HoraFim),
        title: lesson.EstiloDanca?.Nome || 'Aula',
        badge: getLessonTypeLabel(lesson.TipoAula),
        metaTop: studentName,
        metaBottom: `${getTeacherName(lesson)} | ${getStudioLabel(lesson)}`
    };
};

const buildDirectorDashboard = ({ aulas, estudios, pagamentos }) => {
    const now = new Date();
    const { start, end } = getWeekRange();
    const activeClasses = aulas.filter((aula) => aula.EstaAtivo !== false);
    const weeklyClasses = activeClasses
        .filter((aula) => isWithinRange(getAulaDateTime(aula), start, end))
        .sort((left, right) => getAulaDateTime(left) - getAulaDateTime(right));
    const todayClasses = activeClasses.filter((aula) => isSameDay(aula.Data, now));
    const pendingValidation = activeClasses.filter((aula) => (
        getActiveBookingsCount(aula) > 0 &&
        aula.ConfirmacaoProfessor &&
        !aula.ValidacaoDirecao
    ));
    const pendingTeacherConfirmation = activeClasses.filter((aula) => (
        getActiveBookingsCount(aula) > 0 &&
        !aula.ConfirmacaoProfessor &&
        getAulaDateTime(aula) <= now
    ));
    const nextClass = [...activeClasses]
        .map((aula) => ({ aula, date: getAulaDateTime(aula) }))
        .filter((entry) => entry.date > now)
        .sort((left, right) => left.date - right.date)[0];
    const overduePayments = pagamentos.filter((pagamento) => (
        isPendingPayment(pagamento) &&
        pagamento.PrazoPagamento &&
        new Date(pagamento.PrazoPagamento) < now
    ));
    const weeklyBookings = weeklyClasses.reduce((sum, aula) => sum + getActiveBookingsCount(aula), 0);

    return {
        roleLabel: 'Direção',
        title: 'Resumo operacional',
        welcome: '',
        note: pendingValidation.length > 0
            ? `Tem ${pendingValidation.length} aula(s) prontas para validação da Direção.`
            : pendingTeacherConfirmation.length > 0
                ? `${pendingTeacherConfirmation.length} aula(s) terminadas aguardam confirmação do professor.`
                : overduePayments.length > 0
                    ? `Existem ${overduePayments.length} pagamento(s) em atraso para acompanhar.`
                    : '',
        weekLabel: getWeekRangeLabel(start),
        stats: [
            { title: 'Aulas hoje', value: todayClasses.length, icon: 'HJ', tone: 'blue' },
            { title: 'Aulas esta semana', value: weeklyClasses.length, icon: 'CA', tone: 'green' },
            { title: 'Validações pendentes', value: pendingValidation.length, icon: 'OK', tone: 'amber' },
            { title: 'Pagamentos em atraso', value: overduePayments.length, icon: 'PG', tone: 'purple' }
        ],
        showQuick: false,
        quickTitle: 'Pontos de controlo',
        quick: [
            ['Próxima aula', nextClass ? getUpcomingLabel(nextClass.date) : 'Sem aulas futuras'],
            ['Inscrições previstas esta semana', weeklyBookings],
            ['Aulas por confirmar pelo professor', pendingTeacherConfirmation.length],
            ['Estúdios ativos', estudios.length]
        ],
        showActivity: false,
        activityTitle: 'Ações imediatas',
        activity: [
            ...pendingValidation.slice(0, 2).map((aula) => createActivity(
                `Validar ${aula.EstiloDanca?.Nome || 'aula'} em ${getStudioLabel(aula)}`,
                getUpcomingLabel(getAulaDateTime(aula)),
                'validation'
            )),
            ...pendingTeacherConfirmation.slice(0, 1).map((aula) => createActivity(
                `Aguardar confirmação do professor em ${aula.EstiloDanca?.Nome || 'aula'}`,
                `${formatDate(aula.Data)} | ${formatTime(aula.HoraFim)}`,
                'notification'
            )),
            ...overduePayments.slice(0, 1).map((pagamento) => createActivity(
                `Pagamento em atraso de ${formatCurrency(pagamento.Custo)}`,
                `Prazo ${formatDate(pagamento.PrazoPagamento)}`,
                'notification'
            ))
        ].slice(0, 4),
        scheduleTitle: 'Horário semanal completo',
        scheduleSubtitle: 'Vista global das aulas marcadas para esta semana.',
        scheduleDays: buildScheduleDays(
            weeklyClasses.map((aula) => buildLessonScheduleEntry(
                aula,
                `${getStudioLabel(aula)} | ${getTeacherName(aula)}`,
                `${getActiveBookingsCount(aula)} inscrito(s)`
            )),
            start
        ),
        scheduleEmpty: 'Ainda não existem aulas marcadas para esta semana.'
    };
};

const buildTeacherDashboard = ({ aulas, user }) => {
    const now = new Date();
    const { start, end } = getWeekRange();
    const userId = user?.IdUtilizador || user?.Id || null;
    const ownClasses = aulas.filter((aula) => aula.IdProfessor === userId && aula.EstaAtivo !== false);
    const weeklyClasses = ownClasses
        .filter((aula) => isWithinRange(getAulaDateTime(aula), start, end))
        .sort((left, right) => getAulaDateTime(left) - getAulaDateTime(right));
    const todayClasses = ownClasses.filter((aula) => isSameDay(aula.Data, now));
    const uniqueStudents = new Set(weeklyClasses.flatMap((aula) => (aula.Marcacao || []).map((item) => item.IdAluno)));
    const nextClass = [...ownClasses]
        .map((aula) => ({ aula, date: getAulaDateTime(aula) }))
        .filter((entry) => entry.date > now)
        .sort((left, right) => left.date - right.date)[0];
    const pendingDirectorValidation = ownClasses.filter((aula) => (
        getActiveBookingsCount(aula) > 0 &&
        aula.ConfirmacaoProfessor &&
        !aula.ValidacaoDirecao &&
        getAulaDateTime(aula) <= now
    ));
    const pendingOwnConfirmation = ownClasses.filter((aula) => (
        getActiveBookingsCount(aula) > 0 &&
        !aula.ConfirmacaoProfessor &&
        getAulaDateTime(aula) <= now
    ));
    const weeklyBookings = weeklyClasses.reduce((sum, aula) => sum + getActiveBookingsCount(aula), 0);

    return {
        roleLabel: 'Professor',
        title: 'Semana de aulas',
        welcome: '',
        note: pendingOwnConfirmation.length > 0
            ? `Tem ${pendingOwnConfirmation.length} aula(s) terminadas por confirmar.`
            : pendingDirectorValidation.length > 0
                ? `${pendingDirectorValidation.length} aula(s) aguardam validação da Direção.`
                : '',
        weekLabel: getWeekRangeLabel(start),
        stats: [
            { title: 'Aulas hoje', value: todayClasses.length, icon: 'HJ', tone: 'blue' },
            { title: 'Aulas esta semana', value: weeklyClasses.length, icon: 'CA', tone: 'green' },
            { title: 'Inscritos esta semana', value: weeklyBookings, icon: 'IN', tone: 'purple' },
            { title: 'Por confirmar', value: pendingOwnConfirmation.length, icon: 'CF', tone: 'amber' }
        ],
        showQuick: false,
        quickTitle: 'Resumo da semana',
        quick: [
            ['Próxima aula', nextClass ? getUpcomingLabel(nextClass.date) : 'Sem aulas futuras'],
            ['Inscrições esta semana', weeklyBookings],
            ['Alunos diferentes esta semana', uniqueStudents.size],
            ['Aulas por validar na Direção', pendingDirectorValidation.length]
        ],
        showActivity: false,
        activityTitle: 'O que requer acompanhamento',
        activity: [
            ...pendingOwnConfirmation.slice(0, 2).map((aula) => createActivity(
                `Confirmar conclusão de ${aula.EstiloDanca?.Nome || 'aula'}`,
                `${formatDate(aula.Data)} | ${formatTime(aula.HoraFim)}`,
                'notification'
            )),
            ...weeklyClasses
                .filter((aula) => getAulaDateTime(aula) >= now)
                .slice(0, 3)
                .map((aula) => createActivity(
                    `${aula.EstiloDanca?.Nome || 'Aula'} em ${getStudioLabel(aula)}`,
                    getUpcomingLabel(getAulaDateTime(aula)),
                    'booking'
                ))
        ].slice(0, 4),
        scheduleTitle: 'Horário das aulas desta semana',
        scheduleSubtitle: 'Todas as aulas da semana, organizadas por dia.',
        scheduleDays: buildScheduleDays(
            weeklyClasses.map((aula) => buildLessonScheduleEntry(
                aula,
                getStudioLabel(aula),
                `${getActiveBookingsCount(aula)} inscrito(s)`
            )),
            start
        ),
        scheduleEmpty: 'Não tem aulas marcadas para esta semana.'
    };
};

const buildGuardianDashboard = ({ aulas, pagamentos, studentBookings }) => {
    const now = new Date();
    const { start, end } = getWeekRange();
    const pendingPayments = (pagamentos || []).filter(isPendingPayment);
    const activeBookings = studentBookings
        .filter((booking) => booking && booking.EstaAtivo !== false)
        .sort((left, right) => getBookingDateTime(left) - getBookingDateTime(right));
    const futureBookings = activeBookings.filter((booking) => getBookingDateTime(booking) > now);
    const weeklyBookings = activeBookings.filter((booking) => isWithinRange(getBookingDateTime(booking), start, end));
    const todayBookings = activeBookings.filter((booking) => isSameDay(booking.Aula?.Data, now));
    const nextBookedLesson = futureBookings[0];
    const availableLessons = (aulas || [])
        .filter(isFutureRegularLesson)
        .filter(hasAvailableSeats)
        .sort((left, right) => getAulaDateTime(left) - getAulaDateTime(right));
    const studentsWithWeeklyLessons = new Set(weeklyBookings.map((booking) => booking.IdAluno));
    const pendingAmount = formatCurrency(pendingPayments.reduce((sum, pagamento) => sum + Number(pagamento.Custo || 0), 0));

    return {
        roleLabel: 'Encarregado',
        title: 'Agenda dos educandos',
        welcome: '',
        note: pendingPayments.length > 0
            ? `Tem ${pendingPayments.length} pagamento(s) pendente(s) por liquidar.`
            : weeklyBookings.length > 0
                ? `Esta semana existem ${weeklyBookings.length} aula(s) marcadas para os seus educandos.`
                : availableLessons.length > 0
                    ? `Existem ${availableLessons.length} aula(s) regulares disponíveis para inscrição.`
                    : '',
        weekLabel: getWeekRangeLabel(start),
        stats: [
            { title: 'Aulas hoje', value: todayBookings.length, icon: 'HJ', tone: 'blue' },
            { title: 'Aulas esta semana', value: weeklyBookings.length, icon: 'CA', tone: 'green' },
            { title: 'Valor pendente', value: pendingAmount, icon: 'VP', tone: 'purple' },
            { title: 'Pagamentos pendentes', value: pendingPayments.length, icon: 'PG', tone: 'amber' }
        ],
        showQuick: false,
        quickTitle: 'Conta e semana',
        quick: [
            ['Próxima aula', nextBookedLesson ? getUpcomingLabel(getBookingDateTime(nextBookedLesson)) : 'Sem aulas futuras'],
            ['Educandos com aula esta semana', studentsWithWeeklyLessons.size],
            ['Valor pendente', pendingAmount],
            ['Aulas regulares com vagas', availableLessons.length]
        ],
        showActivity: false,
        activityTitle: 'Aulas em que estão inscritos',
        activity: [
            ...pendingPayments.slice(0, 1).map((pagamento) => createActivity(
                `Pagamento pendente de ${formatCurrency(pagamento.Custo)}`,
                pagamento.PrazoPagamento ? `Prazo ${formatDate(pagamento.PrazoPagamento)}` : 'A liquidar',
                'notification'
            )),
            ...futureBookings.slice(0, 3).map((booking) => createActivity(
                `${booking.studentName} em ${booking.Aula?.EstiloDanca?.Nome || 'aula'}`,
                getUpcomingLabel(getBookingDateTime(booking)),
                'booking'
            ))
        ].slice(0, 4),
        scheduleTitle: 'Agenda da semana',
        scheduleSubtitle: 'Aulas já marcadas para os seus educandos nesta semana.',
        scheduleDays: buildScheduleDays(
            weeklyBookings.map((booking) => buildBookingScheduleEntry(booking, booking.studentName)),
            start
        ),
        scheduleEmpty: 'Não existem aulas marcadas para os seus educandos nesta semana.'
    };
};

const Dashboard = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dashboard, setDashboard] = useState(emptyDashboard);

    const permission = user?.Permissoes;

    useEffect(() => {
        const loadDashboard = async () => {
            setLoading(true);
            setError('');

            try {
                if (permission === PERMISSOES.DIRECAO) {
                    const [aulas, estudios, pagamentos] = await Promise.all([
                        getAulas(),
                        getEstudios(),
                        getPagamentos()
                    ]);

                    setDashboard(buildDirectorDashboard({
                        aulas: aulas || [],
                        estudios: estudios || [],
                        pagamentos: pagamentos || []
                    }));
                    return;
                }

                if (permission === PERMISSOES.PROFESSOR) {
                    const aulas = await getAulas();
                    setDashboard(buildTeacherDashboard({ aulas: aulas || [], user }));
                    return;
                }

                if (permission === PERMISSOES.ENCARREGADO) {
                    const [aulas, students, pagamentosEncarregado] = await Promise.all([
                        getAulas(),
                        getAlunosEncarregado(),
                        getPagamentosEncarregado()
                    ]);

                    const bookingBundles = await Promise.all(
                        (students || []).map(async (student) => {
                            const bookings = await getMarcacoesEncarregado(student.IdAluno);
                            return (bookings || []).map((booking) => ({
                                ...booking,
                                studentName: getStudentName(student)
                            }));
                        })
                    );

                    setDashboard(buildGuardianDashboard({
                        aulas: aulas || [],
                        pagamentos: pagamentosEncarregado || [],
                        studentBookings: bookingBundles.flat()
                    }));
                    return;
                }

                setDashboard(emptyDashboard);
            } catch (err) {
                setError(err.message || 'Não foi possível carregar o dashboard.');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [permission, user]);

    const safeDashboard = useMemo(() => dashboard || emptyDashboard, [dashboard]);
    const hasScheduleEntries = safeDashboard.scheduleDays.some((day) => day.items.length > 0);

    return (
        <div className="dashboard-page">
            <section className="dashboard-card dashboard-hero">
                <div className="dashboard-hero-media" aria-hidden="true">
                    <img
                        className="dashboard-hero-image"
                        src={dashboardHeroImage}
                        alt=""
                    />
                </div>
                <div className="dashboard-hero-scrim" />

                <div className="dashboard-hero-content">
                    <div>
                        <p className="dashboard-eyebrow">{safeDashboard.roleLabel}</p>
                        <h1>{safeDashboard.title}</h1>
                        {safeDashboard.welcome && (
                            <p className="dashboard-subtitle dashboard-subtitle--hero">{safeDashboard.welcome}</p>
                        )}
                        {safeDashboard.note && <p className="dashboard-note">{safeDashboard.note}</p>}
                    </div>

                    {safeDashboard.weekLabel && (
                        <div className="dashboard-hero-meta">
                            <span>{safeDashboard.weekLabel}</span>
                            <span>Visão inicial da semana</span>
                        </div>
                    )}
                </div>
            </section>

            {error && <div className="dashboard-banner dashboard-banner--error">{error}</div>}

            {loading ? (
                <section className="dashboard-card dashboard-loading">
                    <p>A carregar o dashboard...</p>
                </section>
            ) : (
                <>
                    <div className="dashboard-stats">
                        {safeDashboard.stats.map((stat) => (
                            <article key={stat.title} className="dashboard-card dashboard-stat-card">
                                <div>
                                    <p className="dashboard-stat-title">{stat.title}</p>
                                    <p className="dashboard-stat-value">{stat.value}</p>
                                </div>
                                <div className={`dashboard-stat-icon dashboard-stat-icon--${stat.tone}`}>{stat.icon}</div>
                            </article>
                        ))}
                    </div>

                    {(safeDashboard.showQuick || safeDashboard.showActivity) && (
                        <div className="dashboard-grid">
                            {safeDashboard.showQuick && (
                                <section className="dashboard-card">
                                    <div className="dashboard-card-header">
                                        <h2>{safeDashboard.quickTitle}</h2>
                                        <p>Indicadores rápidos para orientar a semana.</p>
                                    </div>

                                    {safeDashboard.quick.length > 0 ? (
                                        <div className="dashboard-list">
                                            {safeDashboard.quick.map(([label, value]) => (
                                                <div key={label} className="dashboard-list-row">
                                                    <span>{label}</span>
                                                    <strong>{value}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="dashboard-list dashboard-list-empty">
                                            <p>Sem indicadores adicionais para apresentar.</p>
                                        </div>
                                    )}
                                </section>
                            )}

                            {safeDashboard.showActivity && (
                                <section className="dashboard-card">
                                    <div className="dashboard-card-header">
                                        <h2>{safeDashboard.activityTitle}</h2>
                                        <p>Ações e acontecimentos que merecem atenção imediata.</p>
                                    </div>

                                    {safeDashboard.activity.length > 0 ? (
                                        <div className="dashboard-activity">
                                            {safeDashboard.activity.map((item, index) => (
                                                <div key={`${item.action}-${item.when}-${index}`} className="dashboard-activity-row">
                                                    <span className={`dashboard-dot dashboard-dot--${item.type || 'notification'}`} />
                                                    <div className="dashboard-activity-copy">
                                                        <p>{item.action}</p>
                                                        <small>{item.when}</small>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="dashboard-list dashboard-list-empty">
                                            <p>Sem ações pendentes neste momento.</p>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    )}

                    <section className="dashboard-card dashboard-week-card">
                        <div className="dashboard-card-header">
                            <h2>{safeDashboard.scheduleTitle}</h2>
                            <p>{safeDashboard.scheduleSubtitle}</p>
                        </div>

                        {hasScheduleEntries ? (
                            <div className="dashboard-week-board">
                                {safeDashboard.scheduleDays.map((day) => (
                                    <article key={day.id} className="dashboard-week-day">
                                        <div className="dashboard-week-day-header">
                                            <span>{day.shortLabel}</span>
                                            <strong>{day.dayNumber}</strong>
                                        </div>

                                        <div className="dashboard-week-day-label">{day.label}</div>

                                        <div className="dashboard-week-entries">
                                            {day.items.length === 0 ? (
                                                <div className="dashboard-week-empty">Sem aulas</div>
                                            ) : (
                                                day.items.map((item) => (
                                                    <article key={item.id} className="dashboard-week-item">
                                                        <div className="dashboard-week-item-top">
                                                            <strong>{item.timeLabel}</strong>
                                                            <span className="dashboard-week-item-badge">{item.badge}</span>
                                                        </div>

                                                        <h3>{item.title}</h3>
                                                        <p>{item.metaTop}</p>
                                                        <small>{item.metaBottom}</small>
                                                    </article>
                                                ))
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="dashboard-week-empty-state">
                                <p>{safeDashboard.scheduleEmpty}</p>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default Dashboard;
