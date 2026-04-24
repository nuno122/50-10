import React, { useEffect, useMemo, useState } from 'react';
import { criarAula, getAulas, getEstilos, getEstudios, getUtilizadores } from '../services/api';

const PERMISSOES = {
    ALUNO: 1,
    PROFESSOR: 2,
    DIRECAO: 3,
    ENCARREGADO: 4
};

const getStartOfWeek = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1);
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
};

const getDaysOfWeek = (startDate) => {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        days.push(d);
    }
    return days;
};

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
    const parts = extractTime(value);
    return `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}`;
};

const toMinutes = (timeValue) => {
    const text = String(timeValue || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
};

const buildIsoTime = (date, time) => {
    const dayText = new Date(date).toISOString().slice(0, 10);
    return `${dayText}T${time}:00.000Z`;
};

const computeEndTime = (startTime, durationMinutes) => {
    if (!startTime || !durationMinutes) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const total = (hours * 60) + minutes + Number(durationMinutes);
    const nextHours = Math.floor(total / 60);
    const nextMinutes = total % 60;
    return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};

const initialForm = {
    date: '',
    teacher: '',
    style: '',
    capacity: '',
    startTime: '',
    endTime: '',
    duration: '',
    studio: ''
};

const ScheduleManagement = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [formData, setFormData] = useState(initialForm);
    const [aulas, setAulas] = useState([]);
    const [estudios, setEstudios] = useState([]);
    const [estilos, setEstilos] = useState([]);
    const [professores, setProfessores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [aulasData, estudiosData, estilosData, utilizadoresData] = await Promise.all([
                getAulas(),
                getEstudios(),
                getEstilos(),
                getUtilizadores()
            ]);

            setAulas(aulasData.filter((aula) => aula.EstaAtivo !== false));
            setEstudios(estudiosData);
            setEstilos(estilosData);
            setProfessores(
                utilizadoresData.filter((user) => (
                    user.Permissoes === PERMISSOES.PROFESSOR &&
                    user.EstaAtivo !== false &&
                    (user.Professor || user.ProfessorValido === 1)
                ))
            );
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar os horarios reais.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const startOfWeek = getStartOfWeek(currentDate);
    const weekDays = getDaysOfWeek(startOfWeek);
    const monthName = startOfWeek.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

    const timeRows = useMemo(() => Array.from({ length: 17 }, (_, index) => index + 7), []);

    const prevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const nextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const handleQuickBook = (day) => {
        setSelectedDay(day);
        setFormData({
            ...initialForm,
            date: new Date(day).toISOString().slice(0, 10)
        });
        setIsQuickBookOpen(true);
        setFeedback('');
    };

    const handleDurationClick = (minutes) => {
        setFormData((prev) => ({
            ...prev,
            duration: String(minutes),
            endTime: prev.startTime ? computeEndTime(prev.startTime, minutes) : ''
        }));
    };

    const handleEndTimeChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            endTime: value,
            duration: ''
        }));
    };

    const scheduleItems = useMemo(() => aulas.map((aula) => {
        const lessonDate = new Date(aula.Data);
        const startMinutes = toMinutes(aula.HoraInicio);
        const endMinutes = toMinutes(aula.HoraFim);
        const studioLabel = aula.Estudio?.Numero ? `Estudio ${aula.Estudio.Numero}` : aula.IdEstudio;
        const duration = Math.max(endMinutes - startMinutes, 30);

        return {
            id: aula.IdAula,
            dayOfWeek: lessonDate.getDay(),
            time: formatTime(aula.HoraInicio),
            duration,
            teacher: aula.Professor?.Utilizador?.NomeCompleto || aula.IdProfessor,
            style: aula.EstiloDanca?.Nome || 'Sem estilo',
            studio: studioLabel,
            capacity: aula.CapacidadeMaxima,
            enrolled: (aula.Marcacao || []).length,
            confirmed: Boolean(aula.ConfirmacaoProfessor),
            validated: Boolean(aula.ValidacaoDirecao)
        };
    }), [aulas]);

    const handleSubmit = async () => {
        if (!selectedDay && !formData.date) {
            setError('Seleciona um dia antes de agendar.');
            return;
        }

        if (!formData.date || !formData.teacher || !formData.style || !formData.capacity || !formData.startTime || !formData.studio) {
            setError('Preenche todos os campos obrigatorios.');
            return;
        }

        const effectiveEndTime = formData.endTime || (formData.duration ? computeEndTime(formData.startTime, formData.duration) : '');
        if (!effectiveEndTime) {
            setError('Indica a hora de fim ou uma duracao.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const effectiveDate = new Date(formData.date);

            await criarAula({
                Data: formData.date,
                HoraInicio: buildIsoTime(effectiveDate, formData.startTime),
                HoraFim: buildIsoTime(effectiveDate, effectiveEndTime),
                CapacidadeMaxima: Number(formData.capacity),
                Preco: 0,
                IdProfessor: formData.teacher,
                IdEstudio: formData.studio,
                IdEstiloDanca: formData.style
            });

            setFeedback(`Aula agendada com sucesso para ${formatDate(effectiveDate)}.`);
            setIsQuickBookOpen(false);
            setFormData(initialForm);
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel agendar a aula.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <div>
                    <p className="schedule-eyebrow">Direcao</p>
                    <h1>Gestao de Horarios</h1>
                    <p className="schedule-subtitle">
                        Agenda aulas e consulta o calendario semanal com informacao real da base de dados.
                    </p>
                </div>
                <button type="button" className="schedule-button schedule-button--primary" onClick={() => handleQuickBook(new Date())}>
                    Agendar Aula
                </button>
            </div>

            {feedback && <div className="schedule-banner schedule-banner--success">{feedback}</div>}
            {error && <div className="schedule-banner schedule-banner--error">{error}</div>}

            <div className="schedule-shell">
                <div className="schedule-toolbar">
                    <div className="schedule-toolbar-left">
                        <h2 className="capitalize">{monthName}</h2>
                        <div className="schedule-nav">
                            <button type="button" className="schedule-button schedule-button--ghost schedule-button--icon" onClick={prevWeek}>
                                ‹
                            </button>
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={goToToday}>
                                Semanal
                            </button>
                            <button type="button" className="schedule-button schedule-button--ghost schedule-button--icon" onClick={nextWeek}>
                                ›
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="schedule-empty">
                        <p className="schedule-empty-title">A carregar horarios...</p>
                        <p className="schedule-empty-copy">Estamos a ler aulas, estudios, estilos e professores da base de dados.</p>
                    </div>
                ) : (
                    <div className="schedule-calendar">
                        <div className="schedule-week-header">
                            <div className="schedule-time-corner" />
                            <div className="schedule-days-row">
                                {weekDays.map((day, idx) => {
                                    const isToday = new Date().toDateString() === day.toDateString();
                                    const dayName = day.toLocaleDateString('pt-PT', { weekday: 'short' });

                                    return (
                                        <div key={idx} className={`schedule-day-header ${isToday ? 'schedule-day-header--today' : ''}`}>
                                            <span>{dayName}</span>
                                            <strong>{day.getDate()}</strong>
                                            <button type="button" className="schedule-day-add" onClick={() => handleQuickBook(day)}>
                                                +
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="schedule-grid">
                            <div className="schedule-time-column">
                                {timeRows.map((hour) => (
                                    <div key={hour} className="schedule-time-label">
                                        {String(hour).padStart(2, '0')}:00
                                    </div>
                                ))}
                            </div>

                            <div className="schedule-columns">
                                {weekDays.map((day, idx) => {
                                    const dayClasses = scheduleItems.filter((lesson) => lesson.dayOfWeek === day.getDay());

                                    return (
                                        <div key={idx} className="schedule-day-column">
                                            <div className="schedule-hour-lines">
                                                {timeRows.map((hour) => (
                                                    <div key={hour} className="schedule-hour-line" />
                                                ))}
                                            </div>

                                            {dayClasses.map((lesson) => {
                                                const [hours, minutes] = lesson.time.split(':').map(Number);
                                                const topPercentage = Math.max(0, ((hours - 7 + (minutes / 60)) / 17) * 100);
                                                const heightPercentage = ((lesson.duration / 60) / 17) * 100;

                                                return (
                                                    <div
                                                        key={lesson.id}
                                                        className="schedule-lesson-wrap"
                                                        style={{
                                                            top: `${topPercentage}%`,
                                                            height: `${Math.max(heightPercentage, 7)}%`
                                                        }}
                                                    >
                                                        <div className="schedule-lesson-card">
                                                            <div className="schedule-lesson-title">{lesson.style}</div>
                                                            <div className="schedule-lesson-meta">{lesson.time} · {lesson.studio}</div>
                                                            <div className="schedule-lesson-meta">{lesson.teacher}</div>
                                                            <div className="schedule-lesson-badges">
                                                                <span>{lesson.enrolled}/{lesson.capacity}</span>
                                                                {lesson.validated && <span>Dir OK</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isQuickBookOpen && (
                <div className="schedule-modal-backdrop" onClick={() => setIsQuickBookOpen(false)}>
                    <section className="schedule-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="schedule-modal-header">
                            <div>
                                <p className="schedule-eyebrow">Agendar aula</p>
                                <h2>{formData.date ? formatDate(formData.date) : (selectedDay ? formatDate(selectedDay) : '')}</h2>
                            </div>
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setIsQuickBookOpen(false)}>
                                Fechar
                            </button>
                        </div>

                        <div className="schedule-form">
                            <label>
                                <span>Data da aula *</span>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(event) => {
                                        const nextDate = event.target.value;
                                        setFormData((prev) => ({ ...prev, date: nextDate }));
                                        if (nextDate) {
                                            setSelectedDay(new Date(nextDate));
                                        }
                                    }}
                                />
                            </label>

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Estudio *</span>
                                    <select value={formData.studio} onChange={(event) => setFormData((prev) => ({ ...prev, studio: event.target.value }))}>
                                        <option value="">Selecione o estudio</option>
                                        {estudios.map((studio) => (
                                            <option key={studio.IdEstudio} value={studio.IdEstudio}>
                                                Estudio {studio.Numero}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span>Professor *</span>
                                    <select value={formData.teacher} onChange={(event) => setFormData((prev) => ({ ...prev, teacher: event.target.value }))}>
                                        <option value="">Selecione o professor</option>
                                        {professores.map((teacher) => (
                                            <option key={teacher.IdUtilizador} value={teacher.IdUtilizador}>
                                                {teacher.NomeCompleto}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <label>
                                <span>Estilo de danca *</span>
                                <select value={formData.style} onChange={(event) => setFormData((prev) => ({ ...prev, style: event.target.value }))}>
                                    <option value="">Selecione o estilo</option>
                                    {estilos.map((style) => (
                                        <option key={style.IdEstiloDanca} value={style.IdEstiloDanca}>
                                            {style.Nome}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Limite de vagas *</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.capacity}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, capacity: event.target.value }))}
                                        placeholder="Ex: 12"
                                    />
                                </label>
                                <div />
                            </div>

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Hora de inicio *</span>
                                    <input
                                        type="time"
                                        value={formData.startTime}
                                        onChange={(event) => setFormData((prev) => ({
                                            ...prev,
                                            startTime: event.target.value,
                                            endTime: prev.duration ? computeEndTime(event.target.value, prev.duration) : prev.endTime
                                        }))}
                                    />
                                </label>

                                <label>
                                    <span>Hora de fim</span>
                                    <input
                                        type="time"
                                        value={formData.endTime}
                                        onChange={(event) => handleEndTimeChange(event.target.value)}
                                        disabled={Boolean(formData.duration)}
                                    />
                                </label>
                            </div>

                            <div>
                                <span className="schedule-form-label">Duracao (atalhos)</span>
                                <div className="schedule-duration-list">
                                    {[30, 45, 60, 90].map((duration) => (
                                        <button
                                            key={duration}
                                            type="button"
                                            className={`schedule-button ${formData.duration === String(duration) ? 'schedule-button--primary' : 'schedule-button--ghost'}`}
                                            onClick={() => handleDurationClick(duration)}
                                        >
                                            {duration} min
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="schedule-modal-actions">
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setIsQuickBookOpen(false)}>
                                Cancelar
                            </button>
                            <button type="button" className="schedule-button schedule-button--primary" onClick={handleSubmit} disabled={saving}>
                                {saving ? 'A guardar...' : 'Confirmar agendamento'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default ScheduleManagement;
