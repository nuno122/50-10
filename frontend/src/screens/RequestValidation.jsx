import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAulas, validarAulaDirecao } from '../services/api';

const badgeClassForType = (type) => (
    type === 'lesson'
        ? 'request-badge request-badge--primary'
        : 'request-badge request-badge--muted'
);

const statusLabel = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado'
};

const formatDate = (value) => {
    if (!value) return '-';

    const date = new Date(value);
    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const formatTime = (value) => {
    if (!value) return '-';

    const text = String(value);
    const match = text.match(/(\d{2}:\d{2})/);
    if (match) return match[1];

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return text;

    return new Intl.DateTimeFormat('pt-PT', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const toMinutes = (timeValue) => {
    const text = String(timeValue || '');
    const match = text.match(/(\d{2}):(\d{2})/);

    if (!match) return 0;

    return Number(match[1]) * 60 + Number(match[2]);
};

const buildRequestsFromAulas = (aulas) => {
    const pendentes = aulas.filter((aula) => !aula.ValidacaoDirecao && aula.EstaAtivo);

    return pendentes.map((aula) => {
        const startMinutes = toMinutes(aula.HoraInicio);
        const endMinutes = toMinutes(aula.HoraFim);

        const conflicts = aulas
            .filter((candidate) => (
                candidate.IdAula !== aula.IdAula &&
                candidate.IdEstudio === aula.IdEstudio &&
                candidate.Data === aula.Data &&
                candidate.EstaAtivo
            ))
            .filter((candidate) => {
                const candidateStart = toMinutes(candidate.HoraInicio);
                const candidateEnd = toMinutes(candidate.HoraFim);
                return startMinutes < candidateEnd && endMinutes > candidateStart;
            })
            .map((candidate) => ({
                id: candidate.IdAula,
                time: `${formatTime(candidate.HoraInicio)} - ${formatTime(candidate.HoraFim)}`,
                teacher: candidate.Professor?.Utilizador?.NomeCompleto || candidate.Professor?.IdUtilizador || 'Professor',
                style: candidate.EstiloDanca?.Nome || 'Sem estilo',
                enrolled: candidate.Marcacao?.length || 0
            }));

        return {
            id: aula.IdAula,
            type: 'lesson',
            requestedBy: aula.Professor?.Utilizador?.NomeCompleto || aula.Professor?.IdUtilizador || 'Professor',
            requestedDate: formatDate(aula.Data),
            requestedTime: formatTime(aula.HoraInicio),
            requestedEndTime: formatTime(aula.HoraFim),
            studio: aula.Estudio?.Numero ? `Estudio ${aula.Estudio.Numero}` : aula.IdEstudio,
            duration: Math.max(endMinutes - startMinutes, 0),
            style: aula.EstiloDanca?.Nome || 'Sem estilo',
            conflicts,
            status: aula.ValidacaoDirecao ? 'approved' : 'pending',
            confirmacaoProfessor: Boolean(aula.ConfirmacaoProfessor),
            enrolled: aula.Marcacao?.length || 0
        };
    });
};

const RequestValidation = ({ embedded = false }) => {
    const { logout } = useAuth();
    const [requests, setRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submittingId, setSubmittingId] = useState(null);

    const pendingRequests = useMemo(
        () => requests.filter((request) => request.status === 'pending'),
        [requests]
    );

    const closeModal = () => setSelectedRequest(null);

    const updateStatus = (id, status) => {
        setRequests((current) => current.map((request) => (
            request.id === id ? { ...request, status } : request
        )));

        if (selectedRequest?.id === id) {
            setSelectedRequest((current) => current ? { ...current, status } : null);
        }
    };

    const loadRequests = async () => {
        setLoading(true);
        setError('');

        try {
            const aulas = await getAulas();
            setRequests(buildRequestsFromAulas(aulas));
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar os pedidos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const handleApprove = async (id) => {
        setSubmittingId(id);
        setError('');

        try {
            await validarAulaDirecao(id);
            await loadRequests();
            closeModal();
        } catch (err) {
            setError(err.message || 'Nao foi possivel aprovar o pedido.');
        } finally {
            setSubmittingId(null);
        }
    };

    const handleReject = (id) => {
        updateStatus(id, 'rejected');
        closeModal();
    };

    return (
        <main className={embedded ? 'request-page request-page--embedded' : 'request-page'}>
            <section className={embedded ? 'request-shell request-shell--embedded' : 'request-shell'}>
                <header className="request-header">
                    <div>
                        <p className="request-eyebrow">Direcao</p>
                        <h1>Validacao de Pedidos</h1>
                        <p className="request-subtitle">
                            Dados reais da base de dados para aulas pendentes de validacao da direcao.
                        </p>
                    </div>

                    <div className="request-header-actions">
                        <div className="request-counter">
                            <span>{pendingRequests.length}</span>
                            <small>Pendentes</small>
                        </div>

                        {!embedded && (
                            <button
                                type="button"
                                className="request-button request-button--ghost request-logout"
                                onClick={logout}
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </header>

                <section className="request-card">
                    <div className="request-card-header">
                        <h2>Lista de pedidos pendentes</h2>
                        <p>As aulas abaixo sao carregadas de `/api/aulas` e filtradas por validacao pendente.</p>
                    </div>

                    {error && (
                        <div className="request-banner request-banner--error">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="request-empty">
                            <div className="request-empty-icon">...</div>
                            <p className="request-empty-title">A carregar pedidos</p>
                            <p className="request-empty-copy">Estamos a ler os dados da base de dados.</p>
                        </div>
                    ) : pendingRequests.length === 0 ? (
                        <div className="request-empty">
                            <div className="request-empty-icon">OK</div>
                            <p className="request-empty-title">Sem pedidos pendentes</p>
                            <p className="request-empty-copy">Nao existem aulas pendentes de validacao da direcao.</p>
                        </div>
                    ) : (
                        <div className="request-list">
                            {pendingRequests.map((request) => (
                                <article key={request.id} className="request-item">
                                    <div className="request-item-main">
                                        <div className="request-item-top">
                                            <span className={badgeClassForType(request.type)}>
                                                {request.type === 'lesson' ? 'Aula' : 'Espaco'}
                                            </span>

                                            {request.conflicts.length > 0 && (
                                                <span className="request-badge request-badge--danger">
                                                    {request.conflicts.length} conflito{request.conflicts.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>

                                        <div className="request-grid">
                                            <div>
                                                <span className="request-label">Solicitado por</span>
                                                <p>{request.requestedBy}</p>
                                            </div>
                                            <div>
                                                <span className="request-label">Data</span>
                                                <p>{request.requestedDate}</p>
                                            </div>
                                            <div>
                                                <span className="request-label">Horario</span>
                                                <p>{request.requestedTime} - {request.requestedEndTime} ({request.duration} min)</p>
                                            </div>
                                            <div>
                                                <span className="request-label">Local</span>
                                                <p>{request.studio}</p>
                                            </div>
                                            <div>
                                                <span className="request-label">Estilo</span>
                                                <p>{request.style}</p>
                                            </div>
                                            <div>
                                                <span className="request-label">Estado</span>
                                                <p>{statusLabel[request.status]}</p>
                                            </div>
                                            <div>
                                                <span className="request-label">Professor confirmou</span>
                                                <p>{request.confirmacaoProfessor ? 'Sim' : 'Nao'}</p>
                                            </div>
                                            <div>
                                                <span className="request-label">Inscritos</span>
                                                <p>{request.enrolled}</p>
                                            </div>
                                        </div>

                                        {request.conflicts.length > 0 && (
                                            <div className="request-conflicts">
                                                <p className="request-conflicts-title">Sobreposicoes detetadas</p>
                                                {request.conflicts.map((conflict) => (
                                                    <div key={conflict.id} className="request-conflict-row">
                                                        <span>{conflict.time}</span>
                                                        <span>{conflict.teacher}</span>
                                                        <span>{conflict.style}</span>
                                                        <span>{conflict.enrolled} alunos</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="request-actions">
                                        <button
                                            type="button"
                                            className="request-button request-button--ghost"
                                            onClick={() => setSelectedRequest(request)}
                                        >
                                            Ver detalhes
                                        </button>
                                        <button
                                            type="button"
                                            className="request-button request-button--primary"
                                            onClick={() => handleApprove(request.id)}
                                            disabled={request.conflicts.length > 0 || submittingId === request.id}
                                        >
                                            {submittingId === request.id ? 'A aprovar...' : 'Aprovar'}
                                        </button>
                                        <button
                                            type="button"
                                            className="request-button request-button--danger"
                                            onClick={() => handleReject(request.id)}
                                        >
                                            Rejeitar
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </section>

            {selectedRequest && (
                <div className="request-modal-backdrop" onClick={closeModal}>
                    <section
                        className="request-modal"
                        onClick={(event) => event.stopPropagation()}
                        aria-modal="true"
                        role="dialog"
                    >
                        <div className="request-modal-header">
                            <div>
                                <p className="request-eyebrow">Detalhes do pedido</p>
                                <h2>{selectedRequest.type === 'lesson' ? 'Aula' : 'Espaco'}</h2>
                            </div>
                            <button type="button" className="request-close" onClick={closeModal}>
                                Fechar
                            </button>
                        </div>

                        <div className="request-modal-grid">
                            <div>
                                <span className="request-label">Solicitado por</span>
                                <p>{selectedRequest.requestedBy}</p>
                            </div>
                            <div>
                                <span className="request-label">Data</span>
                                <p>{selectedRequest.requestedDate}</p>
                            </div>
                            <div>
                                <span className="request-label">Horario</span>
                                <p>{selectedRequest.requestedTime} - {selectedRequest.requestedEndTime}</p>
                            </div>
                            <div>
                                <span className="request-label">Duracao</span>
                                <p>{selectedRequest.duration} minutos</p>
                            </div>
                            <div>
                                <span className="request-label">Estudio</span>
                                <p>{selectedRequest.studio}</p>
                            </div>
                            <div>
                                <span className="request-label">Estilo</span>
                                <p>{selectedRequest.style}</p>
                            </div>
                            <div>
                                <span className="request-label">Professor confirmou</span>
                                <p>{selectedRequest.confirmacaoProfessor ? 'Sim' : 'Nao'}</p>
                            </div>
                            <div>
                                <span className="request-label">Inscritos</span>
                                <p>{selectedRequest.enrolled}</p>
                            </div>
                        </div>

                        {selectedRequest.conflicts.length > 0 && (
                            <div className="request-modal-conflicts">
                                <h3>Conflitos de horario</h3>
                                {selectedRequest.conflicts.map((conflict) => (
                                    <div key={conflict.id} className="request-modal-conflict-card">
                                        <div>
                                            <span className="request-label">Horario</span>
                                            <p>{conflict.time}</p>
                                        </div>
                                        <div>
                                            <span className="request-label">Professor</span>
                                            <p>{conflict.teacher}</p>
                                        </div>
                                        <div>
                                            <span className="request-label">Estilo</span>
                                            <p>{conflict.style}</p>
                                        </div>
                                        <div>
                                            <span className="request-label">Alunos</span>
                                            <p>{conflict.enrolled}</p>
                                        </div>
                                    </div>
                                ))}
                                <p className="request-modal-note">
                                    Este pedido nao pode ser aprovado enquanto existirem conflitos de horario.
                                </p>
                            </div>
                        )}

                        <div className="request-modal-actions">
                            <button type="button" className="request-button request-button--ghost" onClick={closeModal}>
                                Fechar
                            </button>
                            {selectedRequest.conflicts.length === 0 && (
                                <>
                                    <button
                                        type="button"
                                        className="request-button request-button--danger"
                                        onClick={() => handleReject(selectedRequest.id)}
                                    >
                                        Rejeitar
                                    </button>
                                    <button
                                        type="button"
                                        className="request-button request-button--primary"
                                        onClick={() => handleApprove(selectedRequest.id)}
                                        disabled={submittingId === selectedRequest.id}
                                    >
                                        {submittingId === selectedRequest.id ? 'A aprovar...' : 'Aprovar pedido'}
                                    </button>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
};

export default RequestValidation;
