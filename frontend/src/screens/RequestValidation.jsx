import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../utils/permissions';
import {
    avaliarPedidoExtensao,
    criarAluguer,
    getAlugueres,
    getInventario,
    getUtilizadores,
    registarDevolucaoAluguer
} from '../services/api';

const roleLabel = (permission) => {
    switch (permission) {
        case PERMISSOES.ALUNO:
            return 'Aluno';
        case PERMISSOES.PROFESSOR:
            return 'Professor';
        case PERMISSOES.DIRECAO:
            return 'Direcao';
        case PERMISSOES.ENCARREGADO:
            return 'Encarregado';
        default:
            return 'Utilizador';
    }
};

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
}).format(Number(value || 0));

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const isCompletedRental = (rental) => {
    const status = normalizeStatus(rental.EstadoAluguer);
    return ['entregue', 'concluido', 'concluído', 'cancelado', 'devolvido'].some((value) => status.includes(value));
};

const toFilterStatus = (rental) => (isCompletedRental(rental) ? 'completed' : 'active');

const parseSortableDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getRentalItems = (rental) => (
    (rental.ArtigoAluguer || []).map((entry) => ({
        id: `${rental.IdAluguer}-${entry.IdTamanhoArtigo}`,
        name: entry.TamanhoArtigo?.Artigo?.Nome || 'Artigo sem nome',
        size: entry.TamanhoArtigo?.Tamanho || '-',
        category: entry.TamanhoArtigo?.Artigo?.Nome || 'Geral',
        quantity: Number(entry.Quantidade || 0)
    }))
);

const getPendingExtension = (rental) => (
    (rental.PedidoExtensao || []).find((request) => normalizeStatus(request.EstadoAprovacao) === 'pendente')
);

const getPendingFine = (rental) => (
    (rental.Pagamento || []).find((payment) => payment.IdAluguer && normalizeStatus(payment.EstadoPagamento) !== 'pago')
);

const buildUserLabel = (user) => `${user.NomeCompleto} (${roleLabel(user.Permissoes)})`;

const buildItemLabel = (size) => {
    const articleName = size.Artigo?.Nome || 'Artigo';
    return `${articleName} (${size.Tamanho})`;
};

const RequestValidation = ({ embedded = false }) => {
    const { logout } = useAuth();
    const [rentals, setRentals] = useState([]);
    const [users, setUsers] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [selectedRental, setSelectedRental] = useState(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [returnRental, setReturnRental] = useState(null);
    const [returnState, setReturnState] = useState('good');
    const [fineAmount, setFineAmount] = useState('');
    const [newUser, setNewUser] = useState('');
    const [newItem, setNewItem] = useState('');
    const [newReturnDate, setNewReturnDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortField, setSortField] = useState('requestDate');
    const [sortOrder, setSortOrder] = useState('desc');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [rentalsData, usersData, inventoryData] = await Promise.all([
                getAlugueres(),
                getUtilizadores(),
                getInventario()
            ]);

            setRentals(rentalsData);
            setUsers(usersData.filter((user) => user.EstaAtivo !== false));
            setInventory(inventoryData);
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar os dados dos alugueres.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const selectableSizes = useMemo(() => (
        inventory
            .filter((item) => item.EstadoArtigo !== false)
            .flatMap((item) => (item.TamanhoArtigo || [])
                .filter((size) => Number(size.Quantidade || 0) > 0)
                .map((size) => ({
                    ...size,
                    Artigo: item
                })))
    ), [inventory]);

    const sortedRentals = useMemo(() => (
        [...rentals].sort((a, b) => {
            const leftValue = sortField === 'requestDate' ? a.DataLevantamento : a.DataEntrega;
            const rightValue = sortField === 'requestDate' ? b.DataLevantamento : b.DataEntrega;
            const diff = parseSortableDate(leftValue) - parseSortableDate(rightValue);
            return sortOrder === 'asc' ? diff : -diff;
        })
    ), [rentals, sortField, sortOrder]);

    const filteredRentals = useMemo(() => (
        filterStatus === 'all'
            ? sortedRentals
            : sortedRentals.filter((rental) => toFilterStatus(rental) === filterStatus)
    ), [filterStatus, sortedRentals]);

    const activeCount = useMemo(() => rentals.filter((rental) => toFilterStatus(rental) === 'active').length, [rentals]);
    const completedCount = useMemo(() => rentals.filter((rental) => toFilterStatus(rental) === 'completed').length, [rentals]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }

        setSortField(field);
        setSortOrder('desc');
    };

    const openReturnModal = (rental) => {
        setReturnRental(rental);
        setReturnState('good');
        setFineAmount('');
        setIsReturnModalOpen(true);
        setFeedback('');
    };

    const handleApproveExtension = async (rental) => {
        const request = getPendingExtension(rental);
        if (!request) return;

        setSaving(true);
        setError('');

        try {
            await avaliarPedidoExtensao(request.IdPedido, true, Number(request.ValorAdicional || 0));
            setFeedback('Extensao de prazo aprovada com sucesso.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel aprovar o pedido de extensao.');
        } finally {
            setSaving(false);
        }
    };

    const handleRejectExtension = async (rental) => {
        const request = getPendingExtension(rental);
        if (!request) return;

        setSaving(true);
        setError('');

        try {
            await avaliarPedidoExtensao(request.IdPedido, false, 0);
            setFeedback('Pedido de extensao rejeitado.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel rejeitar o pedido de extensao.');
        } finally {
            setSaving(false);
        }
    };

    const handleFinalizeReturn = async () => {
        if (!returnRental) return;

        if (returnState === 'bad' && (!fineAmount || Number.isNaN(Number(fineAmount)) || Number(fineAmount) <= 0)) {
            setError('Introduz um valor de multa valido para registar uma devolucao danificada.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            await registarDevolucaoAluguer(
                returnRental.IdAluguer,
                returnState === 'bad' ? 'Danificado' : 'Em boas condicoes',
                returnState === 'bad' ? Number(fineAmount) : 0
            );

            setFeedback(returnState === 'bad'
                ? `Devolucao registada com multa pendente de ${formatCurrency(fineAmount)}.`
                : 'Devolucao registada com sucesso.');
            setIsReturnModalOpen(false);
            setSelectedRental(null);
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel registar a devolucao.');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateRental = async () => {
        if (!newUser || !newItem || !newReturnDate) {
            setError('Preenche utilizador, artigo e data prevista de entrega.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            await criarAluguer({
                IdUtilizador: newUser,
                DataLevantamento: new Date().toISOString().split('T')[0],
                DataEntrega: newReturnDate,
                ListaArtigos: [{ IdTamanhoArtigo: newItem, Quantidade: 1 }]
            });

            setNewUser('');
            setNewItem('');
            setNewReturnDate('');
            setFeedback('Aluguer presencial registado com sucesso.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel registar o aluguer presencial.');
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
                        <h1>Gestao de Requisicoes / Alugueres</h1>
                        <p className="rental-subtitle">
                            Gira entregas, devolucoes e pedidos de extensao.
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
                                    <p>Ativos</p>
                                    <strong>{activeCount}</strong>
                                </div>
                                <span>AT</span>
                            </article>

                            <article className="rental-card rental-stat-card">
                                <div>
                                    <p>Concluidos</p>
                                    <strong>{completedCount}</strong>
                                </div>
                                <span>OK</span>
                            </article>
                        </div>

                        <section className="rental-card rental-toolbar">
                            <div className="rental-filter-group">
                                {[
                                    ['all', 'Todos'],
                                    ['active', 'Ativos'],
                                    ['completed', 'Concluidos']
                                ].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`rental-button ${filterStatus === value ? 'rental-button--primary' : 'rental-button--ghost'}`}
                                        onClick={() => setFilterStatus(value)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className="rental-filter-group">
                                <button
                                    type="button"
                                    className="rental-button rental-button--ghost"
                                    onClick={() => handleSort('requestDate')}
                                >
                                    Data de Requisicao
                                </button>
                                <button
                                    type="button"
                                    className="rental-button rental-button--ghost"
                                    onClick={() => handleSort('returnDate')}
                                >
                                    Data de Entrega
                                </button>
                            </div>
                        </section>

                        <section className="rental-card rental-list-card">
                            {loading ? (
                                <div className="rental-empty">
                                    <p className="rental-empty-title">A carregar alugueres...</p>
                                    <p className="rental-empty-copy">A preparar os registos de aluguer.</p>
                                </div>
                            ) : filteredRentals.length === 0 ? (
                                <div className="rental-empty">
                                    <p className="rental-empty-title">Nenhum registo encontrado</p>
                                    <p className="rental-empty-copy">Nao existem alugueres para os filtros atuais.</p>
                                </div>
                            ) : (
                                <div className="rental-list">
                                    {filteredRentals.map((rental) => {
                                        const pendingExtension = getPendingExtension(rental);
                                        const pendingFine = getPendingFine(rental);
                                        const isActive = toFilterStatus(rental) === 'active';

                                        return (
                                            <article key={rental.IdAluguer} className="rental-item">
                                                <div className="rental-item-main">
                                                    <div className="rental-item-top">
                                                        <div className="rental-badges">
                                                            <span className={`rental-badge ${isActive ? 'rental-badge--active' : 'rental-badge--completed'}`}>
                                                                {isActive ? 'Ativo' : 'Concluido'}
                                                            </span>
                                                            <span className="rental-badge rental-badge--muted">
                                                                {getRentalItems(rental).length} artigo(s)
                                                            </span>
                                                            {pendingFine && (
                                                                <span className="rental-badge rental-badge--danger">
                                                                    Multa: {formatCurrency(pendingFine.Custo)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="rental-grid">
                                                        <div>
                                                            <span className="rental-label">Solicitado por</span>
                                                            <p>{rental.Utilizador?.NomeCompleto || 'Utilizador'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="rental-label">Data de requisicao</span>
                                                            <p>{formatDate(rental.DataLevantamento)}</p>
                                                        </div>
                                                        <div>
                                                            <span className="rental-label">Data de entrega atual</span>
                                                            <p>{formatDate(rental.DataEntrega)}</p>
                                                        </div>
                                                        <div>
                                                            <span className="rental-label">Estado real</span>
                                                            <p>{rental.EstadoAluguer || '-'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="rental-chip-list">
                                                        {getRentalItems(rental).map((item) => (
                                                            <span key={item.id} className="rental-chip">
                                                                {item.name} ({item.size}) · Qtd. {item.quantity}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {pendingExtension && (
                                                        <div className="rental-extension">
                                                            <div>
                                                                <p className="rental-extension-title">Pedido de Extensao de Prazo</p>
                                                                <p>Nova data pedida: {formatDate(pendingExtension.NovaDataProposta)}</p>
                                                                <p>Data do pedido: {formatDate(pendingExtension.DataPedido)}</p>
                                                            </div>
                                                            <div className="rental-extension-actions">
                                                                <button
                                                                    type="button"
                                                                    className="rental-button rental-button--ghost"
                                                                    onClick={() => handleRejectExtension(rental)}
                                                                    disabled={saving}
                                                                >
                                                                    Rejeitar
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="rental-button rental-button--warning"
                                                                    onClick={() => handleApproveExtension(rental)}
                                                                    disabled={saving}
                                                                >
                                                                    Aprovar nova data
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="rental-actions">
                                                    {isActive && (
                                                        <button
                                                            type="button"
                                                            className="rental-button rental-button--primary"
                                                            onClick={() => openReturnModal(rental)}
                                                        >
                                                            Registar Devolucao
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="rental-button rental-button--ghost"
                                                        onClick={() => setSelectedRental(rental)}
                                                    >
                                                        Ver detalhes
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>

                    <aside className="rental-side">
                        <section className="rental-card rental-form-card">
                            <div className="rental-form-header">
                                <h2>Novo Aluguer Presencial</h2>
                                <p>Cria um novo aluguer a partir dos dados disponiveis.</p>
                            </div>

                            <div className="rental-form">
                                <label>
                                    <span>Utilizador</span>
                                    <select value={newUser} onChange={(event) => setNewUser(event.target.value)}>
                                        <option value="">Selecione o utilizador</option>
                                        {users.map((user) => (
                                            <option key={user.IdUtilizador} value={user.IdUtilizador}>
                                                {buildUserLabel(user)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span>Artigo/Figurino e Tamanho</span>
                                    <select value={newItem} onChange={(event) => setNewItem(event.target.value)}>
                                        <option value="">Selecione o artigo</option>
                                        {selectableSizes.map((size) => (
                                            <option key={size.IdTamanhoArtigo} value={size.IdTamanhoArtigo}>
                                                {buildItemLabel(size)} · Stock {size.Quantidade}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span>Data prevista de entrega</span>
                                    <input
                                        type="date"
                                        value={newReturnDate}
                                        onChange={(event) => setNewReturnDate(event.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </label>

                                <button
                                    type="button"
                                    className="rental-button rental-button--dark"
                                    onClick={handleCreateRental}
                                    disabled={saving}
                                >
                                    {saving ? 'A guardar...' : 'Registar Aluguer Presencial'}
                                </button>
                            </div>
                        </section>
                    </aside>
                </div>
            </section>

            {isReturnModalOpen && returnRental && (
                <div className="rental-modal-backdrop" onClick={() => setIsReturnModalOpen(false)}>
                    <section className="rental-modal rental-modal--small" onClick={(event) => event.stopPropagation()}>
                        <div className="rental-modal-header">
                            <div>
                                <p className="rental-eyebrow">Registar devolucao</p>
                                <h2>Confirmar estado da entrega</h2>
                            </div>
                            <button type="button" className="rental-button rental-button--ghost" onClick={() => setIsReturnModalOpen(false)}>
                                Fechar
                            </button>
                        </div>

                            <div className="rental-summary">
                                <div className="rental-summary-row">
                                    <span>Utilizador</span>
                                    <strong>{returnRental.Utilizador?.NomeCompleto || 'Utilizador'}</strong>
                                </div>
                            <div className="rental-summary-row">
                                <span>Artigo(s)</span>
                                <strong>{getRentalItems(returnRental).map((item) => `${item.name} (${item.size})`).join(', ')}</strong>
                            </div>
                        </div>

                        <div className="rental-form">
                            <label>
                                <span>Estado de entrega</span>
                                <select value={returnState} onChange={(event) => setReturnState(event.target.value)}>
                                    <option value="good">Em boas condicoes</option>
                                    <option value="bad">Mas condicoes / Danificado</option>
                                </select>
                            </label>

                            {returnState === 'bad' && (
                                <label>
                                    <span>Aplicar multa (EUR)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={fineAmount}
                                        onChange={(event) => setFineAmount(event.target.value)}
                                        placeholder="0.00"
                                    />
                                </label>
                            )}
                        </div>

                        <div className="rental-modal-actions">
                            <button type="button" className="rental-button rental-button--ghost" onClick={() => setIsReturnModalOpen(false)}>
                                Cancelar
                            </button>
                            <button type="button" className="rental-button rental-button--primary" onClick={handleFinalizeReturn} disabled={saving}>
                                {saving ? 'A guardar...' : 'Confirmar Devolucao'}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {selectedRental && (
                <div className="rental-modal-backdrop" onClick={() => setSelectedRental(null)}>
                    <section className="rental-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="rental-modal-header">
                            <div>
                                <p className="rental-eyebrow">Detalhes da requisicao</p>
                                <h2>Aluguer</h2>
                            </div>
                            <button type="button" className="rental-button rental-button--ghost" onClick={() => setSelectedRental(null)}>
                                Fechar
                            </button>
                        </div>

                        <div className="rental-detail-grid">
                            <div>
                                <span className="rental-label">Status</span>
                                <p>{toFilterStatus(selectedRental) === 'active' ? 'Ativo' : 'Concluido'}</p>
                            </div>
                            <div>
                                <span className="rental-label">Solicitado por</span>
                                <p>{selectedRental.Utilizador?.NomeCompleto || 'Utilizador'}</p>
                            </div>
                            <div>
                                <span className="rental-label">Data de requisicao</span>
                                <p>{formatDate(selectedRental.DataLevantamento)}</p>
                            </div>
                            <div>
                                <span className="rental-label">Data de entrega</span>
                                <p>{formatDate(selectedRental.DataEntrega)}</p>
                            </div>
                            <div>
                                <span className="rental-label">Estado real</span>
                                <p>{selectedRental.EstadoAluguer || '-'}</p>
                            </div>
                            <div>
                                <span className="rental-label">Multa pendente</span>
                                <p>{getPendingFine(selectedRental) ? formatCurrency(getPendingFine(selectedRental).Custo) : 'Sem multa'}</p>
                            </div>
                        </div>

                        <div className="rental-detail-items">
                            <h3>Artigos requisitados</h3>
                            {getRentalItems(selectedRental).map((item) => (
                                <div key={item.id} className="rental-detail-item">
                                    <div>
                                        <p>{item.name} ({item.size})</p>
                                        <small>Quantidade: {item.quantity}</small>
                                    </div>
                                    <strong>{item.category}</strong>
                                </div>
                            ))}
                        </div>

                        <div className="rental-modal-actions">
                            <button type="button" className="rental-button rental-button--ghost" onClick={() => setSelectedRental(null)}>
                                Fechar
                            </button>
                            {toFilterStatus(selectedRental) === 'active' && (
                                <button
                                    type="button"
                                    className="rental-button rental-button--primary"
                                    onClick={() => {
                                        setSelectedRental(null);
                                        openReturnModal(selectedRental);
                                    }}
                                >
                                    Registar Devolucao
                                </button>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
};

export default RequestValidation;
