import React, { useEffect, useMemo, useState } from 'react';
import {
    cancelarMarcacaoEncarregado,
    criarMarcacaoEncarregado,
    getAlunosEncarregado,
    getAulas,
    getMarcacoesEncarregado
} from '../services/api';

const formatDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
};

const getStudioLabel = (lesson) => lesson.Estudio?.Numero ? `Estudio ${lesson.Estudio.Numero}` : 'Estudio';

const GuardianLessons = () => {
    const [lessons, setLessons] = useState([]);
    const [students, setStudents] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadBaseData = async () => {
        setLoading(true);
        setError('');

        try {
            const [aulasData, studentsData] = await Promise.all([
                getAulas(),
                getAlunosEncarregado()
            ]);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const availableLessons = (aulasData || [])
                .filter((lesson) => lesson.EstaAtivo !== false && lesson.ValidacaoDirecao)
                .filter((lesson) => (lesson.TipoAula || 'Regular') === 'Regular')
                .filter((lesson) => {
                    const lessonDate = new Date(lesson.Data);
                    lessonDate.setHours(0, 0, 0, 0);
                    return lessonDate >= today;
                })
                .sort((left, right) => {
                    const leftDate = new Date(`${formatDateKey(left.Data)}T${formatTime(left.HoraInicio)}`);
                    const rightDate = new Date(`${formatDateKey(right.Data)}T${formatTime(right.HoraInicio)}`);
                    return leftDate - rightDate;
                });

            setLessons(availableLessons);
            setStudents(studentsData || []);

            if ((studentsData || []).length > 0) {
                setSelectedStudentId((current) => current || studentsData[0].IdAluno);
            }

            const dates = [...new Set(availableLessons.map((lesson) => formatDateKey(lesson.Data)))];
            if (dates.length > 0) {
                setSelectedDate((current) => current || dates[0]);
            }
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar as aulas.');
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
            setBookings(data || []);
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar as inscricoes.');
        }
    };

    useEffect(() => {
        loadBaseData();
    }, []);

    useEffect(() => {
        loadBookings(selectedStudentId);
    }, [selectedStudentId]);

    const availableDates = useMemo(() => (
        [...new Set(lessons.map((lesson) => formatDateKey(lesson.Data)))]
    ), [lessons]);

    const selectedDateIndex = availableDates.indexOf(selectedDate);

    const bookingsByLesson = useMemo(() => {
        const map = new Map();
        bookings
            .filter((booking) => booking.EstaAtivo !== false)
            .forEach((booking) => {
                map.set(booking.IdAula, booking);
            });
        return map;
    }, [bookings]);

    const dayLessons = useMemo(() => (
        lessons
            .filter((lesson) => formatDateKey(lesson.Data) === selectedDate)
            .map((lesson) => {
                const activeEnrollments = (lesson.Marcacao || []).filter((booking) => booking.EstaAtivo !== false).length;
                const booking = bookingsByLesson.get(lesson.IdAula);

                return {
                    id: lesson.IdAula,
                    date: lesson.Data,
                    time: formatTime(lesson.HoraInicio),
                    studio: getStudioLabel(lesson),
                    teacher: lesson.Professor?.Utilizador?.NomeCompleto || 'Professor por definir',
                    style: lesson.EstiloDanca?.Nome || 'Estilo por definir',
                    capacity: Number(lesson.CapacidadeMaxima || 0),
                    enrolled: activeEnrollments,
                    isEnrolled: Boolean(booking),
                    bookingId: booking?.IdMarcacao || null
                };
            })
    ), [bookingsByLesson, lessons, selectedDate]);

    const lessonsByStudio = useMemo(() => (
        dayLessons.reduce((accumulator, lesson) => {
            if (!accumulator[lesson.studio]) {
                accumulator[lesson.studio] = [];
            }
            accumulator[lesson.studio].push(lesson);
            return accumulator;
        }, {})
    ), [dayLessons]);

    const selectedStudent = students.find((student) => student.IdAluno === selectedStudentId);
    const formattedDay = selectedDate
        ? new Date(selectedDate).toLocaleDateString('pt-PT', { weekday: 'long' })
        : '';
    const formattedDate = selectedDate
        ? new Date(selectedDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

    const prevDate = () => {
        if (selectedDateIndex > 0) {
            setSelectedDate(availableDates[selectedDateIndex - 1]);
        }
    };

    const nextDate = () => {
        if (selectedDateIndex >= 0 && selectedDateIndex < availableDates.length - 1) {
            setSelectedDate(availableDates[selectedDateIndex + 1]);
        }
    };

    const handleEnroll = async () => {
        if (!selectedLesson || !selectedStudentId) return;

        setSubmitting(true);
        setError('');
        setFeedback('');

        try {
            await criarMarcacaoEncarregado({
                IdAluno: selectedStudentId,
                IdAula: selectedLesson.id
            });
            await loadBookings(selectedStudentId);
            await loadBaseData();
            setFeedback('Inscricao realizada com sucesso.');
            setSelectedLesson(null);
        } catch (err) {
            setError(err.message || 'Nao foi possivel concluir a inscricao.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUnenroll = async () => {
        if (!selectedLesson?.bookingId) return;

        setSubmitting(true);
        setError('');
        setFeedback('');

        try {
            const result = await cancelarMarcacaoEncarregado(selectedLesson.bookingId);
            await loadBookings(selectedStudentId);
            await loadBaseData();
            setFeedback(result?.mensagem || 'Inscricao cancelada com sucesso.');
            setSelectedLesson(null);
        } catch (err) {
            setError(err.message || 'Nao foi possivel cancelar a inscricao.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="guardian-lessons-page">
            <div className="guardian-lessons-header">
                <div>
                    <p className="guardian-lessons-eyebrow">Encarregado</p>
                    <h1>Inscricao em Aulas</h1>
                    <p className="guardian-lessons-subtitle">
                        Consulte as aulas normais ja programadas e inscreva o educando nas vagas disponiveis.
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
                    <p>A carregar aulas...</p>
                </section>
            ) : availableDates.length === 0 ? (
                <section className="guardian-lessons-card guardian-lessons-empty">
                    <p className="guardian-lessons-empty-title">Sem aulas disponiveis</p>
                    <p>Nao existem aulas programadas para inscricao neste momento.</p>
                </section>
            ) : (
                <>
                    <section className="guardian-lessons-card guardian-lessons-date-nav">
                        <button
                            type="button"
                            className="inventory-secondary-button"
                            onClick={prevDate}
                            disabled={selectedDateIndex <= 0}
                        >
                            Dia anterior
                        </button>

                        <div className="guardian-lessons-date-copy">
                            <p>{formattedDay}</p>
                            <h2>{formattedDate}</h2>
                        </div>

                        <button
                            type="button"
                            className="inventory-secondary-button"
                            onClick={nextDate}
                            disabled={selectedDateIndex >= availableDates.length - 1}
                        >
                            Dia seguinte
                        </button>
                    </section>

                    <section className="guardian-lessons-card guardian-lessons-list">
                        {Object.keys(lessonsByStudio).length === 0 ? (
                            <div className="guardian-lessons-empty">
                                <p className="guardian-lessons-empty-title">Sem aulas neste dia</p>
                                <p>Escolha outra data para consultar mais opcoes.</p>
                            </div>
                        ) : (
                            Object.entries(lessonsByStudio).map(([studio, studioLessons]) => (
                                <div key={studio} className="guardian-lessons-studio">
                                    <h3>{studio}</h3>
                                    <div className="guardian-lessons-grid">
                                        {studioLessons.map((lesson) => {
                                            const isFull = lesson.enrolled >= lesson.capacity;

                                            return (
                                                <button
                                                    key={lesson.id}
                                                    type="button"
                                                    className="guardian-lessons-item"
                                                    onClick={() => setSelectedLesson(lesson)}
                                                >
                                                    <div className="guardian-lessons-item-top">
                                                        <strong>{lesson.time}</strong>
                                                        <span className={`guardian-lessons-badge ${
                                                            lesson.isEnrolled
                                                                ? 'guardian-lessons-badge--success'
                                                                : isFull
                                                                    ? 'guardian-lessons-badge--danger'
                                                                    : 'guardian-lessons-badge--info'
                                                        }`}
                                                        >
                                                            {lesson.isEnrolled ? 'Inscrito' : isFull ? 'Lotada' : 'Vagas disponiveis'}
                                                        </span>
                                                    </div>

                                                    <div className="guardian-lessons-item-grid">
                                                        <div>
                                                            <span>Professor</span>
                                                            <p>{lesson.teacher}</p>
                                                        </div>
                                                        <div>
                                                            <span>Estilo</span>
                                                            <p>{lesson.style}</p>
                                                        </div>
                                                        <div>
                                                            <span>Vagas</span>
                                                            <p>{lesson.enrolled}/{lesson.capacity}</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </section>
                </>
            )}

            {selectedLesson && (
                <div className="guardian-lessons-modal-backdrop" onClick={() => setSelectedLesson(null)}>
                    <section className="guardian-lessons-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="guardian-lessons-modal-header">
                            <div>
                                <p className="guardian-lessons-eyebrow">Detalhes da Aula</p>
                                <h2>{selectedLesson.style}</h2>
                            </div>
                            <button type="button" className="inventory-secondary-button" onClick={() => setSelectedLesson(null)}>
                                Fechar
                            </button>
                        </div>

                        <div className="guardian-lessons-detail-grid">
                            <div>
                                <span>Educando</span>
                                <p>{selectedStudent?.Nome || '-'}</p>
                            </div>
                            <div>
                                <span>Data</span>
                                <p>{formattedDate}</p>
                            </div>
                            <div>
                                <span>Horario</span>
                                <p>{selectedLesson.time}</p>
                            </div>
                            <div>
                                <span>Local</span>
                                <p>{selectedLesson.studio}</p>
                            </div>
                            <div>
                                <span>Professor</span>
                                <p>{selectedLesson.teacher}</p>
                            </div>
                            <div>
                                <span>Vagas</span>
                                <p>{selectedLesson.enrolled}/{selectedLesson.capacity}</p>
                            </div>
                        </div>

                        <div className={`guardian-lessons-status ${
                            selectedLesson.isEnrolled
                                ? 'guardian-lessons-status--success'
                                : selectedLesson.enrolled >= selectedLesson.capacity
                                    ? 'guardian-lessons-status--danger'
                                    : 'guardian-lessons-status--info'
                        }`}
                        >
                            {selectedLesson.isEnrolled
                                ? 'O educando ja esta inscrito nesta aula.'
                                : selectedLesson.enrolled >= selectedLesson.capacity
                                    ? 'Esta aula esta lotada.'
                                    : `Existem ${selectedLesson.capacity - selectedLesson.enrolled} vaga(s) disponivel(eis).`}
                        </div>

                        <div className="guardian-lessons-actions">
                            {selectedLesson.isEnrolled ? (
                                <button
                                    type="button"
                                    className="inventory-secondary-button"
                                    onClick={handleUnenroll}
                                    disabled={submitting}
                                >
                                    {submitting ? 'A cancelar...' : 'Cancelar Inscricao'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="inventory-primary-button"
                                    onClick={handleEnroll}
                                    disabled={submitting || selectedLesson.enrolled >= selectedLesson.capacity || !selectedStudentId}
                                >
                                    {submitting ? 'A inscrever...' : 'Inscrever'}
                                </button>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default GuardianLessons;
