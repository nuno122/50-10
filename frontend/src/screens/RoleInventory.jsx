import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES, ROLE_LABELS } from '../utils/permissions';
import { criarArtigo, editarArtigo, getAlugueres, getInventario, solicitarExtensaoAluguer } from '../services/api';
import { resolveInventoryImageUrl } from '../utils/imagePaths';

const emptyAdForm = {
    Nome: '',
    CustoPorDia: '',
    ImagemPath: '',
    EstadoArtigo: true
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

const getConditionSummary = (item) => {
    const conditions = [...new Set((item.TamanhoArtigo || []).map((size) => size.Condicao || 'Bom'))];
    if (conditions.length === 0) return 'Sem informacao';
    return conditions.join(', ');
};

const getFallbackLabel = (name) => String(name || '?').trim().charAt(0).toUpperCase() || '?';

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
    if (permission === PERMISSOES.PROFESSOR) {
        return 'Publica anuncios, consulta o marketplace e acompanha os alugueres associados a esta conta.';
    }

    return 'Consulta o marketplace, publica anuncios e acompanha os alugueres reais da tua conta.';
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
    const [isAdModalOpen, setIsAdModalOpen] = useState(false);
    const [editingAd, setEditingAd] = useState(null);
    const [adFormData, setAdFormData] = useState(emptyAdForm);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [extensionDate, setExtensionDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [showActiveRentals, setShowActiveRentals] = useState(false);
    const [showPendingRentals, setShowPendingRentals] = useState(false);

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

    const selectedImagePreviewUrl = useMemo(() => (
        selectedImageFile ? URL.createObjectURL(selectedImageFile) : ''
    ), [selectedImageFile]);
    const previewImageUrl = selectedImagePreviewUrl || resolveInventoryImageUrl(adFormData.ImagemPath);

    useEffect(() => () => {
        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
        }
    }, [selectedImagePreviewUrl]);

    const ownRentals = useMemo(() => (
        rentals.filter((rental) => rental.IdUtilizador === user?.Id || rental.Utilizador?.IdUtilizador === user?.Id)
    ), [rentals, user]);

    const activeRentals = useMemo(() => (
        ownRentals.filter((rental) => !isPendingRental(rental) && !isClosedRental(rental))
    ), [ownRentals]);

    const pendingRentals = useMemo(() => (
        ownRentals.filter((rental) => isPendingRental(rental))
    ), [ownRentals]);

    const ownPublishedAds = useMemo(() => (
        inventory.filter((item) => item.IdUtilizadorCriador === user?.Id || item.Criador?.IdUtilizador === user?.Id)
    ), [inventory, user]);

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

    const openCreateAd = () => {
        setEditingAd(null);
        setAdFormData(emptyAdForm);
        setSelectedImageFile(null);
        setIsAdModalOpen(true);
        setError('');
        setFeedback('');
    };

    const openEditAd = (item) => {
        setEditingAd(item);
        setAdFormData({
            Nome: item.Nome || '',
            CustoPorDia: item.CustoPorDia ?? '',
            ImagemPath: item.ImagemPath || '',
            EstadoArtigo: item.EstadoArtigo !== false
        });
        setSelectedImageFile(null);
        setIsAdModalOpen(true);
        setError('');
        setFeedback('');
    };

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

    const handleImageChange = (event) => {
        const file = event.target.files?.[0] || null;

        setSelectedImageFile(file);
        if (file) {
            setAdFormData((current) => ({ ...current, ImagemPath: file.name }));
        }
    };

    const handleSaveAd = async () => {
        if (!adFormData.Nome.trim() || !adFormData.CustoPorDia) {
            setError('Indica pelo menos o nome do artigo e o custo por dia.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const payload = {
                Nome: adFormData.Nome,
                CustoPorDia: adFormData.CustoPorDia,
                ImagemPath: adFormData.ImagemPath,
                EstadoArtigo: adFormData.EstadoArtigo,
                ImagemFile: selectedImageFile
            };

            if (editingAd) {
                await editarArtigo(editingAd.IdArtigo, payload);
                setFeedback('Anuncio atualizado com sucesso.');
            } else {
                await criarArtigo(payload);
                setFeedback('Anuncio publicado com sucesso.');
            }

            setIsAdModalOpen(false);
            setEditingAd(null);
            setAdFormData(emptyAdForm);
            setSelectedImageFile(null);
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel guardar o anuncio.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="inventory-page">
            <div className="inventory-header">
                <div>
                    <p className="inventory-eyebrow">{ROLE_LABELS[user?.Permissoes] || 'Portal'}</p>
                    <h1>Marketplace e Aluguer</h1>
                    <p className="inventory-subtitle">{getRoleSubtitle(user?.Permissoes)}</p>
                </div>

                <button type="button" className="inventory-primary-button" onClick={openCreateAd}>
                    Publicar anuncio
                </button>
            </div>

            <div className="inventory-banner inventory-banner--info">
                Os anuncios do marketplace mostram o email de quem publicou. Os alugueres e pedidos de extensao continuam a ser geridos neste mesmo espaco.
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
                <article className="inventory-card inventory-stat-card">
                    <div>
                        <p>Meus Anuncios</p>
                        <strong>{ownPublishedAds.length}</strong>
                    </div>
                    <span>AD</span>
                </article>
            </div>

            <section className="inventory-role-overview">
                <article className="inventory-card inventory-role-panel">
                    <div className="inventory-role-panel-header">
                        <div>
                            <h2>Em Posse</h2>
                            <p>Alugueres ativos desta conta</p>
                        </div>
                        <strong>{activeRentals.length}</strong>
                    </div>

                    <div className="inventory-role-summary">
                        <p>
                            {activeRentals.length === 0
                                ? 'Sem alugueres ativos nesta conta.'
                                : `${activeRentals.length} aluguer(es) ativo(s) para consultar.`}
                        </p>
                        {activeRentals.length > 0 && (
                            <button
                                type="button"
                                className="inventory-secondary-button"
                                onClick={() => setShowActiveRentals((current) => !current)}
                            >
                                {showActiveRentals ? 'Esconder detalhes' : 'Ver detalhes'}
                            </button>
                        )}
                    </div>
                </article>

                <article className="inventory-card inventory-role-panel">
                    <div className="inventory-role-panel-header">
                        <div>
                            <h2>Pedidos Pendentes</h2>
                            <p>Pedidos ainda por tratar</p>
                        </div>
                        <strong>{pendingRentals.length}</strong>
                    </div>

                    <div className="inventory-role-summary">
                        <p>
                            {pendingRentals.length === 0
                                ? 'Sem pedidos pendentes nesta conta.'
                                : `${pendingRentals.length} pedido(s) pendente(s) para consultar.`}
                        </p>
                        {pendingRentals.length > 0 && (
                            <button
                                type="button"
                                className="inventory-secondary-button"
                                onClick={() => setShowPendingRentals((current) => !current)}
                            >
                                {showPendingRentals ? 'Esconder detalhes' : 'Ver detalhes'}
                            </button>
                        )}
                    </div>
                </article>
            </section>

            {showActiveRentals && (
                <section className="inventory-card inventory-role-panel">
                    <div className="inventory-role-panel-header">
                        <div>
                            <h2>Detalhes em Posse</h2>
                            <p>Lista completa dos alugueres ativos</p>
                        </div>
                        <strong>{activeRentals.length}</strong>
                    </div>

                    <div className="inventory-role-rentals">
                        {activeRentals.map((rental) => (
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
                        ))}
                    </div>
                </section>
            )}

            {showPendingRentals && (
                <section className="inventory-card inventory-role-panel">
                    <div className="inventory-role-panel-header">
                        <div>
                            <h2>Detalhes dos Pendentes</h2>
                            <p>Lista completa dos pedidos ainda por tratar</p>
                        </div>
                        <strong>{pendingRentals.length}</strong>
                    </div>

                    <div className="inventory-role-rentals">
                        {pendingRentals.map((rental) => (
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
                        ))}
                    </div>
                </section>
            )}

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
                    <p>A carregar inventario...</p>
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
                        const imageUrl = resolveInventoryImageUrl(item.ImagemPath);

                        return (
                            <article
                                key={item.IdArtigo}
                                className={`inventory-card inventory-item ${isInactive ? 'inventory-item--inactive' : ''}`}
                            >
                                <div className="inventory-item-media">
                                    {imageUrl ? (
                                        <img className="inventory-item-image" src={imageUrl} alt={item.Nome || 'Imagem do artigo'} />
                                    ) : (
                                        <div className="inventory-item-placeholder">{getFallbackLabel(item.Nome)}</div>
                                    )}
                                </div>

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
                                        <span>Total em stock</span>
                                        <strong>{totalStock}</strong>
                                    </div>
                                    <div className="inventory-meta-row">
                                        <span>Tamanhos</span>
                                        <strong>{(item.TamanhoArtigo || []).length}</strong>
                                    </div>
                                    <div className="inventory-meta-row">
                                        <span>Email do anunciante</span>
                                        <strong>{item.Criador?.Email || 'Anuncio legacy'}</strong>
                                    </div>
                                </div>

                                <div className="inventory-sizes">
                                    <p className="inventory-sizes-title">Tamanhos</p>
                                            {(item.TamanhoArtigo || []).length === 0 ? (
                                                <p className="inventory-size-empty">Sem tamanhos.</p>
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

                                <div className="inventory-modal-actions inventory-modal-actions--inline">
                                    <button type="button" className="inventory-secondary-button" onClick={() => openItemDetails(item)}>
                                        Ver detalhes
                                    </button>
                                    {(item.IdUtilizadorCriador === user?.Id || item.Criador?.IdUtilizador === user?.Id) && (
                                        <button type="button" className="inventory-primary-button" onClick={() => openEditAd(item)}>
                                            Editar anuncio
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

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
                            <p>Imagem do artigo.</p>
                            <div className="inventory-detail-media">
                                {resolveInventoryImageUrl(selectedItem.ImagemPath) ? (
                                    <img
                                        className="inventory-detail-image"
                                        src={resolveInventoryImageUrl(selectedItem.ImagemPath)}
                                        alt={selectedItem.Nome || 'Imagem do artigo'}
                                    />
                                ) : (
                                    <div className="inventory-item-placeholder inventory-item-placeholder--large">
                                        {getFallbackLabel(selectedItem.Nome)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="inventory-form-note">
                            <p>Informacoes do artigo.</p>
                            <div className="inventory-role-detail-grid">
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
                                <div className="inventory-meta-row">
                                    <span>Condicao</span>
                                    <strong>{getConditionSummary(selectedItem)}</strong>
                                </div>
                                <div className="inventory-meta-row">
                                    <span>Email do anunciante</span>
                                    <strong>{selectedItem.Criador?.Email || 'Anuncio legacy'}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="inventory-form-note">
                            <p>Tamanhos, condicao e quantidades.</p>
                            {(selectedItem.TamanhoArtigo || []).length === 0 ? (
                                <p className="inventory-size-empty">Sem tamanhos.</p>
                            ) : (
                                <div className="inventory-size-list">
                                    {selectedItem.TamanhoArtigo.map((size) => (
                                        <div key={size.IdTamanhoArtigo} className="inventory-size-chip">
                                            <span>Tam. {size.Tamanho} | Condicao: {size.Condicao || 'Bom'}</span>
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

            {isAdModalOpen && (
                <div className="inventory-modal-backdrop" onClick={() => setIsAdModalOpen(false)}>
                    <section className="inventory-modal inventory-modal--narrow" onClick={(event) => event.stopPropagation()}>
                        <div className="inventory-modal-header">
                            <div>
                                <p className="inventory-eyebrow">{editingAd ? 'Editar anuncio' : 'Novo anuncio'}</p>
                                <h2>{editingAd ? adFormData.Nome : 'Publicar anuncio'}</h2>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsAdModalOpen(false)}>
                                Fechar
                            </button>
                        </div>

                        <div className="inventory-form">
                            <label>
                                <span>Nome do artigo</span>
                                <input
                                    value={adFormData.Nome}
                                    onChange={(event) => setAdFormData((current) => ({ ...current, Nome: event.target.value }))}
                                    placeholder="Ex: Vestido contemporaneo"
                                />
                            </label>

                            <label>
                                <span>Custo por dia (EUR)</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={adFormData.CustoPorDia}
                                    onChange={(event) => setAdFormData((current) => ({ ...current, CustoPorDia: event.target.value }))}
                                    placeholder="Ex: 8"
                                />
                            </label>

                            <label>
                                <span>Imagem</span>
                                <input type="file" accept="image/*" onChange={handleImageChange} />
                                {adFormData.ImagemPath && (
                                    <small className="inventory-field-hint">
                                        {selectedImageFile ? `Selecionada: ${selectedImageFile.name}` : `Atual: ${adFormData.ImagemPath}`}
                                    </small>
                                )}
                            </label>

                            {previewImageUrl && (
                                <div className="inventory-form-note">
                                    <p>Pre-visualizacao da imagem.</p>
                                    <div className="inventory-detail-media">
                                        <img className="inventory-detail-image" src={previewImageUrl} alt={adFormData.Nome || 'Pre-visualizacao do anuncio'} />
                                    </div>
                                </div>
                            )}

                            {editingAd && (
                                <label className="inventory-switch">
                                    <span>Anuncio ativo</span>
                                    <input
                                        type="checkbox"
                                        checked={adFormData.EstadoArtigo !== false}
                                        onChange={(event) => setAdFormData((current) => ({ ...current, EstadoArtigo: event.target.checked }))}
                                    />
                                </label>
                            )}
                        </div>

                        <div className="inventory-modal-actions">
                            <button type="button" className="inventory-secondary-button" onClick={() => setIsAdModalOpen(false)}>
                                Cancelar
                            </button>
                            <button type="button" className="inventory-primary-button" onClick={handleSaveAd} disabled={submitting}>
                                {submitting ? 'A guardar...' : editingAd ? 'Guardar anuncio' : 'Publicar anuncio'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default RoleInventory;
