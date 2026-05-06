import React, { useEffect, useMemo, useState } from 'react';
import { criarPedidoAulaPrivada, getAlunosEncarregado, getEstilos, getPedidosAulaPrivadaEncarregado } from '../services/api';

const emptyForm = {
    studentId: '',
    date: '',
    time: '',
    duration: '60',
    capacity: '1',
    styleId: '',
    notes: ''
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
    const [formData, setFormData] = useState(emptyForm);
    const [styles, setStyles] = useState([]);
    const [students, setStudents] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [stylesData, studentsData, requestsData] = await Promise.all([
                getEstilos(),
                getAlunosEncarregado(),
                getPedidosAulaPrivadaEncarregado()
            ]);

            setStyles(stylesData || []);
            setStudents(studentsData || []);
            setRequests(requestsData || []);

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

        if (!formData.studentId || !formData.date || !formData.time || !formData.styleId) {
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
                DataPretendida: formData.date,
                HoraPretendida: formData.time,
                DuracaoMinutos: Number(formData.duration),
                CapacidadePretendida: Number(formData.capacity),
                Observacoes: formData.notes
            });

            setFeedback('Pedido de aula privada enviado com sucesso para validacao da Direcao.');
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
                    <h1>Pedido de Aula Privada</h1>
                    <p className="guardian-request-subtitle">
                        Os encarregados podem pedir apenas aulas particulares para os seus educandos.
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
                            <p>Escolha o educando, o estilo e o horario pretendido para a Direcao analisar.</p>
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
                                    <span>Tipo de Aula</span>
                                    <input value="Particular" readOnly />
                                </label>
                            </div>

                            <div className="guardian-request-form-grid">
                                <label>
                                    <span>Data Pretendida *</span>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
                                    />
                                </label>

                                <label>
                                    <span>Horario Pretendido *</span>
                                    <input
                                        type="time"
                                        value={formData.time}
                                        onChange={(event) => setFormData((current) => ({ ...current, time: event.target.value }))}
                                    />
                                </label>
                            </div>

                            <div className="guardian-request-form-grid">
                                <label>
                                    <span>Estilo de Danca *</span>
                                    <select
                                        value={formData.styleId}
                                        onChange={(event) => setFormData((current) => ({ ...current, styleId: event.target.value }))}
                                    >
                                        <option value="">Selecione o estilo</option>
                                        {styleOptions.map((style) => (
                                            <option key={style.id} value={style.id}>{style.name}</option>
                                        ))}
                                    </select>
                                </label>

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
                            </div>

                            <div className="guardian-request-form-grid">
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

                                <div />
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
                                    <li>O pedido entra na area de validacao da Direcao.</li>
                                    <li>A Direcao pode aprovar, escolher professor e estudio, ou rejeitar.</li>
                                    <li>Quando aprovado, o pedido passa a uma aula particular real com marcacao do educando.</li>
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
                            <p>Acompanhe o estado das aulas privadas pedidas para cada educando.</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="guardian-request-empty">
                            <p>A carregar pedidos...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="guardian-request-empty">
                            <p>Ainda nao existem pedidos de aula privada.</p>
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
                                            {` · ${request.EstiloDanca?.Nome || 'Estilo'} · ${formatDate(request.DataPretendida)} às ${formatTime(request.HoraPretendida)} · `}
                                            <span className={`guardian-request-banner guardian-request-banner--${tone}`}>
                                                {request.EstadoPedido || 'Pendente'}
                                            </span>
                                            {request.ObservacaoDirecao ? ` · ${request.ObservacaoDirecao}` : ''}
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
