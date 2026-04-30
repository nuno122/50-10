import React, { useEffect, useMemo, useState } from 'react';
import { getEstilos } from '../services/api';

const emptyForm = {
    date: '',
    time: '',
    duration: '60',
    capacity: '1',
    type: 'Particular',
    style: '',
    notes: ''
};

const GuardianLessonRequest = () => {
    const [formData, setFormData] = useState(emptyForm);
    const [styles, setStyles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError('');

            try {
                const stylesData = await getEstilos();
                setStyles(stylesData || []);
            } catch (err) {
                setError(err.message || 'Nao foi possivel carregar os dados do formulario.');
            } finally {
                setLoading(false);
            }
        };

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

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!formData.date || !formData.time || !formData.type || !formData.style) {
            setError('Por favor, preencha todos os campos obrigatorios.');
            setFeedback('');
            return;
        }

        setSubmitting(true);
        setError('');
        setFeedback('');

        try {
            setFeedback(
                `Pedido preparado para ${formData.date} as ${formData.time} para ${formData.capacity} participante(s). ` +
                'O backend ainda precisa do endpoint final para guardar o pedido.'
            );
            setFormData(emptyForm);
        } catch (err) {
            setError(err.message || 'Nao foi possivel preparar o pedido.');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData(emptyForm);
        setError('');
        setFeedback('');
    };

    return (
        <div className="guardian-request-page">
            <div className="guardian-request-header">
                <div>
                    <p className="guardian-request-eyebrow">Encarregado</p>
                    <h1>Requisicao de Aula</h1>
                    <p className="guardian-request-subtitle">
                        Preencha o formulario para solicitar uma aula particular.
                    </p>
                </div>
            </div>

            {error && <div className="guardian-request-banner guardian-request-banner--error">{error}</div>}
            {feedback && <div className="guardian-request-banner guardian-request-banner--success">{feedback}</div>}

            <div className="guardian-request-layout guardian-request-layout--single">
                <section className="guardian-request-card guardian-request-main-card">
                    <div className="guardian-request-card-header">
                        <div>
                            <h2>Formulario de Pedido</h2>
                            <p>
                                Selecione a data, o horario e o estilo pretendido para preparar o pedido.
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="guardian-request-empty">
                            <p>A carregar estilos...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="guardian-request-form">
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
                                    <span>Tipo de Aula</span>
                                    <input value="Particular" readOnly />
                                </label>

                                <label>
                                    <span>Estilo de Danca *</span>
                                    <select
                                        value={formData.style}
                                        onChange={(event) => setFormData((current) => ({ ...current, style: event.target.value }))}
                                    >
                                        <option value="">Selecione o estilo</option>
                                        {styleOptions.map((style) => (
                                            <option key={style.id} value={style.name}>{style.name}</option>
                                        ))}
                                    </select>
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

                            <label>
                                <span>Observacoes</span>
                                <textarea
                                    rows="4"
                                    value={formData.notes}
                                    placeholder="Informacoes adicionais, preferencias de professor, etc..."
                                    onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                                />
                            </label>

                            <div className="guardian-request-note">
                                <p className="guardian-request-note-title">Importante</p>
                                <ul>
                                    <li>O pedido sera analisado pela Direcao.</li>
                                    <li>A capacidade das aulas particulares pode ir ate 4 participantes.</li>
                                    <li>A disponibilidade de professores e estudios sera validada.</li>
                                    <li>Para gravar o pedido de forma definitiva falta ainda o endpoint especifico no backend.</li>
                                </ul>
                            </div>

                            <div className="guardian-request-actions">
                                <button type="button" className="inventory-secondary-button" onClick={resetForm}>
                                    Limpar Formulario
                                </button>
                                <button type="submit" className="inventory-primary-button" disabled={submitting}>
                                    {submitting ? 'A preparar...' : 'Enviar Pedido'}
                                </button>
                            </div>
                        </form>
                    )}
                </section>
            </div>
        </div>
    );
};

export default GuardianLessonRequest;
