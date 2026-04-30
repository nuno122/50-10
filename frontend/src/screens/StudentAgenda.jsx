import React, { useEffect, useMemo, useState } from 'react';
import { getAulas, getMinhasMarcacoes } from '../services/api';

const pad = (value) => String(value).padStart(2, '0');

const extractTime = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '--:--';
};

const getAulaDateTime = (aula) => {
    const date = new Date(aula?.Data);
    if (Number.isNaN(date.getTime())) return new Date(0);

    const [hours, minutes] = extractTime(aula?.HoraInicio).split(':');
    date.setHours(Number(hours || 0), Number(minutes || 0), 0, 0);
    return date;
};

const formatDate = (value) => {
    if (!value) return '-';

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};

const formatWeekday = (value) => {
    if (!value) return '-';

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    const label = new Intl.DateTimeFormat('pt-PT', { weekday: 'long' }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatTimeRange = (aula) => `${extractTime(aula?.HoraInicio)} - ${extractTime(aula?.HoraFim)}`;

const getLessonStatus = (lesson) => {
    if (!lesson.marcacao?.EstaAtivo) {
        return { label: 'Cancelada', tone: 'danger' };
    }

    if (lesson.aula?.ValidacaoDirecao) {
        return { label: 'Validada', tone: 'success' };
    }

    if (lesson.aula?.ConfirmacaoProfessor) {
        return { label: 'Aguarda direcao', tone: 'warning' };
    }

    return { label: 'Aguarda professor', tone: 'muted' };
};

const getPaymentStatus = (lesson) => {
    const payment = (lesson.marcacao?.Pagamento || [])[0];
    if (!payment) return null;

    if (payment.EstadoPagamento === 'Pago') {
        return { label: 'Pagamento pago', tone: 'success' };
    }

    if (payment.EstadoPagamento === 'Pendente') {
        return { label: 'Pagamento pendente', tone: 'warning' };
    }

    return { label: `Pagamento ${payment.EstadoPagamento || 'sem estado'}`, tone: 'muted' };
};

const getUpcomingLabel = (date) => {
    if (!date || Number.isNaN(date.getTime()) || date.getTime() === 0) return 'Sem aula futura';

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const targetDay = new Date(date);
    targetDay.setHours(0, 0, 0, 0);

    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    if (targetDay.getTime() === today.getTime()) return `Hoje as ${time}`;
    if (targetDay.getTime() === tomorrow.getTime()) return `Amanha as ${time}`;
    return `${formatDate(date)} as ${time}`;
};

const StudentAgenda = () => {
    const [lessons, setLessons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadAgenda = async () => {
            setLoading(true);
            setError('');

            try {
                const [marcacoes, aulas] = await Promise.all([
                    getMinhasMarcacoes(),
                    getAulas()
                ]);

                const aulasMap = new Map(aulas.map((aula) => [aula.IdAula, aula]));
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const normalizedLessons = marcacoes
                    .filter((marcacao) => marcacao.EstaAtivo)
                    .map((marcacao) => {
                        const aula = aulasMap.get(marcacao.IdAula) || marcacao.Aula;
                        const date = getAulaDateTime(aula);

                        return {
                            id: marcacao.IdMarcacao,
                            marcacao,
                            aula,
                            date,
                            teacher: aula?.Professor?.Utilizador?.NomeCompleto || 'Professor por definir',
                            studio: aula?.Estudio?.Numero ? `Estudio ${aula.Estudio.Numero}` : 'Estudio por definir',
                            style: aula?.EstiloDanca?.Nome || 'Estilo por definir',
                            time: formatTimeRange(aula)
                        };
                    })
                    .filter((lesson) => lesson.aula && lesson.date >= today)
                    .sort((left, right) => left.date - right.date);

                setLessons(normalizedLessons);
            } catch (err) {
                setError(err.message || 'Nao foi possivel carregar a agenda do aluno.');
            } finally {
                setLoading(false);
            }
        };

        loadAgenda();
    }, []);

    const groupedEntries = useMemo(() => {
        const grouped = lessons.reduce((groups, lesson) => {
            const key = formatDate(lesson.date);
            if (!groups[key]) {
                groups[key] = {
                    dayOfWeek: formatWeekday(lesson.date),
                    lessons: []
                };
            }

            groups[key].lessons.push(lesson);
            return groups;
        }, {});

        return Object.entries(grouped);
    }, [lessons]);

    const nextLesson = lessons[0];
    const pendingPayments = useMemo(() => (
        lessons.reduce((count, lesson) => (
            count + (lesson.marcacao?.Pagamento || []).filter((payment) => payment.EstadoPagamento !== 'Pago').length
        ), 0)
    ), [lessons]);

    return (
        <div className="student-agenda-page">
            <div className="student-agenda-header">
                <div>
                    <p className="student-agenda-eyebrow">Aluno</p>
                    <h1>A Minha Agenda</h1>
                    <p className="student-agenda-subtitle">
                        Consulta as tuas proximas aulas organizadas por data.
                    </p>
                </div>

                <div className="student-agenda-pill">
                    <strong>{lessons.length}</strong>
                    <span>Aulas agendadas</span>
                </div>
            </div>

            {error && <div className="student-agenda-banner student-agenda-banner--error">{error}</div>}

            <div className="student-agenda-stats">
                <article className="student-agenda-card student-agenda-stat">
                    <div>
                        <p>Proxima Aula</p>
                        <strong>{nextLesson ? getUpcomingLabel(nextLesson.date) : 'Sem aula futura'}</strong>
                    </div>
                    <span>AG</span>
                </article>

                <article className="student-agenda-card student-agenda-stat">
                    <div>
                        <p>Pagamentos Pendentes</p>
                        <strong>{pendingPayments}</strong>
                    </div>
                    <span>PG</span>
                </article>

                <article className="student-agenda-card student-agenda-stat">
                    <div>
                        <p>Estilos Marcados</p>
                        <strong>{new Set(lessons.map((lesson) => lesson.style)).size}</strong>
                    </div>
                    <span>DN</span>
                </article>
            </div>

            <section className="student-agenda-card student-agenda-main-card">
                <div className="student-agenda-card-header">
                    <div>
                        <h2>Proximas Aulas</h2>
                        <p>Cronograma das tuas marcacoes reais organizadas por data.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="student-agenda-empty">
                        <p>A carregar agenda...</p>
                    </div>
                ) : groupedEntries.length === 0 ? (
                    <div className="student-agenda-empty">
                        <p className="student-agenda-empty-title">Sem aulas agendadas</p>
                        <p className="student-agenda-empty-copy">
                            Quando existirem novas marcacoes ativas, vao aparecer aqui automaticamente.
                        </p>
                    </div>
                ) : (
                    <div className="student-agenda-timeline">
                        {groupedEntries.map(([date, group]) => (
                            <section key={date} className="student-agenda-day">
                                <div className="student-agenda-day-header">
                                    <div className="student-agenda-day-marker">DT</div>
                                    <div>
                                        <h3>{group.dayOfWeek}</h3>
                                        <p>{date}</p>
                                    </div>
                                </div>

                                <div className="student-agenda-day-list">
                                    {group.lessons.map((lesson) => {
                                        const status = getLessonStatus(lesson);
                                        const payment = getPaymentStatus(lesson);

                                        return (
                                            <article key={lesson.id} className="student-agenda-lesson">
                                                <div className="student-agenda-lesson-grid">
                                                    <div className="student-agenda-meta">
                                                        <span className="student-agenda-meta-icon student-agenda-meta-icon--blue">HR</span>
                                                        <div>
                                                            <p>Horario</p>
                                                            <strong>{lesson.time}</strong>
                                                        </div>
                                                    </div>

                                                    <div className="student-agenda-meta">
                                                        <span className="student-agenda-meta-icon student-agenda-meta-icon--green">ES</span>
                                                        <div>
                                                            <p>Sala / Estudio</p>
                                                            <strong>{lesson.studio}</strong>
                                                        </div>
                                                    </div>

                                                    <div className="student-agenda-meta">
                                                        <span className="student-agenda-meta-icon student-agenda-meta-icon--violet">DN</span>
                                                        <div>
                                                            <p>Estilo de Danca</p>
                                                            <strong>{lesson.style}</strong>
                                                        </div>
                                                    </div>

                                                    <div className="student-agenda-meta">
                                                        <span className="student-agenda-meta-icon student-agenda-meta-icon--amber">PR</span>
                                                        <div>
                                                            <p>Professor</p>
                                                            <strong>{lesson.teacher}</strong>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="student-agenda-badges">
                                                    <span className={`student-agenda-badge student-agenda-badge--${status.tone}`}>
                                                        {status.label}
                                                    </span>
                                                    {payment && (
                                                        <span className={`student-agenda-badge student-agenda-badge--${payment.tone}`}>
                                                            {payment.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default StudentAgenda;
