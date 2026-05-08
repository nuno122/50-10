import React from 'react';

const CancellationValidationPanel = ({
    requests,
    saving,
    notes,
    onNoteChange,
    onApprove,
    onReject,
    formatDate,
    formatTime
}) => {
    const pendingRequests = (requests || []).filter((request) => request.EstadoCancelamento === 'Pendente');

    return (
        <section className="rental-card rental-list-card">
            <div className="rental-form-header">
                <h2>Cancelamentos Pendentes</h2>
                <p>Pedidos de cancelamento feitos com menos de 24 horas de antecedencia.</p>
            </div>

            {pendingRequests.length === 0 ? (
                <div className="rental-empty">
                    <p className="rental-empty-title">Sem cancelamentos pendentes</p>
                    <p className="rental-empty-copy">Quando um encarregado pedir cancelamento tardio, aparece aqui.</p>
                </div>
            ) : (
                <div className="rental-list">
                    {pendingRequests.map((request) => (
                        <article key={request.IdMarcacao} className="rental-item">
                            <div className="rental-item-main">
                                <div className="rental-item-top">
                                    <div className="rental-badges">
                                        <span className="rental-badge rental-badge--warning">Pendente</span>
                                        <span className="rental-badge rental-badge--muted">{request.Aula?.EstiloDanca?.Nome || 'Aula'}</span>
                                    </div>
                                </div>

                                <div className="rental-grid">
                                    <div>
                                        <span className="rental-label">Aluno</span>
                                        <p>{request.Aluno?.Utilizador?.NomeCompleto || 'Aluno'}</p>
                                    </div>
                                    <div>
                                        <span className="rental-label">Professor</span>
                                        <p>{request.Aula?.Professor?.Utilizador?.NomeCompleto || 'Professor por definir'}</p>
                                    </div>
                                    <div>
                                        <span className="rental-label">Data da aula</span>
                                        <p>{formatDate(request.Aula?.Data)} as {formatTime(request.Aula?.HoraInicio)}</p>
                                    </div>
                                    <div>
                                        <span className="rental-label">Pedido enviado</span>
                                        <p>{formatDate(request.DataPedidoCancelamento)}</p>
                                    </div>
                                </div>

                                <div className="rental-extension">
                                    <div>
                                        <p className="rental-extension-title">Motivo do cancelamento</p>
                                        <p>{request.MotivoCancelamento || 'Sem motivo indicado.'}</p>
                                    </div>
                                </div>

                                <div className="rental-form">
                                    <label>
                                        <span>Observacao da Direcao</span>
                                        <textarea
                                            rows="3"
                                            value={notes[request.IdMarcacao] || ''}
                                            onChange={(event) => onNoteChange(request.IdMarcacao, event.target.value)}
                                            placeholder="Contexto para aprovar ou rejeitar este cancelamento..."
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="rental-actions">
                                <button
                                    type="button"
                                    className="rental-button rental-button--ghost"
                                    onClick={() => onReject(request.IdMarcacao, notes[request.IdMarcacao] || '')}
                                    disabled={saving}
                                >
                                    Rejeitar
                                </button>
                                <button
                                    type="button"
                                    className="rental-button rental-button--warning"
                                    onClick={() => onApprove(request.IdMarcacao, notes[request.IdMarcacao] || '')}
                                    disabled={saving}
                                >
                                    Aprovar Cancelamento
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};

export default CancellationValidationPanel;
