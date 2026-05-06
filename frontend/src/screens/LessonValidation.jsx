import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    aprovarCancelamentoMarcacao,
    aprovarPedidoAulaPrivada,
    getAulas,
    getDisponibilidades,
    getEstudios,
    getPedidosAulaPrivada,
    getPedidosCancelamentoPendentes,
    getUtilizadores,
    rejeitarCancelamentoMarcacao,
    rejeitarPedidoAulaPrivada
} from '../services/api';
import CancellationValidationPanel from './CancellationValidationPanel';
import PrivateLessonValidationPanel from './PrivateLessonValidationPanel';

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const formatTime = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '--:--';
};

const LessonValidation = ({ embedded = false }) => {
    const { logout } = useAuth();
    const [users, setUsers] = useState([]);
    const [studios, setStudios] = useState([]);
    const [aulas, setAulas] = useState([]);
    const [disponibilidades, setDisponibilidades] = useState([]);
    const [privateLessonRequests, setPrivateLessonRequests] = useState([]);
    const [pendingCancellationRequests, setPendingCancellationRequests] = useState([]);
    const [privateRequestForms, setPrivateRequestForms] = useState({});
    const [cancellationNotes, setCancellationNotes] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [usersData, studiosData, aulasData, disponibilidadesData, privateRequestsData, cancellationRequestsData] = await Promise.all([
                getUtilizadores(),
                getEstudios(),
                getAulas(),
                getDisponibilidades(),
                getPedidosAulaPrivada(),
                getPedidosCancelamentoPendentes()
            ]);

            setUsers(usersData.filter((user) => user.EstaAtivo !== false));
            setStudios(studiosData || []);
            setAulas(aulasData || []);
            setDisponibilidades(disponibilidadesData || []);
            setPrivateLessonRequests(privateRequestsData || []);
            setPendingCancellationRequests(cancellationRequestsData || []);
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar as validacoes pendentes.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const pendingPrivateRequestsCount = useMemo(
        () => privateLessonRequests.filter((request) => request.EstadoPedido === 'Pendente').length,
        [privateLessonRequests]
    );
    const pendingCancellationCount = useMemo(
        () => pendingCancellationRequests.filter((request) => request.EstadoCancelamento === 'Pendente').length,
        [pendingCancellationRequests]
    );

    const handlePrivateRequestFieldChange = (idPedidoAulaPrivada, field, value) => {
        setPrivateRequestForms((current) => ({
            ...current,
            [idPedidoAulaPrivada]: {
                ...current[idPedidoAulaPrivada],
                [field]: value
            }
        }));
    };

    const handleCancellationNoteChange = (idMarcacao, value) => {
        setCancellationNotes((current) => ({
            ...current,
            [idMarcacao]: value
        }));
    };

    const handleApprovePrivateRequest = async (idPedidoAulaPrivada, form) => {
        setSaving(true);
        setError('');

        try {
            await aprovarPedidoAulaPrivada(idPedidoAulaPrivada, {
                ...form,
                DuracaoMinutos: Number(form.DuracaoMinutos),
                CapacidadeMaxima: Number(form.CapacidadeMaxima),
                Preco: Number(form.Preco)
            });
            setFeedback('Requisicao de aula aprovada com sucesso.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel aprovar a requisicao de aula.');
        } finally {
            setSaving(false);
        }
    };

    const handleRejectPrivateRequest = async (idPedidoAulaPrivada, observacao) => {
        setSaving(true);
        setError('');

        try {
            await rejeitarPedidoAulaPrivada(idPedidoAulaPrivada, observacao);
            setFeedback('Requisicao de aula rejeitada.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel rejeitar a requisicao de aula.');
        } finally {
            setSaving(false);
        }
    };

    const handleApproveCancellation = async (idMarcacao, observacao) => {
        setSaving(true);
        setError('');

        try {
            await aprovarCancelamentoMarcacao(idMarcacao, observacao);
            setFeedback('Cancelamento aprovado com sucesso.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel aprovar o cancelamento.');
        } finally {
            setSaving(false);
        }
    };

    const handleRejectCancellation = async (idMarcacao, observacao) => {
        setSaving(true);
        setError('');

        try {
            await rejeitarCancelamentoMarcacao(idMarcacao, observacao);
            setFeedback('Cancelamento rejeitado.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel rejeitar o cancelamento.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className={embedded ? 'rental-page rental-page--embedded' : 'rental-page'}>
            <section className={embedded ? 'rental-shell rental-shell--embedded' : 'rental-shell'}>
                <header className="rental-header">
                    <div>
                        <p className="rental-eyebrow">Direcao</p>
                        <h1>Validacao de Aulas e Cancelamentos</h1>
                        <p className="rental-subtitle">
                            Centraliza as requisicoes de aula e os cancelamentos tardios.
                        </p>
                    </div>

                    {!embedded && (
                        <button
                            type="button"
                            className="rental-button rental-button--ghost rental-logout"
                            onClick={logout}
                        >
                            Logout
                        </button>
                    )}
                </header>

                {feedback && <div className="rental-banner rental-banner--success">{feedback}</div>}
                {error && <div className="rental-banner rental-banner--error">{error}</div>}

                <div className="rental-layout">
                    <div className="rental-main">
                        <div className="rental-stats">
                            <article className="rental-card rental-stat-card">
                                <div>
                                    <p>Requisicao de Aula</p>
                                    <strong>{pendingPrivateRequestsCount}</strong>
                                </div>
                                <span>RA</span>
                            </article>

                            <article className="rental-card rental-stat-card">
                                <div>
                                    <p>Cancelamentos</p>
                                    <strong>{pendingCancellationCount}</strong>
                                </div>
                                <span>CA</span>
                            </article>
                        </div>

                        {loading ? (
                            <section className="rental-card rental-list-card">
                                <div className="rental-empty">
                                    <p className="rental-empty-title">A carregar validacoes...</p>
                                    <p className="rental-empty-copy">A preparar as requisicoes de aula e cancelamento.</p>
                                </div>
                            </section>
                        ) : (
                            <>
                                <PrivateLessonValidationPanel
                                    requests={privateLessonRequests}
                                    users={users}
                                    studios={studios}
                                    aulas={aulas}
                                    disponibilidades={disponibilidades}
                                    saving={saving}
                                    forms={privateRequestForms}
                                    onChangeForm={handlePrivateRequestFieldChange}
                                    onApprove={handleApprovePrivateRequest}
                                    onReject={handleRejectPrivateRequest}
                                    formatDate={formatDate}
                                    formatTime={formatTime}
                                />

                                <CancellationValidationPanel
                                    requests={pendingCancellationRequests}
                                    saving={saving}
                                    notes={cancellationNotes}
                                    onNoteChange={handleCancellationNoteChange}
                                    onApprove={handleApproveCancellation}
                                    onReject={handleRejectCancellation}
                                    formatDate={formatDate}
                                    formatTime={formatTime}
                                />
                            </>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
};

export default LessonValidation;
