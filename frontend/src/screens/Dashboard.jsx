import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../utils/permissions';
import {
    getAulas,
    getAlugueres,
    getAlunosEncarregado,
    getEstilos,
    getEstudios,
    getInventario,
    getMinhasMarcacoes,
    getPagamentos,
    getPagamentosEncarregado,
    getUtilizadores
} from '../services/api';

const emptyDashboard = {
    welcome: "Bem-vindo a Ent'Artes",
    note: '',
    stats: [],
    quick: [],
    activity: []
};

const pad = (value) => String(value).padStart(2, '0');

const formatDate = (value) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('pt-PT').format(new Date(value));
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
}).format(Number(value || 0));

const extractTime = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : { hours: 0, minutes: 0 };
};

const getAulaDateTime = (aula) => {
    const date = new Date(aula?.Data);
    if (Number.isNaN(date.getTime())) return new Date(0);

    const { hours, minutes } = extractTime(aula?.HoraInicio);
    date.setHours(hours, minutes, 0, 0);
    return date;
};

const getDurationMinutes = (aula) => {
    const start = extractTime(aula?.HoraInicio);
    const end = extractTime(aula?.HoraFim);
    return Math.max(((end.hours * 60) + end.minutes) - ((start.hours * 60) + start.minutes), 0);
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

const isWithinRange = (date, start, end) => date >= start && date < end;

const isSameDay = (leftValue, rightValue) => {
    const left = new Date(leftValue);
    const right = new Date(rightValue);

    if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false;

    return left.getDate() === right.getDate()
        && left.getMonth() === right.getMonth()
        && left.getFullYear() === right.getFullYear();
};

const isFutureRegularLesson = (aula) => {
    if (!aula || aula.EstaAtivo === false) return false;
    if ((aula.TipoAula || 'Regular') !== 'Regular') return false;
    return getAulaDateTime(aula) > new Date();
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
    if (targetDay.getTime() === tomorrow.getTime()) return `Amanha ${time}`;
    return `${formatDate(target)} ${time}`;
};

const countInventoryUnits = (inventory) => (
    inventory.reduce((total, article) => (
        total + (article.TamanhoArtigo || []).reduce((sum, size) => sum + Number(size.Quantidade || 0), 0)
    ), 0)
);

const createActivity = (action, when, type) => ({ action, when, type });

const buildDirectorDashboard = ({ users, aulas, inventory, estudios, pagamentos, aluguers }) => {
    const now = new Date();
    const { start, end } = getWeekRange();
    const activeClasses = aulas.filter((aula) => aula.EstaAtivo);
    const weeklyClasses = activeClasses.filter((aula) => isWithinRange(getAulaDateTime(aula), start, end));
    const pendingValidation = activeClasses.filter((aula) => !aula.ValidacaoDirecao);
    const pendingTeacherConfirmation = activeClasses.filter((aula) => !aula.ConfirmacaoProfessor);
    const nextClass = [...activeClasses]
        .map((aula) => ({ aula, date: getAulaDateTime(aula) }))
        .filter((entry) => entry.date > now)
        .sort((a, b) => a.date - b.date)[0];
    const overduePayments = pagamentos.filter((pagamento) => (
        pagamento.EstadoPagamento !== 'Pago' &&
        pagamento.PrazoPagamento &&
        new Date(pagamento.PrazoPagamento) < now
    ));
    const rentedItems = aluguers.reduce((total, aluguer) => (
        total + (aluguer.ArtigoAluguer || []).reduce((sum, item) => sum + Number(item.Quantidade || 0), 0)
    ), 0);

    const activity = [
        ...[...activeClasses]
            .map((aula) => ({ aula, date: getAulaDateTime(aula) }))
            .filter((entry) => entry.date > now)
            .sort((a, b) => a.date - b.date)
            .slice(0, 2)
            .map(({ aula, date }) => createActivity(
                `${aula.EstiloDanca?.Nome || 'Aula'} em Estudio ${aula.Estudio?.Numero ?? '-'}`,
                getUpcomingLabel(date),
                'booking'
            )),
        ...overduePayments.slice(0, 1).map((pagamento) => createActivity(
            `Pagamento em atraso de ${formatCurrency(pagamento.Custo)}`,
            `Prazo ${formatDate(pagamento.PrazoPagamento)}`,
            'notification'
        )),
        ...pendingValidation.slice(0, 1).map((aula) => createActivity(
            `Aula por validar: ${aula.EstiloDanca?.Nome || 'Sem estilo'}`,
            `${formatDate(aula.Data)} em Estudio ${aula.Estudio?.Numero ?? '-'}`,
            'validation'
        )),
        ...aluguers
            .filter((aluguer) => aluguer.EstadoAluguer !== 'Entregue')
            .sort((a, b) => new Date(a.DataEntrega) - new Date(b.DataEntrega))
            .slice(0, 1)
            .map((aluguer) => createActivity(
                `Aluguer ${aluguer.EstadoAluguer || 'Pendente'}`,
                `Entrega ${formatDate(aluguer.DataEntrega)}`,
                'inventory'
            ))
    ].slice(0, 4);

    return {
        welcome: "Bem-vindo ao painel de gestao da Ent'Artes",
        note: pendingValidation.length > 0
            ? `Tem ${pendingValidation.length} aula(s) por validar e ${pendingTeacherConfirmation.length} a aguardar confirmacao do professor.`
            : overduePayments.length > 0
                ? `Existem ${overduePayments.length} pagamento(s) em atraso para acompanhar.`
                : '',
        stats: [
            { title: 'Professores Ativos', value: users.filter((user) => user.Permissoes === PERMISSOES.PROFESSOR && user.EstaAtivo).length, icon: 'US', tone: 'blue' },
            { title: 'Aulas Esta Semana', value: weeklyClasses.length, icon: 'CA', tone: 'green' },
            { title: 'Validacoes Pendentes', value: pendingValidation.length, icon: 'EU', tone: 'amber' },
            { title: 'Pagamentos em Atraso', value: overduePayments.length, icon: 'PG', tone: 'purple' }
        ],
        quick: [
            ['Proxima aula', nextClass ? getUpcomingLabel(nextClass.date) : 'Sem aula futura'],
            ['Aguardam confirmacao do professor', pendingTeacherConfirmation.length],
            ['Estudios ativos', estudios.length],
            ['Unidades alugadas', rentedItems]
        ],
        activity
    };
};

const buildTeacherDashboard = ({ aulas, user }) => {
    const now = new Date();
    const { start, end } = getWeekRange();
    const ownClasses = aulas.filter((aula) => aula.IdProfessor === user?.Id && aula.EstaAtivo);
    const weeklyClasses = ownClasses.filter((aula) => isWithinRange(getAulaDateTime(aula), start, end));
    const todayClasses = ownClasses.filter((aula) => isSameDay(aula.Data, now));
    const uniqueStudents = new Set(ownClasses.flatMap((aula) => (aula.Marcacao || []).map((item) => item.IdAluno)));
    const totalHours = weeklyClasses.reduce((sum, aula) => sum + getDurationMinutes(aula), 0) / 60;
    const nextClass = [...ownClasses]
        .map((aula) => ({ aula, date: getAulaDateTime(aula) }))
        .filter((entry) => entry.date > now)
        .sort((a, b) => a.date - b.date)[0];
    const pendingDirectorValidation = ownClasses.filter((aula) => aula.ConfirmacaoProfessor && !aula.ValidacaoDirecao);
    const pendingOwnConfirmation = ownClasses.filter((aula) => !aula.ConfirmacaoProfessor && getAulaDateTime(aula) <= now);

    return {
        welcome: 'Gerencie as suas aulas e disponibilidade',
        note: pendingOwnConfirmation.length > 0
            ? `Tem ${pendingOwnConfirmation.length} aula(s) terminadas por confirmar.`
            : pendingDirectorValidation.length > 0
                ? `${pendingDirectorValidation.length} aula(s) suas aguardam validacao da Direcao.`
                : '',
        stats: [
            { title: 'Aulas Hoje', value: todayClasses.length, icon: 'HJ', tone: 'blue' },
            { title: 'Aulas Esta Semana', value: weeklyClasses.length, icon: 'CA', tone: 'green' },
            { title: 'Horas Esta Semana', value: totalHours.toFixed(1), icon: 'CL', tone: 'purple' },
            { title: 'Por Validar na Direcao', value: pendingDirectorValidation.length, icon: 'RQ', tone: 'amber' }
        ],
        quick: [
            ['Proxima aula', nextClass ? getUpcomingLabel(nextClass.date) : 'Sem aula futura'],
            ['Alunos ativos', uniqueStudents.size],
            ['Inscricoes desta semana', weeklyClasses.reduce((sum, aula) => sum + (aula.Marcacao || []).length, 0)],
            ['Aulas concluidas por confirmar', pendingOwnConfirmation.length]
        ],
        activity: [...ownClasses]
            .map((aula) => ({ aula, date: getAulaDateTime(aula) }))
            .sort((a, b) => a.date - b.date)
            .slice(0, 4)
            .map(({ aula, date }) => createActivity(
                `${aula.EstiloDanca?.Nome || 'Aula'} em Estudio ${aula.Estudio?.Numero ?? '-'}`,
                getUpcomingLabel(date),
                'booking'
            ))
    };
};

const buildStudentDashboard = ({ marcacoes, aulas, user }) => {
    const aulasMap = new Map(aulas.map((aula) => [aula.IdAula, aula]));
    const activeBookings = marcacoes.filter((marcacao) => marcacao.EstaAtivo);
    const futureBookings = activeBookings
        .map((marcacao) => {
            const aula = aulasMap.get(marcacao.IdAula) || marcacao.Aula;
            return { marcacao, aula, date: getAulaDateTime(aula) };
        })
        .filter((entry) => entry.aula && entry.date > new Date())
        .sort((a, b) => a.date - b.date);

    const nextBooking = futureBookings[0];
    const pendingPayments = activeBookings.flatMap((marcacao) => marcacao.Pagamento || [])
        .filter((pagamento) => pagamento.EstadoPagamento !== 'Pago');
    const ownClasses = activeBookings.map((marcacao) => aulasMap.get(marcacao.IdAula) || marcacao.Aula).filter(Boolean);
    const uniqueTeachers = new Set(ownClasses.map((aula) => aula.IdProfessor));
    const validatedFutureBookings = futureBookings.filter((entry) => entry.aula?.ValidacaoDirecao);
    const awaitingTeacher = futureBookings.filter((entry) => !entry.aula?.ConfirmacaoProfessor);
    const awaitingDirector = futureBookings.filter((entry) => entry.aula?.ConfirmacaoProfessor && !entry.aula?.ValidacaoDirecao);
    const thisMonth = new Date();

    return {
        welcome: `A agenda de danca de ${user?.Nome || 'Aluno'}`,
        note: awaitingTeacher.length > 0
            ? `Tem ${awaitingTeacher.length} aula(s) futuras ainda por confirmar pelo professor.`
            : awaitingDirector.length > 0
                ? `${awaitingDirector.length} aula(s) tuas aguardam validacao da Direcao.`
                : '',
        stats: [
            { title: 'Proxima Aula', value: nextBooking ? getUpcomingLabel(nextBooking.date) : 'Sem aula', icon: 'CL', tone: 'green' },
            { title: 'Aulas Validadas', value: validatedFutureBookings.length, icon: 'OK', tone: 'blue' },
            { title: 'Pagamentos Pendentes', value: pendingPayments.length, icon: 'EU', tone: 'amber' },
            { title: 'Professores', value: uniqueTeachers.size, icon: 'US', tone: 'purple' }
        ],
        quick: [
            ['Aulas este mes', ownClasses.filter((aula) => {
                const date = new Date(aula.Data);
                return date.getMonth() === thisMonth.getMonth() && date.getFullYear() === thisMonth.getFullYear();
            }).length],
            ['Aguardam professor', awaitingTeacher.length],
            ['Aguardam Direcao', awaitingDirector.length],
            ['Valor pendente', formatCurrency(pendingPayments.reduce((sum, pagamento) => sum + Number(pagamento.Custo || 0), 0))]
        ],
        activity: futureBookings.slice(0, 4).map(({ aula, date }) => createActivity(
            `${aula.EstiloDanca?.Nome || 'Aula'} com ${aula.Professor?.Utilizador?.NomeCompleto || 'professor por definir'}`,
            getUpcomingLabel(date),
            'booking'
        ))
    };
};

const buildGuardianDashboard = ({ aluguers, pagamentos, aulas, inventory, user, students }) => {
    const ownRentals = aluguers.filter((aluguer) => aluguer.IdUtilizador === user?.Id || aluguer.Utilizador?.IdUtilizador === user?.Id);
    const ownPayments = pagamentos || [];
    const pendingPayments = ownPayments.filter((pagamento) => pagamento.EstadoPagamento !== 'Pago');
    const availableLessons = [...aulas]
        .filter((aula) => isFutureRegularLesson(aula))
        .map((aula) => ({ aula, date: getAulaDateTime(aula) }))
        .sort((a, b) => a.date - b.date);
    const nextAvailableClass = availableLessons[0];
    const nextRentalReturn = [...ownRentals]
        .filter((aluguer) => aluguer.EstadoAluguer !== 'Entregue')
        .sort((a, b) => new Date(a.DataEntrega) - new Date(b.DataEntrega))[0];
    const today = new Date();

    return {
        welcome: 'Acompanhe a sua conta e a oferta atual da escola',
        note: pendingPayments.length > 0
            ? `Tem ${pendingPayments.length} pagamento(s) pendente(s) para liquidar.`
            : availableLessons.length > 0
                ? `Existem ${availableLessons.length} aula(s) regular(es) disponiveis para inscricao.`
                : '',
        stats: [
            { title: 'Educandos', value: students.length, icon: 'AL', tone: 'blue' },
            { title: 'Aulas Disponiveis', value: availableLessons.length, icon: 'CA', tone: 'green' },
            { title: 'Pagamentos Pendentes', value: pendingPayments.length, icon: 'EU', tone: 'amber' },
            { title: 'Alugueres Ativos', value: ownRentals.filter((aluguer) => aluguer.EstadoAluguer !== 'Entregue').length, icon: 'PK', tone: 'purple' }
        ],
        quick: [
            ['Proxima aula disponivel', nextAvailableClass ? getUpcomingLabel(nextAvailableClass.date) : 'Sem aula futura'],
            ['Aulas disponiveis este mes', availableLessons.filter(({ aula }) => {
                const date = new Date(aula.Data);
                return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
            }).length],
            ['Valor pendente da conta', formatCurrency(pendingPayments.reduce((sum, pagamento) => sum + Number(pagamento.Custo || 0), 0))],
            ['Proxima devolucao', nextRentalReturn ? formatDate(nextRentalReturn.DataEntrega) : 'Sem devolucoes']
        ],
        activity: [
            ...pendingPayments.slice(0, 2).map((pagamento) => createActivity(
                `Pagamento pendente de ${formatCurrency(pagamento.Custo)}`,
                pagamento.PrazoPagamento ? `Prazo ${formatDate(pagamento.PrazoPagamento)}` : 'A liquidar',
                'notification'
            )),
            ...ownRentals
                .filter((aluguer) => aluguer.EstadoAluguer !== 'Entregue')
                .slice(0, 1)
                .map((aluguer) => createActivity(
                    `Aluguer ${aluguer.EstadoAluguer || 'Pendente'}`,
                    `Entrega ${formatDate(aluguer.DataEntrega)}`,
                    'inventory'
                )),
            ...availableLessons.slice(0, 2).map(({ aula, date }) => createActivity(
                `${aula.EstiloDanca?.Nome || 'Aula'} em Estudio ${aula.Estudio?.Numero ?? '-'}`,
                getUpcomingLabel(date),
                'booking'
            ))
        ].slice(0, 4)
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
                const commonRequests = await Promise.all([
                    getAulas(),
                    getAlugueres(),
                    getEstilos(),
                    getEstudios(),
                    getInventario(),
                    getPagamentos()
                ]);

                const [aulas, aluguers, estilos, estudios, inventory, pagamentos] = commonRequests;

                if (permission === PERMISSOES.DIRECAO) {
                    const users = await getUtilizadores();
                    setDashboard(buildDirectorDashboard({ users, aulas, inventory, estudios, pagamentos, aluguers }));
                } else if (permission === PERMISSOES.PROFESSOR) {
                    setDashboard(buildTeacherDashboard({ aulas, user }));
                } else if (permission === PERMISSOES.ALUNO) {
                    const marcacoes = await getMinhasMarcacoes();
                    setDashboard(buildStudentDashboard({ marcacoes, aulas, user }));
                } else if (permission === PERMISSOES.ENCARREGADO) {
                    const [students, pagamentosEncarregado] = await Promise.all([
                        getAlunosEncarregado(),
                        getPagamentosEncarregado()
                    ]);
                    setDashboard(buildGuardianDashboard({ aluguers, pagamentos: pagamentosEncarregado, aulas, inventory, user, students }));
                } else {
                    setDashboard(emptyDashboard);
                }
            } catch (err) {
                setError(err.message || 'Nao foi possivel carregar o dashboard.');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [permission, user]);

    const safeDashboard = useMemo(() => dashboard || emptyDashboard, [dashboard]);

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">Dashboard</p>
                    <h1>Painel Principal</h1>
                    <p className="dashboard-subtitle">{safeDashboard.welcome}</p>
                    {safeDashboard.note && <p className="dashboard-note">{safeDashboard.note}</p>}
                </div>
            </div>

            {error && <div className="dashboard-banner dashboard-banner--error">{error}</div>}

            {loading ? (
                <section className="dashboard-card dashboard-loading">
                    <p>A carregar dashboard...</p>
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

                    <div className="dashboard-grid">
                        <section className="dashboard-card">
                            <div className="dashboard-card-header">
                                <h2>Informacao Rapida</h2>
                            </div>
                            <div className="dashboard-list">
                                {safeDashboard.quick.map(([label, value]) => (
                                    <div key={label} className="dashboard-list-row">
                                        <span>{label}</span>
                                        <strong>{value}</strong>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="dashboard-card">
                            <div className="dashboard-card-header">
                                <h2>Atividade Recente</h2>
                            </div>
                            <div className="dashboard-activity">
                                {safeDashboard.activity.map((item) => (
                                    <div key={`${item.action}-${item.when}`} className="dashboard-activity-row">
                                        <span className={`dashboard-dot dashboard-dot--${item.type}`} />
                                        <div>
                                            <p>{item.action}</p>
                                            <small>{item.when}</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </>
            )}
        </div>
    );
};

export default Dashboard;
