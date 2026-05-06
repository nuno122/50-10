import React, { useEffect, useMemo, useState } from 'react';
import { cancelarMarcacaoEncarregado, getAlunosEncarregado, getMarcacoesEncarregado } from '../services/api';

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
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [bookings, setBookings] = useState([]);
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
            setError(err.message || 'Nao foi possivel carregar os educandos.');
        } finally {
            setLoading(false);
        }
    };

    const loadBookings = async (idAluno) => {
        if (!idAluno) {
            setBookings([]);
            return;
        }

        try {
            const data = await getMarcacoesEncarregado(idAluno);
            const futureBookings = (data || [])
                .filter(isFutureBooking)
                .sort((left, right) => buildLessonDate(left) - buildLessonDate(right));
            setBookings(futureBookings);
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar as aulas do educando.');
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
            setSelectedBooking(null);
            await loadBookings(selectedStudentId);
        } catch (err) {
            setError(err.message || 'Nao foi possivel processar o cancelamento.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="guardian-lessons-page">
            <div className="guardian-lessons-header">
                <div>
                    <p className="guardian-lessons-eyebrow">Encarregado</p>
                    <h1>Aulas e Cancelamentos</h1>
                    <p className="guardian-lessons-subtitle">
                        Consulte as proximas aulas do educando e envie pedidos de cancelamento quando necessario.
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
                            <option value="">Sem alunos associados</option>
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
            ) : bookings.length === 0 ? (
                <section className="guardian-lessons-card guardian-lessons-empty">
                    <p className="guardian-lessons-empty-title">Sem aulas futuras</p>
                    <p>Quando existirem aulas agendadas para o educando, vao aparecer aqui.</p>
                </section>
            ) : (
                <section className="guardian-lessons-card guardian-lessons-list">
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
                </section>
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
                                        ? 'Faltam menos de 24h: a Direcao tera de validar.'
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
