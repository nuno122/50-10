import React, { useEffect, useMemo, useState } from 'react';
import { criarPedidoAulaPrivada, getAlunosEncarregado, getAulas, getDisponibilidades, getEstilos, getPedidosAulaPrivadaEncarregado, getProfessores } from '../services/api';
import { useNotifications } from '../contexts/NotificationContext';

const emptyForm = {
    studentId: '',
    date: '',
    styleId: '',
    teacherId: '',
    duration: '60',
    capacity: '1',
    time: '',
    notes: ''
};

const getTodayInputDate = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - offset).toISOString().split('T')[0];
};

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};

const formatTime = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '--:--';
};

const normalizeDateKey = (value) => {
    if (!value) return '';

    const directMatch = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    if (directMatch) {
        return directMatch[1];
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toMinutes = (value) => {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
        return (date.getUTCHours() * 60) + date.getUTCMinutes();
    }

    const match = String(value || '').match(/(\d{2}):(\d{2})/);
    if (!match) {
        return null;
    }

    return (Number(match[1]) * 60) + Number(match[2]);
};

const minutesToTime = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

const buildAvailableTimeSlots = (availabilityEntries = [], scheduledLessons = [], durationMinutes = 0) => {
    const requiredDuration = Number(durationMinutes || 0);
    const busyIntervals = scheduledLessons
        .map((lesson) => ({
            start: toMinutes(lesson.HoraInicio),
            end: toMinutes(lesson.HoraFim)
        }))
        .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
        .sort((left, right) => left.start - right.start);

    const freeIntervals = [];

    availabilityEntries.forEach((entry) => {
        const entryStart = toMinutes(entry.HoraInicio);
        const entryEnd = toMinutes(entry.HoraFim);

        if (!Number.isFinite(entryStart) || !Number.isFinite(entryEnd) || entryEnd <= entryStart) {
            return;
        }

        let segments = [{ start: entryStart, end: entryEnd }];

        busyIntervals.forEach((busyInterval) => {
            segments = segments.flatMap((segment) => {
                if (busyInterval.end <= segment.start || busyInterval.start >= segment.end) {
                    return [segment];
                }

                const nextSegments = [];

                if (busyInterval.start > segment.start) {
                    nextSegments.push({
                        start: segment.start,
                        end: Math.min(busyInterval.start, segment.end)
                    });
                }

                if (busyInterval.end < segment.end) {
                    nextSegments.push({
                        start: Math.max(busyInterval.end, segment.start),
                        end: segment.end
                    });
                }

                return nextSegments;
            });
        });

        segments
            .filter((segment) => (segment.end - segment.start) >= requiredDuration)
            .forEach((segment) => {
                freeIntervals.push({
                    key: `${normalizeDateKey(entry.Data)}-${segment.start}-${segment.end}`,
                    startTime: minutesToTime(segment.start),
                    endTime: minutesToTime(segment.end)
                });
            });
    });

    return freeIntervals.sort((left, right) => left.startTime.localeCompare(right.startTime));
};

const getStatusTone = (status) => {
    switch (String(status || '').toLowerCase()) {
        case 'aprovado':
            return 'success';
        case 'rejeitado':
            return 'error';
        default:
            return 'info';
    }
};

const GuardianLessonRequest = () => {
    const { notify } = useNotifications();
    const [formData, setFormData] = useState(emptyForm);
    const [styles, setStyles] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [requests, setRequests] = useState([]);
    const [teacherAvailability, setTeacherAvailability] = useState([]);
    const [scheduledLessons, setScheduledLessons] = useState([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [stylesData, teachersData, studentsData, requestsData, lessonsData] = await Promise.all([
                getEstilos(),
                getProfessores(),
                getAlunosEncarregado(),
                getPedidosAulaPrivadaEncarregado(),
                getAulas()
            ]);

            setStyles(stylesData || []);
            setTeachers((teachersData || []).filter((teacher) => teacher.Utilizador?.EstaAtivo !== false));
            setStudents(studentsData || []);
            setRequests(requestsData || []);
            setScheduledLessons((lessonsData || []).filter((lesson) => lesson.EstaAtivo !== false));

            if ((studentsData || []).length > 0) {
                setFormData((current) => ({
                    ...current,
                    studentId: current.studentId || studentsData[0].IdAluno
                }));
            }
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar os dados do formulario.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const loadTeacherAvailability = async () => {
            if (!formData.teacherId || !formData.date) {
                setTeacherAvailability([]);
                return;
            }

            setAvailabilityLoading(true);

            try {
                const data = await getDisponibilidades({
                    idProfessor: formData.teacherId,
                    from: formData.date,
                    to: formData.date
                });
                setTeacherAvailability(data || []);
            } catch {
                setTeacherAvailability([]);
            } finally {
                setAvailabilityLoading(false);
            }
        };

        loadTeacherAvailability();
    }, [formData.teacherId, formData.date]);

    const styleOptions = useMemo(() => (
        styles
            .map((style) => ({
                id: style.IdEstiloDanca,
                name: style.Nome
            }))
            .sort((left, right) => left.name.localeCompare(right.name, 'pt'))
    ), [styles]);

    const studentLookup = useMemo(() => (
        new Map(students.map((student) => [student.IdAluno, student]))
    ), [students]);

    const teacherOptions = useMemo(() => (
        teachers
            .filter((teacher) => {
                if (!formData.styleId) {
                    return true;
                }

                return (teacher.EstiloProfessor || []).some((item) => item.IdEstiloDanca === formData.styleId);
            })
            .map((teacher) => ({
                id: teacher.IdUtilizador,
                name: teacher.Utilizador?.NomeCompleto || 'Professor'
            }))
            .sort((left, right) => left.name.localeCompare(right.name, 'pt'))
    ), [teachers, formData.styleId]);

    const selectedTeacherName = useMemo(() => (
        teacherOptions.find((teacher) => teacher.id === formData.teacherId)?.name || 'Professor selecionado'
    ), [teacherOptions, formData.teacherId]);

    const selectedTeacherLessons = useMemo(() => (
        scheduledLessons.filter((lesson) => (
            lesson.IdProfessor === formData.teacherId &&
            lesson.EstaAtivo !== false &&
            normalizeDateKey(lesson.Data) === formData.date
        ))
    ), [scheduledLessons, formData.teacherId, formData.date]);

    const availableTimeSlots = useMemo(() => (
        buildAvailableTimeSlots(teacherAvailability, selectedTeacherLessons, Number(formData.duration))
    ), [teacherAvailability, selectedTeacherLessons, formData.duration]);

    const canChooseTeacher = Boolean(formData.styleId);
    const canChooseTime = Boolean(formData.date && formData.teacherId);

    const resetForm = () => {
        setFormData((current) => ({
            ...emptyForm,
            studentId: students[0]?.IdAluno || current.studentId || ''
        }));
        setError('');
        setFeedback('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!formData.studentId || !formData.date || !formData.time || !formData.styleId || !formData.teacherId) {
            setError('Por favor, preencha todos os campos obrigatorios.');
            setFeedback('');
            return;
        }

        setSubmitting(true);
        setError('');
        setFeedback('');

        try {
            await criarPedidoAulaPrivada({
                IdAluno: formData.studentId,
                IdEstiloDanca: formData.styleId,
                IdProfessorSolicitado: formData.teacherId,
                DataPretendida: formData.date,
                HoraPretendida: formData.time,
                DuracaoMinutos: Number(formData.duration),
                CapacidadePretendida: Number(formData.capacity),
                Observacoes: formData.notes
            });

            setFeedback('Pedido de Coaching enviado com sucesso para confirmacao do professor.');
            notify({
                title: 'Pedido de Coaching enviado',
                message: 'O pedido foi enviado para confirmacao do professor.',
                tone: 'success'
            });
            resetForm();
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel enviar o pedido.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="guardian-request-page">
            <div className="guardian-request-header">
                <div>
                    <p className="guardian-request-eyebrow">Encarregado</p>
                    <h1>Pedido de Coaching</h1>
                    <p className="guardian-request-subtitle">
                        Os encarregados podem pedir sessoes de Coaching para os seus educandos.
                    </p>
                </div>
            </div>

            {error && <div className="guardian-request-banner guardian-request-banner--error">{error}</div>}
            {feedback && <div className="guardian-request-banner guardian-request-banner--success">{feedback}</div>}

            <div className="guardian-request-layout guardian-request-layout--single">
                <section className="guardian-request-card guardian-request-main-card">
                    <div className="guardian-request-card-header">
                        <div>
                            <h2>Novo Pedido</h2>
                            <p>Preencha pela ordem mais util: data, estilo, professor e so depois o horario pretendido.</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="guardian-request-empty">
                            <p>A carregar formulario...</p>
                        </div>
                    ) : students.length === 0 ? (
                        <div className="guardian-request-empty">
                            <p>Nao existem educandos associados a esta conta.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="guardian-request-form">
                            <div className="guardian-request-form-grid">
                                <label>
                                    <span>Educando *</span>
                                    <select
                                        value={formData.studentId}
                                        onChange={(event) => setFormData((current) => ({ ...current, studentId: event.target.value }))}
                                    >
                                        {students.map((student) => (
                                            <option key={student.IdAluno} value={student.IdAluno}>
                                                {student.Nome}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span>Data Pretendida *</span>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        min={getTodayInputDate()}
                                        onChange={(event) => setFormData((current) => ({
                                            ...current,
                                            date: event.target.value,
                                            time: ''
                                        }))}
                                    />
                                </label>
                            </div>

                            <div className="guardian-request-form-grid">
                                <label>
                                    <span>Estilo de Danca *</span>
                                    <select
                                        value={formData.styleId}
                                        onChange={(event) => setFormData((current) => ({
                                            ...current,
                                            styleId: event.target.value,
                                            teacherId: '',
                                            time: ''
                                        }))}
                                    >
                                        <option value="">Selecione o estilo</option>
                                        {styleOptions.map((style) => (
                                            <option key={style.id} value={style.id}>{style.name}</option>
                                        ))}
                                    </select>
                                    <small className="guardian-request-field-hint">
                                        O estilo filtra logo os professores disponiveis para este pedido.
                                    </small>
                                </label>

                                <label>
                                    <span>Professor *</span>
                                    <select
                                        value={formData.teacherId}
                                        disabled={!canChooseTeacher}
                                        onChange={(event) => setFormData((current) => ({
                                            ...current,
                                            teacherId: event.target.value,
                                            time: ''
                                        }))}
                                    >
                                        <option value="">
                                            {!formData.styleId
                                                ? 'Escolha primeiro o estilo'
                                                : teacherOptions.length === 0
                                                    ? 'Sem professores para este estilo'
                                                    : 'Selecione o professor'}
                                        </option>
                                        {teacherOptions.map((teacher) => (
                                            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                                        ))}
                                    </select>
                                    <small className="guardian-request-field-hint">
                                        Depois de escolher o professor, mostramos os blocos de disponibilidade desse dia.
                                    </small>
                                </label>
                            </div>

                            <div className="guardian-request-form-grid">
                                <label>
                                    <span>Duracao (minutos)</span>
                                    <select
                                        value={formData.duration}
                                        onChange={(event) => setFormData((current) => ({ ...current, duration: event.target.value }))}
                                    >
                                        <option value="30">30 minutos</option>
                                        <option value="60">60 minutos</option>
                                        <option value="90">90 minutos</option>
                                        <option value="120">120 minutos</option>
                                    </select>
                                </label>

                                <label>
                                    <span>Capacidade</span>
                                    <select
                                        value={formData.capacity}
                                        onChange={(event) => setFormData((current) => ({ ...current, capacity: event.target.value }))}
                                    >
                                        <option value="1">1 participante</option>
                                        <option value="2">2 participantes</option>
                                        <option value="3">3 participantes</option>
                                        <option value="4">4 participantes</option>
                                    </select>
                                </label>
                            </div>

                            <div className="guardian-request-note">
                                <p className="guardian-request-note-title">Disponibilidade do Professor</p>
                                <div className="guardian-request-note-grid">
                                    <label>
                                        <span>Horario Pretendido *</span>
                                        <input
                                            type="time"
                                            value={formData.time}
                                            disabled={!canChooseTime}
                                            onChange={(event) => setFormData((current) => ({ ...current, time: event.target.value }))}
                                        />
                                        <small className="guardian-request-field-hint">
                                            Escolha um bloco abaixo para preencher a hora automaticamente, ou introduza uma hora dentro de um intervalo livre.
                                        </small>
                                    </label>
                                </div>
                                {!formData.date ? (
                                    <p>Escolha primeiro a data do pedido.</p>
                                ) : !formData.styleId ? (
                                    <p>Escolha o estilo para podermos filtrar os professores certos.</p>
                                ) : !formData.teacherId ? (
                                    <p>Escolha o professor para ver os blocos disponiveis nesse dia.</p>
                                ) : availabilityLoading ? (
                                    <p>A carregar disponibilidade...</p>
                                ) : teacherAvailability.length === 0 ? (
                                    <p>{selectedTeacherName} nao tem disponibilidade registada neste dia.</p>
                                ) : availableTimeSlots.length === 0 ? (
                                    <p>{selectedTeacherName} nao tem blocos livres para a duracao escolhida neste dia.</p>
                                ) : (
                                    <>
                                        <p className="guardian-request-field-hint guardian-request-field-hint--block">
                                            Os blocos abaixo ja descontam as aulas que o professor tem marcadas nesse dia.
                                        </p>
                                        <div className="guardian-availability-slots">
                                            {availableTimeSlots.map((slot) => {
                                                const startTime = slot.startTime;
                                                const endTime = slot.endTime;

                                                return (
                                                    <button
                                                        key={slot.key}
                                                        type="button"
                                                        className={`guardian-availability-slot ${formData.time === startTime ? 'guardian-availability-slot--selected' : ''}`}
                                                        onClick={() => setFormData((current) => ({ ...current, time: startTime }))}
                                                    >
                                                        {startTime} - {endTime}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            <label>
                                <span>Observacoes</span>
                                <textarea
                                    rows="4"
                                    value={formData.notes}
                                    placeholder="Preferencias de professor, duvidas ou contexto adicional..."
                                    onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                                />
                            </label>

                            <div className="guardian-request-note">
                                <p className="guardian-request-note-title">Como funciona</p>
                                <ul>
                                    <li>O pedido entra primeiro para confirmacao do professor escolhido.</li>
                                    <li>Depois de confirmado pelo professor, a Direcao valida o estudio e aprova ou rejeita.</li>
                                    <li>Quando aprovado, o pedido passa a uma sessao de Coaching com marcacao do educando.</li>
                                </ul>
                            </div>

                            <div className="guardian-request-actions">
                                <button type="button" className="inventory-secondary-button" onClick={resetForm}>
                                    Limpar Formulario
                                </button>
                                <button type="submit" className="inventory-primary-button" disabled={submitting}>
                                    {submitting ? 'A enviar...' : 'Enviar Pedido'}
                                </button>
                            </div>
                        </form>
                    )}
                </section>

                <section className="guardian-request-card guardian-request-main-card">
                    <div className="guardian-request-card-header">
                        <div>
                            <h2>Pedidos Recentes</h2>
                            <p>Acompanhe o estado dos pedidos de Coaching de cada educando.</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="guardian-request-empty">
                            <p>A carregar pedidos...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="guardian-request-empty">
                            <p>Ainda nao existem pedidos de Coaching.</p>
                        </div>
                    ) : (
                        <div className="guardian-request-note">
                            <ul>
                                {requests.map((request) => {
                                    const student = studentLookup.get(request.IdAluno);
                                    const tone = getStatusTone(request.EstadoPedido);
                                    return (
                                        <li key={request.IdPedidoAulaPrivada}>
                                            <strong>{student?.Nome || request.Aluno?.Utilizador?.NomeCompleto || 'Educando'}</strong>
                                            {` | ${request.EstiloDanca?.Nome || 'Estilo'} | ${formatDate(request.DataPretendida)} as ${formatTime(request.HoraPretendida)} | `}
                                            <span className={`guardian-request-banner guardian-request-banner--${tone}`}>
                                                {request.EstadoPedido || 'Pendente'}
                                            </span>
                                            {request.ObservacaoDirecao ? ` | ${request.ObservacaoDirecao}` : ''}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default GuardianLessonRequest;
