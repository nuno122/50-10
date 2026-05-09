import React, { useEffect, useMemo, useState } from 'react';
import {
    cancelarMarcacaoEncarregado,
    criarMarcacaoEncarregado,
    getAlunosEncarregado,
    getAulas,
    getMarcacoesEncarregado
} from '../services/api';
import { useNotifications } from '../contexts/NotificationContext';

const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};

const extractTime = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '--:--';
};

const buildLessonDate = (booking) => {
    const lesson = booking.Aula;
    const date = new Date(lesson?.Data);
    if (Number.isNaN(date.getTime())) return new Date(0);

    const [hours, minutes] = extractTime(lesson?.HoraInicio).split(':').map(Number);
    date.setHours(Number(hours || 0), Number(minutes || 0), 0, 0);
    return date;
};

const isFutureBooking = (booking) => buildLessonDate(booking) > new Date();

const buildAulaDate = (aula) => {
    const date = new Date(aula?.Data);
    if (Number.isNaN(date.getTime())) return new Date(0);

    const [hours, minutes] = extractTime(aula?.HoraInicio).split(':').map(Number);
    date.setHours(Number(hours || 0), Number(minutes || 0), 0, 0);
    return date;
};

const isFutureRegularLesson = (aula) => (
    aula &&
    aula.EstaAtivo !== false &&
    (aula.TipoAula || 'Regular') === 'Regular' &&
    buildAulaDate(aula) > new Date()
);

const hasFreeSeats = (aula) => (
    (aula.Marcacao || []).filter((marcacao) => marcacao.EstaAtivo !== false).length < Number(aula.CapacidadeMaxima || 0)
);

const isWithin24Hours = (booking) => {
    const diff = buildLessonDate(booking).getTime() - Date.now();
    return diff > 0 && diff < (24 * 60 * 60 * 1000);
};

const getStatusMeta = (booking) => {
    if (booking.EstaAtivo === false) {
        return { label: 'Cancelada', tone: 'danger' };
    }

    switch (booking.EstadoCancelamento) {
        case 'Pendente':
            return { label: 'Cancelamento pendente', tone: 'warning' };
        case 'RejeitadoDirecao':
            return { label: 'Cancelamento rejeitado', tone: 'info' };
        case 'AprovadoAutomatico':
        case 'AprovadoDirecao':
            return { label: 'Cancelada', tone: 'danger' };
        default:
            return { label: 'Ativa', tone: 'success' };
    }
};

const GuardianLessons = () => {
    const { notify } = useNotifications();
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [bookings, setBookings] = useState([]);
    const [availableLessons, setAvailableLessons] = useState([]);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadStudents = async () => {
        setLoading(true);
        setError('');

        try {
            const data = await getAlunosEncarregado();
            setStudents(data || []);
            if ((data || []).length > 0) {
                setSelectedStudentId((current) => current || data[0].IdAluno);
            }
        } catch (err) {
            setError(err.message || 'Não foi possível carregar os educandos.');
        } finally {
            setLoading(false);
        }
    };

    const loadBookings = async (idAluno) => {
        if (!idAluno) {
            setBookings([]);
            setAvailableLessons([]);
            return;
        }

        try {
            const [bookingsData, aulasData] = await Promise.all([
                getMarcacoesEncarregado(idAluno),
                getAulas()
            ]);

            const data = bookingsData || [];
            const futureBookings = (data || [])
                .filter(isFutureBooking)
                .sort((left, right) => buildLessonDate(left) - buildLessonDate(right));
            setBookings(futureBookings);

            const bookedLessonIds = new Set(
                (data || [])
                    .filter((booking) => booking.EstaAtivo !== false)
                    .map((booking) => booking.IdAula)
            );

            const lessons = (aulasData || [])
                .filter(isFutureRegularLesson)
                .filter(hasFreeSeats)
                .filter((aula) => !bookedLessonIds.has(aula.IdAula))
                .sort((left, right) => buildAulaDate(left) - buildAulaDate(right));

            setAvailableLessons(lessons);
        } catch (err) {
            setError(err.message || 'Não foi possível carregar as aulas do educando.');
        }
    };

    useEffect(() => {
        loadStudents();
    }, []);

    useEffect(() => {
        loadBookings(selectedStudentId);
    }, [selectedStudentId]);

    const selectedStudent = useMemo(
        () => students.find((student) => student.IdAluno === selectedStudentId),
        [students, selectedStudentId]
    );

    const openCancellationModal = (booking) => {
        setSelectedBooking(booking);
        setCancelReason('');
        setError('');
        setFeedback('');
    };

    const handleRequestCancellation = async () => {
        if (!selectedBooking) return;

        setSubmitting(true);
        setError('');
        setFeedback('');

        try {
            const result = await cancelarMarcacaoEncarregado(selectedBooking.IdMarcacao, cancelReason);
            setFeedback(result?.mensagem || 'Pedido de cancelamento enviado.');
            notify({
                title: 'Cancelamento registado',
                message: result?.mensagem || 'O pedido de cancelamento foi enviado com sucesso.',
                tone: 'success'
            });
            setSelectedBooking(null);
            await loadBookings(selectedStudentId);
        } catch (err) {
            setError(err.message || 'Não foi possível processar o cancelamento.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEnroll = async (idAula) => {
        if (!selectedStudentId || !idAula) return;

        setSubmitting(true);
        setError('');
        setFeedback('');

        try {
            const result = await criarMarcacaoEncarregado({
                IdAluno: selectedStudentId,
                IdAula: idAula
            });
            setFeedback(result?.mensagem || 'Inscrição efetuada com sucesso.');
            notify({
                title: 'Marcação criada',
                message: result?.mensagem || 'O educando foi inscrito com sucesso na aula.',
                tone: 'success'
            });
            await loadBookings(selectedStudentId);
        } catch (err) {
            setError(err.message || 'Não foi possível efetuar a inscrição.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="guardian-lessons-page">
            <div className="guardian-lessons-header">
                <div>
                    <p className="guardian-lessons-eyebrow">Encarregado</p>
                    <h1>Aulas e cancelamentos</h1>
                    <p className="guardian-lessons-subtitle">
                        Consulte as próximas aulas do educando e envie pedidos de cancelamento quando necessário.
                    </p>
                </div>
            </div>

            {error && <div className="guardian-lessons-banner guardian-lessons-banner--error">{error}</div>}
            {feedback && <div className="guardian-lessons-banner guardian-lessons-banner--success">{feedback}</div>}

            <section className="guardian-lessons-card guardian-lessons-toolbar">
                <label className="guardian-lessons-field">
                    <span>Educando</span>
                    <select
                        value={selectedStudentId}
                        onChange={(event) => setSelectedStudentId(event.target.value)}
                        disabled={students.length === 0}
                    >
                        {students.length === 0 ? (
                            <option value="">Sem educandos associados</option>
                        ) : (
                            students.map((student) => (
                                <option key={student.IdAluno} value={student.IdAluno}>
                                    {student.Nome}
                                </option>
                            ))
                        )}
                    </select>
                </label>

                {selectedStudent && (
                    <div className="guardian-lessons-student-note">
                        <strong>{selectedStudent.Nome}</strong>
                        <span>{selectedStudent.RelacaoParental}</span>
                    </div>
                )}
            </section>

            {loading ? (
                <section className="guardian-lessons-card guardian-lessons-empty">
                    <p>A carregar dados...</p>
                </section>
            ) : (
                <>
                    <section className="guardian-lessons-card guardian-lessons-list">
                        <div className="guardian-lessons-modal-header">
                            <div>
                                <p className="guardian-lessons-eyebrow">Inscrição</p>
                                <h2>Aulas disponíveis</h2>
                            </div>
                            <span className="guardian-lessons-status guardian-lessons-status--info">
                                {availableLessons.length}
                            </span>
                        </div>

                        {availableLessons.length === 0 ? (
                            <div className="guardian-lessons-empty">
                                <p className="guardian-lessons-empty-title">Sem aulas disponíveis</p>
                                <p>Quando existirem aulas regulares com vaga, vão aparecer aqui.</p>
                            </div>
                        ) : (
                            <div className="guardian-lessons-grid">
                                {availableLessons.map((lesson) => (
                                    <article key={lesson.IdAula} className="guardian-lessons-item">
                                        <div className="guardian-lessons-item-top">
                                            <strong>{lesson.EstiloDanca?.Nome || 'Aula'}</strong>
                                            <span className="guardian-lessons-badge guardian-lessons-badge--info">
                                                Disponivel
                                            </span>
                                        </div>

                                        <div className="guardian-lessons-item-grid">
                                            <div>
                                                <span>Data</span>
                                                <p>{formatDate(lesson.Data)}</p>
                                            </div>
                                            <div>
                                                <span>Horario</span>
                                                <p>{extractTime(lesson.HoraInicio)} - {extractTime(lesson.HoraFim)}</p>
                                            </div>
                                            <div>
                                                <span>Professor</span>
                                                <p>{lesson.Professor?.Utilizador?.NomeCompleto || 'Professor por definir'}</p>
                                            </div>
                                            <div>
                                                <span>Local</span>
                                                <p>{lesson.Estudio?.Numero ? `Estudio ${lesson.Estudio.Numero}` : 'Estudio'}</p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className="inventory-primary-button"
                                            onClick={() => handleEnroll(lesson.IdAula)}
                                            disabled={submitting}
                                        >
                                            Inscrever educando
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="guardian-lessons-card guardian-lessons-list">
                        <div className="guardian-lessons-modal-header">
                            <div>
                                <p className="guardian-lessons-eyebrow">Agenda</p>
                                <h2>Aulas Futuras</h2>
                            </div>
                            <span className="guardian-lessons-status guardian-lessons-status--success">
                                {bookings.length}
                            </span>
                        </div>

                        {bookings.length === 0 ? (
                            <div className="guardian-lessons-empty">
                                <p className="guardian-lessons-empty-title">Sem aulas futuras</p>
                                <p>Quando existirem aulas agendadas para o educando, vão aparecer aqui.</p>
                            </div>
                        ) : (
                            <div className="guardian-lessons-grid">
                                {bookings.map((booking) => {
                                    const lesson = booking.Aula;
                                    const status = getStatusMeta(booking);
                                    const canCancel = booking.EstaAtivo !== false && booking.EstadoCancelamento !== 'Pendente';

                                    return (
                                        <article key={booking.IdMarcacao} className="guardian-lessons-item">
                                            <div className="guardian-lessons-item-top">
                                                <strong>{lesson?.EstiloDanca?.Nome || 'Aula'}</strong>
                                                <span className={`guardian-lessons-badge guardian-lessons-badge--${status.tone}`}>
                                                    {status.label}
                                                </span>
                                            </div>

                                            <div className="guardian-lessons-item-grid">
                                                <div>
                                                    <span>Data</span>
                                                    <p>{formatDate(lesson?.Data)}</p>
                                                </div>
                                                <div>
                                                    <span>Horario</span>
                                                    <p>{extractTime(lesson?.HoraInicio)} - {extractTime(lesson?.HoraFim)}</p>
                                                </div>
                                                <div>
                                                    <span>Professor</span>
                                                    <p>{lesson?.Professor?.Utilizador?.NomeCompleto || 'Professor por definir'}</p>
                                                </div>
                                                <div>
                                                    <span>Local</span>
                                                    <p>{lesson?.Estudio?.Numero ? `Estudio ${lesson.Estudio.Numero}` : 'Estudio'}</p>
                                                </div>
                                            </div>

                                            {booking.MotivoCancelamento && (
                                                <p className="guardian-lessons-subtitle">
                                                    Motivo registado: {booking.MotivoCancelamento}
                                                </p>
                                            )}

                                            {canCancel && (
                                                <button
                                                    type="button"
                                                    className="inventory-secondary-button"
                                                    onClick={() => openCancellationModal(booking)}
                                                >
                                                    {isWithin24Hours(booking) ? 'Pedir Cancelamento' : 'Cancelar Aula'}
                                                </button>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}

            {selectedBooking && (
                <div className="guardian-lessons-modal-backdrop" onClick={() => setSelectedBooking(null)}>
                    <section className="guardian-lessons-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="guardian-lessons-modal-header">
                            <div>
                                <p className="guardian-lessons-eyebrow">Cancelar Aula</p>
                                <h2>{selectedBooking.Aula?.EstiloDanca?.Nome || 'Aula'}</h2>
                            </div>
                            <button type="button" className="inventory-secondary-button" onClick={() => setSelectedBooking(null)}>
                                Fechar
                            </button>
                        </div>

                        <div className="guardian-lessons-detail-grid">
                            <div>
                                <span>Data</span>
                                <p>{formatDate(selectedBooking.Aula?.Data)}</p>
                            </div>
                            <div>
                                <span>Horario</span>
                                <p>{extractTime(selectedBooking.Aula?.HoraInicio)} - {extractTime(selectedBooking.Aula?.HoraFim)}</p>
                            </div>
                            <div>
                                <span>Professor</span>
                                <p>{selectedBooking.Aula?.Professor?.Utilizador?.NomeCompleto || 'Professor por definir'}</p>
                            </div>
                            <div>
                                <span>Regra</span>
                                <p>
                                    {isWithin24Hours(selectedBooking)
                                        ? 'Faltam menos de 24h: a Direção terá de validar.'
                                        : 'Com 24h ou mais, o cancelamento e aprovado automaticamente.'}
                                </p>
                            </div>
                        </div>

                        <label className="guardian-lessons-field">
                            <span>Motivo do cancelamento</span>
                            <textarea
                                rows="4"
                                value={cancelReason}
                                placeholder="Explique brevemente o motivo do cancelamento..."
                                onChange={(event) => setCancelReason(event.target.value)}
                            />
                        </label>

                        <div className="guardian-lessons-actions">
                            <button type="button" className="inventory-secondary-button" onClick={() => setSelectedBooking(null)}>
                                Fechar
                            </button>
                            <button
                                type="button"
                                className="inventory-primary-button"
                                onClick={handleRequestCancellation}
                                disabled={submitting}
                            >
                                {submitting ? 'A processar...' : 'Confirmar'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default GuardianLessons;
