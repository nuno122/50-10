import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../utils/permissions';
import {
    getAulas,
    getAlugueres,
    getEstilos,
    getEstudios,
    getInventario,
    getMinhasMarcacoes,
    getPagamentos,
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
    const { start, end } = getWeekRange();
    const activeClasses = aulas.filter((aula) => aula.EstaAtivo);
    const weeklyClasses = activeClasses.filter((aula) => isWithinRange(getAulaDateTime(aula), start, end));
    const pendingValidation = activeClasses.filter((aula) => !aula.ValidacaoDirecao);
    const rentedItems = aluguers.reduce((total, aluguer) => (
        total + (aluguer.ArtigoAluguer || []).reduce((sum, item) => sum + Number(item.Quantidade || 0), 0)
    ), 0);

    const activity = [
        ...activeClasses.slice(0, 2).map((aula) => createActivity(
            `Aula agendada para ${formatDate(aula.Data)}`,
            `${aula.EstiloDanca?.Nome || 'Sem estilo'} · Estudio ${aula.Estudio?.Numero ?? '-'}`,
            'booking'
        )),
        ...pagamentos.slice(0, 1).map((pagamento) => createActivity(
            `Pagamento ${pagamento.EstadoPagamento || 'Pendente'}`,
            pagamento.DataPagamento ? formatDate(pagamento.DataPagamento) : `Prazo ${formatDate(pagamento.PrazoPagamento)}`,
            'validation'
        )),
        ...aluguers.slice(0, 1).map((aluguer) => createActivity(
            `Aluguer ${aluguer.EstadoAluguer || 'Pendente'}`,
            `Entrega ${formatDate(aluguer.DataEntrega)}`,
            'inventory'
        ))
    ].slice(0, 4);

    return {
        welcome: "Bem-vindo ao painel de gestao da Ent'Artes",
        note: '',
        stats: [
            { title: 'Professores Ativos', value: users.filter((user) => user.Permissoes === PERMISSOES.PROFESSOR && user.EstaAtivo).length, icon: 'US', tone: 'blue' },
            { title: 'Aulas Esta Semana', value: weeklyClasses.length, icon: 'CA', tone: 'green' },
            { title: 'Validacoes Pendentes', value: pendingValidation.length, icon: 'EU', tone: 'amber' },
            { title: 'Unidades em Inventario', value: countInventoryUnits(inventory), icon: 'PK', tone: 'purple' }
        ],
        quick: [
            ['Estudios Disponiveis', estudios.length],
            ['Aulas confirmadas pelo professor', activeClasses.filter((aula) => aula.ConfirmacaoProfessor).length],
            ['Pagamentos pendentes', pagamentos.filter((pagamento) => pagamento.EstadoPagamento !== 'Pago').length],
            ['Figurinos alugados', rentedItems]
        ],
        activity
    };
};

const buildTeacherDashboard = ({ aulas, user }) => {
    const { start, end } = getWeekRange();
    const ownClasses = aulas.filter((aula) => aula.IdProfessor === user?.Id && aula.EstaAtivo);
    const weeklyClasses = ownClasses.filter((aula) => isWithinRange(getAulaDateTime(aula), start, end));
    const uniqueStudents = new Set(ownClasses.flatMap((aula) => (aula.Marcacao || []).map((item) => item.IdAluno)));
    const totalHours = weeklyClasses.reduce((sum, aula) => sum + getDurationMinutes(aula), 0) / 60;
    const nextClass = [...ownClasses]
        .map((aula) => ({ aula, date: getAulaDateTime(aula) }))
        .filter((entry) => entry.date > new Date())
        .sort((a, b) => a.date - b.date)[0];

    return {
        welcome: 'Gerencie as suas aulas e disponibilidade',
        note: '',
        stats: [
            { title: 'Aulas Esta Semana', value: weeklyClasses.length, icon: 'CA', tone: 'blue' },
            { title: 'Alunos Totais', value: uniqueStudents.size, icon: 'US', tone: 'green' },
            { title: 'Horas Agendadas', value: totalHours.toFixed(1), icon: 'CL', tone: 'purple' },
            { title: 'Por Validar na Direcao', value: ownClasses.filter((aula) => !aula.ValidacaoDirecao).length, icon: 'RQ', tone: 'amber' }
        ],
        quick: [
            ['Aulas Hoje', ownClasses.filter((aula) => formatDate(aula.Data) === formatDate(new Date())).length],
            ['Proxima Aula', nextClass ? getUpcomingLabel(nextClass.date) : 'Sem aula futura'],
            ['Turmas Ativas', ownClasses.length],
            ['Inscricoes ativas', ownClasses.reduce((sum, aula) => sum + (aula.Marcacao || []).length, 0)]
        ],
        activity: [...ownClasses]
            .sort((a, b) => getAulaDateTime(b) - getAulaDateTime(a))
            .slice(0, 4)
            .map((aula) => createActivity(
                `${aula.EstiloDanca?.Nome || 'Aula'} em Estudio ${aula.Estudio?.Numero ?? '-'}`,
                getUpcomingLabel(getAulaDateTime(aula)),
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
    const thisMonth = new Date();

    return {
        welcome: `A agenda de danca de ${user?.Nome || 'Aluno'}`,
        note: '',
        stats: [
            { title: 'Aulas Inscritas', value: activeBookings.length, icon: 'CA', tone: 'blue' },
            { title: 'Proxima Aula', value: nextBooking ? getUpcomingLabel(nextBooking.date) : 'Sem aula', icon: 'CL', tone: 'green' },
            { title: 'Pagamentos Pendentes', value: pendingPayments.length, icon: 'EU', tone: 'amber' },
            { title: 'Professores', value: uniqueTeachers.size, icon: 'US', tone: 'purple' }
        ],
        quick: [
            ['Aulas Este Mes', ownClasses.filter((aula) => {
                const date = new Date(aula.Data);
                return date.getMonth() === thisMonth.getMonth() && date.getFullYear() === thisMonth.getFullYear();
            }).length],
            ['Estilos de Danca', new Set(ownClasses.map((aula) => aula.EstiloDanca?.Nome || aula.IdEstiloDanca)).size],
            ['Estudios Frequentados', new Set(ownClasses.map((aula) => aula.IdEstudio)).size],
            ['Valor Pendente', formatCurrency(pendingPayments.reduce((sum, pagamento) => sum + Number(pagamento.Custo || 0), 0))]
        ],
        activity: futureBookings.slice(0, 4).map(({ aula, date }) => createActivity(
            `${aula.EstiloDanca?.Nome || 'Aula'} agendada`,
            getUpcomingLabel(date),
            'booking'
        ))
    };
};

const buildGuardianDashboard = ({ aluguers, pagamentos, aulas, estilos, inventory, user }) => {
    const ownRentals = aluguers.filter((aluguer) => aluguer.IdUtilizador === user?.Id || aluguer.Utilizador?.IdUtilizador === user?.Id);
    const ownRentalIds = new Set(ownRentals.map((aluguer) => aluguer.IdAluguer));
    const ownPayments = pagamentos.filter((pagamento) => ownRentalIds.has(pagamento.IdAluguer) || ownRentalIds.has(pagamento.Aluguer?.IdAluguer));
    const nextClass = [...aulas]
        .filter((aula) => aula.EstaAtivo)
        .map((aula) => ({ aula, date: getAulaDateTime(aula) }))
        .filter((entry) => entry.date > new Date())
        .sort((a, b) => a.date - b.date)[0];
    const today = new Date();

    return {
        welcome: 'Acompanhe a sua conta e a oferta atual da escola',
        note: '',
        stats: [
            { title: 'Alugueres da Sua Conta', value: ownRentals.length, icon: 'PK', tone: 'purple' },
            { title: 'Pagamentos Pendentes', value: ownPayments.filter((pagamento) => pagamento.EstadoPagamento !== 'Pago').length, icon: 'EU', tone: 'amber' },
            { title: 'Proxima Aula Disponivel', value: nextClass ? getUpcomingLabel(nextClass.date) : 'Sem aula', icon: 'CA', tone: 'blue' },
            { title: 'Estilos Disponiveis', value: estilos.length, icon: 'US', tone: 'green' }
        ],
        quick: [
            ['Aulas disponiveis este mes', aulas.filter((aula) => {
                const date = new Date(aula.Data);
                return aula.EstaAtivo && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
            }).length],
            ['Artigos com stock', inventory.filter((article) => (article.TamanhoArtigo || []).some((size) => Number(size.Quantidade || 0) > 0)).length],
            ['Valor pendente da sua conta', formatCurrency(ownPayments.filter((pagamento) => pagamento.EstadoPagamento !== 'Pago').reduce((sum, pagamento) => sum + Number(pagamento.Custo || 0), 0))],
            ['Pedidos de aluguer ativos', ownRentals.filter((aluguer) => aluguer.EstadoAluguer !== 'Entregue').length]
        ],
        activity: [
            ...ownRentals.slice(0, 2).map((aluguer) => createActivity(
                `Aluguer ${aluguer.EstadoAluguer || 'Pendente'}`,
                `Entrega ${formatDate(aluguer.DataEntrega)}`,
                'inventory'
            )),
            ...aulas.slice(0, 2).map((aula) => createActivity(
                `${aula.EstiloDanca?.Nome || 'Aula'} em Estudio ${aula.Estudio?.Numero ?? '-'}`,
                getUpcomingLabel(getAulaDateTime(aula)),
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
                    setDashboard(buildGuardianDashboard({ aluguers, pagamentos, aulas, estilos, inventory, user }));
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
