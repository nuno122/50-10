import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAlugueres, getInventario, solicitarExtensaoAluguer } from '../services/api';

const PERMISSOES = {
    ALUNO: 1,
    PROFESSOR: 2,
    DIRECAO: 3,
    ENCARREGADO: 4
};

const ROLE_LABELS = {
    [PERMISSOES.ALUNO]: 'Aluno',
    [PERMISSOES.PROFESSOR]: 'Professor',
    [PERMISSOES.ENCARREGADO]: 'Encarregado'
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
}).format(Number(value || 0));

const formatDate = (value) => {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const getTotalStock = (item) => (
    (item.TamanhoArtigo || []).reduce((sum, size) => sum + Number(size.Quantidade || 0), 0)
);

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const isPendingRental = (rental) => normalizeStatus(rental.EstadoAluguer).includes('pend');

const isClosedRental = (rental) => {
    const status = normalizeStatus(rental.EstadoAluguer);
    return ['entregue', 'cancelado', 'concluido', 'concluído', 'devolvido'].some((value) => status.includes(value));
};

const getRentalItems = (rental) => (
    (rental.ArtigoAluguer || []).map((entry) => ({
        id: `${entry.IdAluguer}-${entry.IdTamanhoArtigo}`,
        name: entry.TamanhoArtigo?.Artigo?.Nome || 'Artigo sem nome',
        size: entry.TamanhoArtigo?.Tamanho || '-',
        quantity: Number(entry.Quantidade || 0),
        returnState: entry.EstadoDevolucao || '-'
    }))
);

const getRoleSubtitle = (permission) => {
    if (permission === PERMISSOES.ALUNO) {
        return 'Consulta o inventario disponivel da escola e acompanha os teus alugueres reais.';
    }

    if (permission === PERMISSOES.PROFESSOR) {
        return 'Consulta os artigos disponiveis e acompanha os alugueres associados a esta conta.';
    }

    return 'Consulta o inventario da escola e acompanha os alugueres reais da tua conta.';
};

const RoleInventory = () => {
    const { user } = useAuth();
    const [inventory, setInventory] = useState([]);
    const [rentals, setRentals] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedRental, setSelectedRental] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isExtensionOpen, setIsExtensionOpen] = useState(false);
    const [extensionDate, setExtensionDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [inventoryData, rentalsData] = await Promise.all([
                getInventario(),
                getAlugueres()
            ]);

            setInventory(inventoryData);
            setRentals(rentalsData);
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar o inventario e os alugueres.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const ownRentals = useMemo(() => (
        rentals.filter((rental) => rental.IdUtilizador === user?.Id || rental.Utilizador?.IdUtilizador === user?.Id)
    ), [rentals, user]);

    const activeRentals = useMemo(() => (
        ownRentals.filter((rental) => !isPendingRental(rental) && !isClosedRental(rental))
    ), [ownRentals]);

    const pendingRentals = useMemo(() => (
        ownRentals.filter((rental) => isPendingRental(rental))
    ), [ownRentals]);

    const filteredInventory = useMemo(() => (
        inventory.filter((item) => {
            const totalStock = getTotalStock(item);
            const matchesSearch = item.Nome?.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesStatus = false;
            if (filterStatus === 'all') matchesStatus = true;
            else if (filterStatus === 'available') matchesStatus = item.EstadoArtigo !== false && totalStock > 0;
            else if (filterStatus === 'empty') matchesStatus = item.EstadoArtigo !== false && totalStock === 0;
            else matchesStatus = item.EstadoArtigo === false;

            return matchesSearch && matchesStatus;
        })
    ), [filterStatus, inventory, searchQuery]);

    const availableCount = useMemo(() => (
        inventory.filter((item) => item.EstadoArtigo !== false && getTotalStock(item) > 0).length
    ), [inventory]);

    const openItemDetails = (item) => {
        setSelectedItem(item);
        setIsDetailOpen(true);
    };

    const openExtensionDialog = (rental) => {
        setSelectedRental(rental);
        setExtensionDate('');
        setIsExtensionOpen(true);
        setFeedback('');
    };

    const handleSubmitExtension = async () => {
        if (!selectedRental || !extensionDate) {
            setError('Seleciona uma nova data de entrega antes de enviar o pedido.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            await solicitarExtensaoAluguer(selectedRental.IdAluguer, extensionDate);
            setFeedback('Pedido de extensao enviado com sucesso para aprovacao.');
            setIsExtensionOpen(false);
            setSelectedRental(null);
            setExtensionDate('');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel enviar o pedido de extensao.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="inventory-page">
            <div className="inventory-header">
                <div>
                    <p className="inventory-eyebrow">{ROLE_LABELS[user?.Permissoes] || 'Portal'}</p>
                    <h1>Inventario e Aluguer</h1>
                    <p className="inventory-subtitle">{getRoleSubtitle(user?.Permissoes)}</p>
                </div>
            </div>

            <div className="inventory-banner inventory-banner--info">
                Os novos alugueres continuam a ser pedidos presencialmente na secretaria. Nesta pagina podes consultar o stock real e gerir extensoes dos teus alugueres.
            </div>

            {feedback && <div className="inventory-banner inventory-banner--success">{feedback}</div>}
            {error && <div className="inventory-banner inventory-banner--error">{error}</div>}

            <div className="inventory-stats">
                <article className="inventory-card inventory-stat-card">
                    <div>
                        <p>Artigos Registados</p>
                        <strong>{inventory.length}</strong>
                    </div>
                    <span>PK</span>
                </article>
                <article className="inventory-card inventory-stat-card">
                    <div>
                        <p>Com Stock</p>
                        <strong>{availableCount}</strong>
                    </div>
                    <span>OK</span>
                </article>
                <article className="inventory-card inventory-stat-card">
                    <div>
                        <p>Alugueres da Conta</p>
                        <strong>{ownRentals.length}</strong>
                    </div>
                    <span>AL</span>
                </article>
            </div>

            <div className="inventory-role-layout">
                <aside className="inventory-role-sidebar">
                    <section className="inventory-card inventory-role-panel">
                        <div className="inventory-role-panel-header">
                            <div>
                                <h2>Em Posse</h2>
                                <p>Alugueres ativos desta conta</p>
                            </div>
                            <strong>{activeRentals.length}</strong>
                        </div>

                        <div className="inventory-role-rentals">
                            {activeRentals.length === 0 ? (
                                <p className="inventory-size-empty">Sem alugueres ativos.</p>
                            ) : (
                                activeRentals.map((rental) => (
                                    <article key={rental.IdAluguer} className="inventory-role-rental">
                                        <div className="inventory-role-rental-top">
                                            <div>
                                                <h3>{rental.EstadoAluguer || 'Ativo'}</h3>
                                                <p>Entrega: {formatDate(rental.DataEntrega)}</p>
                                            </div>
                                            <span>{getRentalItems(rental).length} item(ns)</span>
                                        </div>

                                        <div className="inventory-role-rental-items">
                                            {getRentalItems(rental).map((item) => (
                                                <p key={item.id}>
                                                    {item.name} · Tam. {item.size} · Qtd. {item.quantity}
                                                </p>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            className="inventory-primary-button"
                                            onClick={() => openExtensionDialog(rental)}
                                        >
                                            Pedir Extensao
                                        </button>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="inventory-card inventory-role-panel">
                        <div className="inventory-role-panel-header">
                            <div>
                                <h2>Pedidos Pendentes</h2>
                                <p>Pedidos ainda por tratar</p>
                            </div>
                            <strong>{pendingRentals.length}</strong>
                        </div>

                        <div className="inventory-role-rentals">
                            {pendingRentals.length === 0 ? (
                                <p className="inventory-size-empty">Sem pedidos pendentes.</p>
                            ) : (
                                pendingRentals.map((rental) => (
                                    <article key={rental.IdAluguer} className="inventory-role-rental inventory-role-rental--pending">
                                        <div className="inventory-role-rental-top">
                                            <div>
                                                <h3>{rental.EstadoAluguer || 'Pendente'}</h3>
                                                <p>Levantamento: {formatDate(rental.DataLevantamento)}</p>
                                            </div>
                                            <span>{getRentalItems(rental).length} item(ns)</span>
                                        </div>

                                        <div className="inventory-role-rental-items">
                                            {getRentalItems(rental).map((item) => (
                                                <p key={item.id}>
                                                    {item.name} · Tam. {item.size} · Qtd. {item.quantity}
                                                </p>
                                            ))}
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>
                </aside>

                <section className="inventory-role-main">
                    <section className="inventory-card inventory-toolbar">
                        <div className="inventory-search">
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Pesquisar por nome do artigo..."
                            />
                        </div>

                        <div className="inventory-filters">
                            {[
                                ['all', 'Todos'],
                                ['available', 'Disponiveis'],
                                ['empty', 'Sem Stock'],
                                ['inactive', 'Inativos']
                            ].map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={`inventory-filter ${filterStatus === value ? 'inventory-filter--active' : ''}`}
                                    onClick={() => setFilterStatus(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </section>

                    {loading ? (
                        <section className="inventory-card inventory-empty">
                            <p>A carregar inventario real da base de dados...</p>
                        </section>
                    ) : filteredInventory.length === 0 ? (
                        <section className="inventory-card inventory-empty">
                            <p>Nao foram encontrados artigos para os filtros atuais.</p>
                        </section>
                    ) : (
                        <div className="inventory-grid">
                            {filteredInventory.map((item) => {
                                const totalStock = getTotalStock(item);
                                const isInactive = item.EstadoArtigo === false;

                                return (
                                    <article
                                        key={item.IdArtigo}
                                        className={`inventory-card inventory-item ${isInactive ? 'inventory-item--inactive' : ''}`}
                                    >
                                        <div className="inventory-item-top">
                                            <div>
                                                <h3>{item.Nome}</h3>
                                                <p>{formatCurrency(item.CustoPorDia)} / dia</p>
                                            </div>
                                            <div className="inventory-badges">
                                                <span className={`inventory-badge ${totalStock > 0 ? 'inventory-badge--available' : 'inventory-badge--empty'}`}>
                                                    {totalStock > 0 ? 'Disponivel' : 'Sem stock'}
                                                </span>
                                                {isInactive && <span className="inventory-badge inventory-badge--inactive">Inativo</span>}
                                            </div>
                                        </div>

                                        <div className="inventory-meta">
                                            <div className="inventory-meta-row">
                                                <span>Referencia</span>
                                                <strong>{item.IdArtigo}</strong>
                                            </div>
                                            <div className="inventory-meta-row">
                                                <span>Total em stock</span>
                                                <strong>{totalStock}</strong>
                                            </div>
                                            <div className="inventory-meta-row">
                                                <span>Tamanhos registados</span>
                                                <strong>{(item.TamanhoArtigo || []).length}</strong>
                                            </div>
                                        </div>

                                        <div className="inventory-sizes">
                                            <p className="inventory-sizes-title">Tamanhos</p>
                                            {(item.TamanhoArtigo || []).length === 0 ? (
                                                <p className="inventory-size-empty">Sem tamanhos registados.</p>
                                            ) : (
                                                <div className="inventory-size-list">
                                                    {item.TamanhoArtigo.map((size) => (
                                                        <div key={size.IdTamanhoArtigo} className="inventory-size-chip">
                                                            <span>{size.Tamanho}</span>
                                                            <strong>{size.Quantidade}</strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <button type="button" className="inventory-secondary-button" onClick={() => openItemDetails(item)}>
                                            Ver detalhes
                                        </button>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {isDetailOpen && selectedItem && (
                <div className="inventory-modal-backdrop" onClick={() => setIsDetailOpen(false)}>
                    <section className="inventory-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="inventory-modal-header">
                            <div>
                                <p className="inventory-eyebrow">Detalhes do artigo</p>
                                <h2>{selectedItem.Nome}</h2>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsDetailOpen(false)}>
                                Fechar
                            </button>
                        </div>

                        <div className="inventory-form-note">
                            <p>Dados reais do artigo registados na base de dados.</p>
                            <div className="inventory-role-detail-grid">
                                <div className="inventory-meta-row">
                                    <span>Referencia</span>
                                    <strong>{selectedItem.IdArtigo}</strong>
                                </div>
                                <div className="inventory-meta-row">
                                    <span>Custo por dia</span>
                                    <strong>{formatCurrency(selectedItem.CustoPorDia)}</strong>
                                </div>
                                <div className="inventory-meta-row">
                                    <span>Estado</span>
                                    <strong>{selectedItem.EstadoArtigo === false ? 'Inativo' : 'Ativo'}</strong>
                                </div>
                                <div className="inventory-meta-row">
                                    <span>Total em stock</span>
                                    <strong>{getTotalStock(selectedItem)}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="inventory-form-note">
                            <p>Tamanhos e quantidades registados.</p>
                            {(selectedItem.TamanhoArtigo || []).length === 0 ? (
                                <p className="inventory-size-empty">Sem tamanhos registados.</p>
                            ) : (
                                <div className="inventory-size-list">
                                    {selectedItem.TamanhoArtigo.map((size) => (
                                        <div key={size.IdTamanhoArtigo} className="inventory-size-chip">
                                            <span>{size.Tamanho}</span>
                                            <strong>{size.Quantidade}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {isExtensionOpen && selectedRental && (
                <div className="inventory-modal-backdrop" onClick={() => setIsExtensionOpen(false)}>
                    <section className="inventory-modal inventory-modal--narrow" onClick={(event) => event.stopPropagation()}>
                        <div className="inventory-modal-header">
                            <div>
                                <p className="inventory-eyebrow">Pedido de extensao</p>
                                <h2>Atualizar data de entrega</h2>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsExtensionOpen(false)}>
                                Fechar
                            </button>
                        </div>

                        <div className="inventory-form">
                            <div className="inventory-form-note">
                                <p>Aluguer selecionado</p>
                                <div className="inventory-role-rental-items">
                                    {getRentalItems(selectedRental).map((item) => (
                                        <p key={item.id}>
                                            {item.name} · Tam. {item.size} · Qtd. {item.quantity}
                                        </p>
                                    ))}
                                </div>
                                <div className="inventory-role-detail-grid">
                                    <div className="inventory-meta-row">
                                        <span>Entrega atual</span>
                                        <strong>{formatDate(selectedRental.DataEntrega)}</strong>
                                    </div>
                                    <div className="inventory-meta-row">
                                        <span>Estado</span>
                                        <strong>{selectedRental.EstadoAluguer || '-'}</strong>
                                    </div>
                                </div>
                            </div>

                            <label>
                                <span>Nova data de entrega</span>
                                <input
                                    type="date"
                                    value={extensionDate}
                                    onChange={(event) => setExtensionDate(event.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </label>
                        </div>

                        <div className="inventory-modal-actions">
                            <button type="button" className="inventory-secondary-button" onClick={() => setIsExtensionOpen(false)}>
                                Cancelar
                            </button>
                            <button type="button" className="inventory-primary-button" onClick={handleSubmitExtension} disabled={submitting}>
                                {submitting ? 'A enviar...' : 'Enviar pedido'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default RoleInventory;
