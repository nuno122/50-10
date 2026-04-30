import React, { useEffect, useMemo, useState } from 'react';
import { getAulas, getPagamentos, validarAulaDirecao } from '../services/api';

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT').format(date);
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

const getDurationMinutes = (aula) => {
    const start = extractTime(aula?.HoraInicio);
    const end = extractTime(aula?.HoraFim);
    return Math.max(((end.hours * 60) + end.minutes) - ((start.hours * 60) + start.minutes), 0);
};

const getLessonDateTime = (aula) => {
    const date = new Date(aula?.Data);
    if (Number.isNaN(date.getTime())) return new Date(0);

    const start = extractTime(aula?.HoraInicio);
    date.setHours(start.hours, start.minutes, 0, 0);
    return date;
};

const getDeadlineDate = (aula) => {
    const lessonDate = getLessonDateTime(aula);
    const deadline = new Date(lessonDate);
    deadline.setHours(deadline.getHours() + 48);
    return deadline;
};

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const calculateTimeRemaining = (deadline, currentTime) => {
    const diff = deadline.getTime() - currentTime.getTime();
    const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
    const minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
    const percentage = Math.max(0, Math.min(100, (diff / (48 * 60 * 60 * 1000)) * 100));

    return {
        hours,
        minutes,
        percentage,
        expired: diff < 0
    };
};

const getValidationLabel = (lesson) => {
    if (lesson.validation.teacher && lesson.validation.director) {
        return { text: 'Completamente validada', tone: 'finance-badge--success' };
    }

    if (lesson.validation.teacher || lesson.validation.director) {
        return { text: 'Parcialmente validada', tone: 'finance-badge--warning' };
    }

    return { text: 'Pendente', tone: 'finance-badge--muted' };
};

const buildPaymentsByLesson = (payments) => {
    const grouped = new Map();

    payments.forEach((payment) => {
        const lessonId = payment.Marcacao?.IdAula || payment.Marcacao?.Aula?.IdAula;
        if (!lessonId) return;

        const current = grouped.get(lessonId) || [];
        current.push(payment);
        grouped.set(lessonId, current);
    });

    return grouped;
};

const buildLessons = (aulas, pagamentos) => {
    const paymentsByLesson = buildPaymentsByLesson(pagamentos);

    return aulas.map((aula) => {
        const lessonPayments = paymentsByLesson.get(aula.IdAula) || [];
        const activeBookings = (aula.Marcacao || []).filter((booking) => booking.EstaAtivo !== false);
        const fallbackAmount = Number(aula.Preco || 0) * activeBookings.length;
        const amount = lessonPayments.length > 0
            ? lessonPayments.reduce((sum, payment) => sum + Number(payment.Custo || 0), 0)
            : fallbackAmount;

        const paid = lessonPayments.length > 0 && lessonPayments.every((payment) => normalizeStatus(payment.EstadoPagamento) === 'pago');

        return {
            id: aula.IdAula,
            rawDate: new Date(aula.Data),
            date: formatDate(aula.Data),
            teacher: aula.Professor?.Utilizador?.NomeCompleto || aula.IdProfessor,
            lessonType: aula.EstiloDanca?.Nome || 'Sem estilo',
            duration: getDurationMinutes(aula),
            amount,
            validation: {
                teacher: Boolean(aula.ConfirmacaoProfessor),
                director: Boolean(aula.ValidacaoDirecao)
            },
            deadlineDate: getDeadlineDate(aula),
            paid,
            studentCount: activeBookings.length,
            payments: lessonPayments
        };
    });
};

const exportLessonsCsv = (lessons) => {
    const header = [
        'IdAula',
        'Data',
        'Professor',
        'Tipo',
        'DuracaoMin',
        'Valor',
        'ProfessorValidou',
        'DirecaoValidou',
        'Prazo48h',
        'Pago',
        'Inscritos'
    ];

    const rows = lessons.map((lesson) => [
        lesson.id,
        lesson.date,
        lesson.teacher,
        lesson.lessonType,
        lesson.duration,
        Number(lesson.amount || 0).toFixed(2),
        lesson.validation.teacher ? 'Sim' : 'Nao',
        lesson.validation.director ? 'Sim' : 'Nao',
        formatDate(lesson.deadlineDate),
        lesson.paid ? 'Sim' : 'Nao',
        lesson.studentCount
    ]);

    const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financeiro-direcao-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
};

const FinanceManagement = () => {
    const [lessons, setLessons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState(null);
    const [submittingId, setSubmittingId] = useState(null);

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [aulas, pagamentos] = await Promise.all([
                getAulas(),
                getPagamentos()
            ]);

            setLessons(buildLessons(aulas, pagamentos));
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar o financeiro.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleSort = (field) => {
        let nextDirection = 'asc';

        if (sortField === field) {
            if (sortDirection === 'asc') nextDirection = 'desc';
            else if (sortDirection === 'desc') {
                setSortField(null);
                setSortDirection(null);
                return;
            }
        }

        setSortField(field);
        setSortDirection(nextDirection);
    };

    const sortedLessons = useMemo(() => {
        if (!sortField || !sortDirection) return lessons;

        const sorted = [...lessons].sort((a, b) => {
            let left = a[sortField];
            let right = b[sortField];

            if (sortField === 'rawDate' || sortField === 'deadlineDate') {
                left = left instanceof Date ? left.getTime() : 0;
                right = right instanceof Date ? right.getTime() : 0;
            } else if (sortField === 'validation') {
                left = (a.validation.teacher ? 1 : 0) + (a.validation.director ? 1 : 0);
                right = (b.validation.teacher ? 1 : 0) + (b.validation.director ? 1 : 0);
            } else if (typeof left === 'string') {
                left = left.toLowerCase();
                right = right.toLowerCase();
            }

            if (left < right) return sortDirection === 'asc' ? -1 : 1;
            if (left > right) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [lessons, sortDirection, sortField]);

    const handleValidateDirector = async (lesson) => {
        setSubmittingId(lesson.id);
        setError('');

        try {
            await validarAulaDirecao(lesson.id);
            setFeedback('Validacao da direcao concluida e pagamentos gerados para as marcacoes ativas.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel validar a aula.');
        } finally {
            setSubmittingId(null);
        }
    };

    const totalValidated = lessons
        .filter((lesson) => lesson.validation.teacher && lesson.validation.director)
        .reduce((sum, lesson) => sum + lesson.amount, 0);

    const totalPending = lessons
        .filter((lesson) => !lesson.validation.teacher || !lesson.validation.director)
        .reduce((sum, lesson) => sum + lesson.amount, 0);

    const totalAmount = lessons.reduce((sum, lesson) => sum + lesson.amount, 0);

    return (
        <div className="finance-page">
            <div className="finance-header">
                <div>
                    <p className="finance-eyebrow">Direcao</p>
                    <h1>Validacao Financeira</h1>
                    <p className="finance-subtitle">
                        Reveja aulas reais, acompanhe o prazo de 48 horas e valide as que ja foram confirmadas pelo professor.
                    </p>
                </div>

                <button
                    type="button"
                    className="finance-button finance-button--success"
                    onClick={() => exportLessonsCsv(sortedLessons)}
                >
                    Exportar CSV
                </button>
            </div>

            {feedback && <div className="finance-banner finance-banner--success">{feedback}</div>}
            {error && <div className="finance-banner finance-banner--error">{error}</div>}

            <div className="finance-layout">
                <section className="finance-main">
                    <div className="finance-table-card">
                        {loading ? (
                            <div className="finance-empty">
                                <p className="finance-empty-title">A carregar aulas...</p>
                                <p className="finance-empty-copy">A preparar a informacao financeira.</p>
                            </div>
                        ) : sortedLessons.length === 0 ? (
                            <div className="finance-empty">
                                <p className="finance-empty-title">Sem aulas para apresentar</p>
                                <p className="finance-empty-copy">Nao existem registos financeiros de aulas neste momento.</p>
                            </div>
                        ) : (
                            <div className="finance-table-wrap">
                                <table className="finance-table">
                                    <thead>
                                        <tr>
                                            <th><button type="button" onClick={() => handleSort('rawDate')}>Data</button></th>
                                            <th><button type="button" onClick={() => handleSort('teacher')}>Professor</button></th>
                                            <th><button type="button" onClick={() => handleSort('lessonType')}>Tipo</button></th>
                                            <th><button type="button" onClick={() => handleSort('duration')}>Duracao</button></th>
                                            <th><button type="button" onClick={() => handleSort('amount')}>Valor</button></th>
                                            <th><button type="button" onClick={() => handleSort('validation')}>Dupla validacao</button></th>
                                            <th><button type="button" onClick={() => handleSort('deadlineDate')}>Prazo (48h)</button></th>
                                            <th>Acoes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedLessons.map((lesson) => {
                                            const status = getValidationLabel(lesson);
                                            const timeRemaining = calculateTimeRemaining(lesson.deadlineDate, currentTime);
                                            const isFullyValidated = lesson.validation.teacher && lesson.validation.director;
                                            const canValidate = lesson.validation.teacher && !lesson.validation.director;

                                            return (
                                                <tr key={lesson.id} className={isFullyValidated ? 'finance-row finance-row--validated' : 'finance-row'}>
                                                    <td>{lesson.date}</td>
                                                    <td>{lesson.teacher}</td>
                                                    <td>{lesson.lessonType}</td>
                                                    <td>{lesson.duration} min</td>
                                                    <td className="finance-cell-strong">{formatCurrency(lesson.amount)}</td>
                                                    <td>
                                                        <div className="finance-status-cell">
                                                            <span className={`finance-badge ${status.tone}`}>{status.text}</span>
                                                            <div className="finance-validation-pairs">
                                                                <span>{lesson.validation.teacher ? 'Prof OK' : 'Prof Pendente'}</span>
                                                                <span>{lesson.validation.director ? 'Dir OK' : 'Dir Pendente'}</span>
                                                            </div>
                                                            {lesson.paid && <span className="finance-badge finance-badge--paid">Pago</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {isFullyValidated ? (
                                                            <span className="finance-badge finance-badge--success">Completo</span>
                                                        ) : (
                                                            <div className="finance-deadline">
                                                                <span className={timeRemaining.expired ? 'finance-deadline-text finance-deadline-text--expired' : ''}>
                                                                    {timeRemaining.expired ? 'Expirado' : `${timeRemaining.hours}h ${timeRemaining.minutes}m`}
                                                                </span>
                                                                <div className="finance-progress">
                                                                    <div
                                                                        className={`finance-progress-bar ${timeRemaining.percentage < 25 ? 'finance-progress-bar--warning' : ''}`}
                                                                        style={{ width: `${timeRemaining.percentage}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {canValidate ? (
                                                            <button
                                                                type="button"
                                                                className="finance-button finance-button--primary"
                                                                onClick={() => handleValidateDirector(lesson)}
                                                                disabled={submittingId === lesson.id}
                                                            >
                                                                {submittingId === lesson.id ? 'A validar...' : 'Aprovar'}
                                                            </button>
                                                        ) : (
                                                            <span className="finance-action-note">
                                                                {lesson.validation.teacher ? 'Sem acao pendente' : 'Aguarda professor'}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>

                <aside className="finance-sidebar">
                    <article className="finance-summary-card finance-summary-card--success">
                        <p>Validado</p>
                        <strong>{formatCurrency(totalValidated)}</strong>
                        <span>{lessons.filter((lesson) => lesson.validation.teacher && lesson.validation.director).length} aulas aprovadas</span>
                    </article>

                    <article className="finance-summary-card finance-summary-card--warning">
                        <p>Pendente Validacao</p>
                        <strong>{formatCurrency(totalPending)}</strong>
                        <span>{lessons.filter((lesson) => !lesson.validation.teacher || !lesson.validation.director).length} aulas pendentes</span>
                    </article>

                    <article className="finance-summary-card finance-summary-card--neutral">
                        <p>Total</p>
                        <strong>{formatCurrency(totalAmount)}</strong>
                        <span>{lessons.length} aulas totais</span>
                    </article>
                </aside>
            </div>
        </div>
    );
};

export default FinanceManagement;
