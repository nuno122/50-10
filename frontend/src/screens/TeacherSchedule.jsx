import React, { useEffect, useMemo, useState } from 'react';
import { cancelarAulaProfessor, getAulas } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const DAYS_OF_WEEK = [
    { id: 1, name: 'Segunda-feira' },
    { id: 2, name: 'Terca-feira' },
    { id: 3, name: 'Quarta-feira' },
    { id: 4, name: 'Quinta-feira' },
    { id: 5, name: 'Sexta-feira' },
    { id: 6, name: 'Sabado' },
    { id: 0, name: 'Domingo' }
];

const INITIAL_WEEKLY = [
    { dayOfWeek: 1, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 2, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 3, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 4, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 5, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 6, isAvailable: false, startTime: '10:00', endTime: '13:00' },
    { dayOfWeek: 0, isAvailable: false, startTime: '10:00', endTime: '13:00' }
];

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const extractTime = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '-';
};

const mergeWeeklyFromLessons = (lessons) => {
    return INITIAL_WEEKLY.map((day) => {
        const matchingLessons = lessons.filter((lesson) => {
            const date = new Date(lesson.Data);
            return !Number.isNaN(date.getTime()) && date.getDay() === day.dayOfWeek && lesson.EstaAtivo !== false;
        });

        if (matchingLessons.length === 0) {
            return {
                ...day,
                isAvailable: false
            };
        }

        const sortedByStart = [...matchingLessons].sort((left, right) => {
            const leftTime = extractTime(left.HoraInicio);
            const rightTime = extractTime(right.HoraInicio);
            return leftTime.localeCompare(rightTime);
        });

        const sortedByEnd = [...matchingLessons].sort((left, right) => {
            const leftTime = extractTime(left.HoraFim);
            const rightTime = extractTime(right.HoraFim);
            return rightTime.localeCompare(leftTime);
        });

        return {
            dayOfWeek: day.dayOfWeek,
            isAvailable: true,
            startTime: extractTime(sortedByStart[0]?.HoraInicio),
            endTime: extractTime(sortedByEnd[0]?.HoraFim)
        };
    });
};

const TeacherSchedule = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('lessons');
    const [weeklyAvailability, setWeeklyAvailability] = useState(INITIAL_WEEKLY);
    const [lessons, setLessons] = useState([]);
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadLessons = async () => {
        setLoading(true);
        setError('');

        try {
            const aulas = await getAulas();
            const ownLessons = aulas
                .filter((lesson) => lesson.IdProfessor === user?.Id)
                .map((lesson) => ({
                    id: lesson.IdAula,
                    title: lesson.EstiloDanca?.Nome || 'Aula',
                    date: formatDate(lesson.Data),
                    time: `${extractTime(lesson.HoraInicio)} - ${extractTime(lesson.HoraFim)}`,
                    studio: lesson.Estudio?.Numero ? `Estudio ${lesson.Estudio.Numero}` : lesson.IdEstudio,
                    students: (lesson.Marcacao || []).map((booking) => ({
                        id: booking.IdAluno,
                        name: booking.Aluno?.Utilizador?.NomeCompleto || booking.IdAluno
                    })),
                    status: lesson.EstaAtivo === false ? 'cancelled' : 'scheduled'
                }));

            setLessons(ownLessons);
            setWeeklyAvailability(mergeWeeklyFromLessons(aulas.filter((lesson) => lesson.IdProfessor === user?.Id)));
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar as aulas do professor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLessons();
    }, [user]);

    const filteredLessons = useMemo(() => {
        const term = searchQuery.toLowerCase();
        return lessons.filter((lesson) => (
            lesson.title.toLowerCase().includes(term) ||
            lesson.studio.toLowerCase().includes(term)
        ));
    }, [lessons, searchQuery]);

    const openStudentsModal = (lesson) => {
        setSelectedLesson(lesson);
        setIsStudentsModalOpen(true);
    };

    const openCancelModal = (lesson) => {
        setSelectedLesson(lesson);
        setCancelReason('');
        setIsCancelModalOpen(true);
    };

    const handleCancelLesson = async () => {
        if (!selectedLesson) return;

        setSaving(true);
        setError('');

        try {
            await cancelarAulaProfessor(selectedLesson.id);
            setIsCancelModalOpen(false);
            setFeedback('Aula cancelada com sucesso.');
            await loadLessons();
        } catch (err) {
            setError(err.message || 'Nao foi possivel cancelar a aula.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="teacher-page">
            <div className="teacher-header">
                <div>
                    <p className="teacher-eyebrow">Professor</p>
                    <h1>Aulas e Disponibilidade</h1>
                </div>
            </div>

            {feedback && <div className="teacher-banner teacher-banner--success">{feedback}</div>}
            {error && <div className="teacher-banner teacher-banner--error">{error}</div>}

            <div className="teacher-tabs">
                <button
                    type="button"
                    className={`teacher-tab ${activeTab === 'lessons' ? 'teacher-tab--active' : ''}`}
                    onClick={() => setActiveTab('lessons')}
                >
                    Minhas Aulas
                </button>
                <button
                    type="button"
                    className={`teacher-tab ${activeTab === 'availability' ? 'teacher-tab--active' : ''}`}
                    onClick={() => setActiveTab('availability')}
                >
                    Disponibilidade
                </button>
            </div>

            {activeTab === 'lessons' && (
                <div className="teacher-section">
                    <div className="teacher-toolbar">
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Pesquisar por estilo ou estudio..."
                        />
                        <div className="teacher-filter-badges">
                            <span className="teacher-chip teacher-chip--active">Proximas</span>
                            <span className="teacher-chip">Concluidas</span>
                            <span className="teacher-chip">Canceladas</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="teacher-empty">
                            <p className="teacher-empty-title">A carregar aulas...</p>
                        </div>
                    ) : (
                        <div className="teacher-grid">
                            {filteredLessons.filter((lesson) => lesson.status !== 'cancelled').map((lesson) => (
                                <article key={lesson.id} className="teacher-card">
                                    <div className="teacher-card-header">
                                        <span className="teacher-badge teacher-badge--primary">Aula</span>
                                        <h2>{lesson.title}</h2>
                                    </div>

                                    <div className="teacher-card-body">
                                        <p>{lesson.date}</p>
                                        <p>{lesson.time}</p>
                                        <p>{lesson.studio}</p>
                                        <p>{lesson.students.length} aluno(s) inscrito(s)</p>
                                    </div>

                                    <div className="teacher-card-actions">
                                        <button type="button" className="teacher-button teacher-button--ghost" onClick={() => openStudentsModal(lesson)}>
                                            Ver Inscritos
                                        </button>
                                        <button type="button" className="teacher-button teacher-button--danger" onClick={() => openCancelModal(lesson)}>
                                            Cancelar Aula
                                        </button>
                                    </div>
                                </article>
                            ))}

                            {filteredLessons.filter((lesson) => lesson.status === 'cancelled').map((lesson) => (
                                <article key={lesson.id} className="teacher-card teacher-card--cancelled">
                                    <div className="teacher-card-header">
                                        <span className="teacher-badge teacher-badge--danger">Cancelada</span>
                                        <h2>{lesson.title}</h2>
                                    </div>
                                    <div className="teacher-card-body">
                                        <p>{lesson.date}</p>
                                        <p>{lesson.time}</p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'availability' && (
                <div className="teacher-availability-card">
                    <div className="teacher-availability-header">
                        <div>
                            <h2>Resumo Semanal</h2>
                            <p>Vista semanal das aulas atualmente associadas a este professor.</p>
                        </div>
                    </div>

                    <div className="teacher-availability-list">
                        {weeklyAvailability.map((day) => {
                            const dayName = DAYS_OF_WEEK.find((entry) => entry.id === day.dayOfWeek)?.name;
                            return (
                                <div key={day.dayOfWeek} className={`teacher-availability-row ${day.isAvailable ? 'teacher-availability-row--active' : ''}`}>
                                    <div className="teacher-availability-day">
                                        <span className={`teacher-availability-dot ${day.isAvailable ? 'teacher-availability-dot--active' : ''}`} />
                                        <label>{dayName}</label>
                                    </div>

                                    {day.isAvailable ? (
                                        <div className="teacher-availability-time">
                                            <div className="teacher-availability-pill">{day.startTime}</div>
                                            <span>ate</span>
                                            <div className="teacher-availability-pill">{day.endTime}</div>
                                        </div>
                                    ) : (
                                        <span className="teacher-availability-off">Sem aulas agendadas</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {isStudentsModalOpen && selectedLesson && (
                <div className="teacher-modal-backdrop" onClick={() => setIsStudentsModalOpen(false)}>
                    <section className="teacher-modal teacher-modal--small" onClick={(event) => event.stopPropagation()}>
                        <div className="teacher-modal-header">
                            <div>
                                <p className="teacher-eyebrow">Lista de inscritos</p>
                                <h2>{selectedLesson.title}</h2>
                                <p>{selectedLesson.date} • {selectedLesson.time}</p>
                            </div>
                        </div>

                        <div className="teacher-students-list">
                            {selectedLesson.students.length === 0 ? (
                                <div className="teacher-empty">
                                    <p className="teacher-empty-title">Nenhum aluno inscrito nesta aula ainda.</p>
                                </div>
                            ) : (
                                selectedLesson.students.map((student) => (
                                    <div key={student.id} className="teacher-student-row">
                                        <div className="teacher-student-avatar">
                                            {student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                                        </div>
                                        <span>{student.name}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="teacher-modal-actions">
                            <button type="button" className="teacher-button teacher-button--ghost" onClick={() => setIsStudentsModalOpen(false)}>
                                Fechar
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {isCancelModalOpen && selectedLesson && (
                <div className="teacher-modal-backdrop" onClick={() => setIsCancelModalOpen(false)}>
                    <section className="teacher-modal teacher-modal--small" onClick={(event) => event.stopPropagation()}>
                        <div className="teacher-modal-header">
                            <div>
                                <p className="teacher-eyebrow">Cancelar aula</p>
                                <h2>{selectedLesson.title}</h2>
                                <p>{selectedLesson.date}</p>
                            </div>
                        </div>

                        <div className="teacher-cancel-note">
                            Ao confirmar, a aula sera marcada como cancelada no sistema. O motivo abaixo e apenas informativo no frontend atual.
                        </div>

                        <label className="teacher-cancel-label">
                            <span>Motivo do cancelamento (opcional)</span>
                            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Ex: motivos de saude, imprevisto pessoal..." />
                        </label>

                        <div className="teacher-modal-actions">
                            <button type="button" className="teacher-button teacher-button--ghost" onClick={() => setIsCancelModalOpen(false)}>
                                Voltar
                            </button>
                            <button type="button" className="teacher-button teacher-button--danger" onClick={handleCancelLesson} disabled={saving}>
                                {saving ? 'A cancelar...' : 'Confirmar Cancelamento'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default TeacherSchedule;
