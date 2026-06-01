import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS, PERMISSOES } from '../utils/permissions';
import {
    getAlugueres,
    getInventario,
    getUtilizadores,
    criarArtigo,
    editarArtigo,
    criarAluguer,
    registarDevolucaoAluguer,
    solicitarExtensaoAluguer,
    avaliarPedidoExtensao
} from '../services/api';
import { resolveInventoryImageUrl } from '../utils/imagePaths';

const SIZE_CONDITIONS = ['Bom', 'Muito bom', 'Usado', 'Danificado'];

const createEmptySize = () => ({
    IdTamanhoArtigo: '',
    Tamanho: '',
    Quantidade: 0,
    Condicao: 'Bom'
});

const createEmptyForm = () => ({
    Nome: '',
    CustoPorDia: '',
    ImagemPath: '',
    EstadoArtigo: true,
    DisponivelParaAluguer: true,
    TamanhoArtigo: [createEmptySize()]
});

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

const getFallbackLabel = (name) => String(name || '?').trim().charAt(0).toUpperCase() || '?';
const getUserId = (user) => user?.IdUtilizador || user?.Id || null;

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const isPendingRental = (rental) => normalizeStatus(rental.EstadoAluguer).includes('pend');

const isClosedRental = (rental) => {
    const status = normalizeStatus(rental.EstadoAluguer);
    return ['entregue', 'cancelado', 'concluido', 'concluído', 'devolvido'].some((value) => status.includes(value));
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

const roleLabel = (permission) => {
    switch (permission) {
        case PERMISSOES.PROFESSOR: return 'Professor';
        case PERMISSOES.DIRECAO: return 'Direção';
        case PERMISSOES.ENCARREGADO: return 'Encarregado';
        default: return 'Utilizador';
    }
};

const buildUserLabel = (u) => `${u.NomeCompleto} (${roleLabel(u.Permissoes)})`;
const buildItemLabel = (size) => `${size.Artigo?.Nome || 'Artigo'} (${size.Tamanho})`;

const buildSizeDrafts = (sizes = []) => (
    sizes.length > 0
        ? sizes.map((size) => ({
            IdTamanhoArtigo: size.IdTamanhoArtigo || '',
            Tamanho: size.Tamanho || '',
            Quantidade: Number(size.Quantidade || 0),
            Condicao: size.Condicao || 'Bom'
        }))
        : [createEmptySize()]
);

const buildSizePayload = (sizes = []) => (
    sizes
        .map((size) => {
            const quantidade = Number(size.Quantidade ?? 0);
            const tamanho = String(size.Tamanho || '').trim() || (quantidade > 0 ? 'Único' : '');
            return {
                ...(size.IdTamanhoArtigo ? { IdTamanhoArtigo: size.IdTamanhoArtigo } : {}),
                Tamanho: tamanho,
                Quantidade: quantidade,
                Condicao: String(size.Condicao || 'Bom').trim() || 'Bom'
            };
        })
        .filter((size) => size.Tamanho)
);

const TAB_MARKETPLACE = 'marketplace';
const TAB_MY_ARTICLES = 'my_articles';
const TAB_MY_RENTALS  = 'my_rentals';
const TAB_OWNER_RENTALS = 'owner_rentals';

const RoleRental = () => {
    const { user } = useAuth();

    /* ---- shared state ---- */
    const [inventory, setInventory] = useState([]);
    const [myArticles, setMyArticles] = useState([]);
    const [rentals, setRentals] = useState([]);
    const [ownerRentals, setOwnerRentals] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    /* ---- tab ---- */
    const [activeTab, setActiveTab] = useState(TAB_MARKETPLACE);

    /* ---- marketplace filters ---- */
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    /* ---- item detail modal ---- */
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    /* ---- rental modals ---- */
    const [selectedRental, setSelectedRental] = useState(null);
    const [isExtensionOpen, setIsExtensionOpen] = useState(false);
    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [extensionDate, setExtensionDate] = useState('');
    const [returnState, setReturnState] = useState('good');
    const [fineAmount, setFineAmount] = useState('');

    /* ---- manual rental creation (for owner_rentals) ---- */
    const [newUser, setNewUser] = useState('');
    const [newItem, setNewItem] = useState('');
    const [newReturnDate, setNewReturnDate] = useState('');

    /* ---- article form (create / edit) ---- */
    const [isAdModalOpen, setIsAdModalOpen] = useState(false);
    const [editingAd, setEditingAd] = useState(null);
    const [adFormData, setAdFormData] = useState(createEmptyForm());
    const [selectedImageFile, setSelectedImageFile] = useState(null);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [inventoryData, myArticlesData, rentalsData, ownerRentalsData, usersData] = await Promise.all([
                getInventario({ disponivelParaAluguer: true }),
                getInventario({ mine: true }),
                getAlugueres(),
                getAlugueres({ asOwner: true }),
                getUtilizadores()
            ]);
            setInventory((inventoryData || []).filter((item) => item.EstadoArtigo !== false));
            setMyArticles(myArticlesData || []);
            setRentals(rentalsData);
            setOwnerRentals(ownerRentalsData);
            setUsersList((usersData || []).filter((u) => u.EstaAtivo !== false));
        } catch (err) {
            setError(err.message || 'Não foi possível carregar os dados do marketplace.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    /* ---- Computed values ---- */
    const ownRentals = useMemo(() => (
        rentals.filter((rental) => {
            const userId = getUserId(user);
            return rental.IdUtilizador === userId || rental.Utilizador?.IdUtilizador === userId;
        })
    ), [rentals, user]);

    const activeRentals = useMemo(() => ownRentals.filter((r) => !isClosedRental(r)), [ownRentals]);

    const activeOwnerRentals = useMemo(() => ownerRentals.filter((r) => !isClosedRental(r)), [ownerRentals]);
    const closedOwnerRentals = useMemo(() => ownerRentals.filter((r) => isClosedRental(r)), [ownerRentals]);

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

    const availableCount = useMemo(() => inventory.filter((item) => item.EstadoArtigo !== false && getTotalStock(item) > 0).length, [inventory]);

    const selectableMySizes = useMemo(() => (
        myArticles
            .filter((item) => item.EstadoArtigo !== false && item.DisponivelParaAluguer !== false)
            .flatMap((item) => (item.TamanhoArtigo || [])
                .filter((size) => Number(size.Quantidade || 0) > 0)
                .map((size) => ({ ...size, Artigo: item })))
    ), [myArticles]);

    const selectedImagePreviewUrl = useMemo(() => (selectedImageFile ? URL.createObjectURL(selectedImageFile) : ''), [selectedImageFile]);
    const previewImageUrl = selectedImagePreviewUrl || resolveInventoryImageUrl(adFormData.ImagemPath);

    useEffect(() => () => {
        if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);
    }, [selectedImagePreviewUrl]);

    /* ---- Handlers ---- */
    const openItemDetails = (item) => {
        setSelectedItem(item);
        setIsDetailOpen(true);
    };

    const openExtensionDialog = (rental) => {
        setSelectedRental(rental);
        setExtensionDate('');
        setError('');
        setFeedback('');
        setIsExtensionOpen(true);
    };

    const openReturnDialog = (rental) => {
        setSelectedRental(rental);
        setReturnState('good');
        setFineAmount('');
        setError('');
        setFeedback('');
        setIsReturnOpen(true);
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
            setFeedback('Pedido de extensão enviado com sucesso.');
            setIsExtensionOpen(false);
            setSelectedRental(null);
            setExtensionDate('');
            await loadData();
        } catch (err) {
            setError(err.message || 'Não foi possível enviar o pedido de extensão.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleApproveExtension = async (rental) => {
        const request = getPendingExtension(rental);
        if (!request) return;
        setSubmitting(true);
        setError('');
        try {
            await avaliarPedidoExtensao(request.IdPedido, true, Number(request.ValorAdicional || 0));
            setFeedback('Extensão de prazo aprovada com sucesso.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Não foi possível aprovar o pedido de extensão.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRejectExtension = async (rental) => {
        const request = getPendingExtension(rental);
        if (!request) return;
        setSubmitting(true);
        setError('');
        try {
            await avaliarPedidoExtensao(request.IdPedido, false, 0);
            setFeedback('Pedido de extensão rejeitado.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Não foi possível rejeitar o pedido de extensão.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitReturn = async () => {
        if (!selectedRental) return;
        if (returnState === 'bad' && (!fineAmount || Number.isNaN(Number(fineAmount)) || Number(fineAmount) <= 0)) {
            setError('Introduza um valor de multa válido para registar uma devolução danificada.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await registarDevolucaoAluguer(
                selectedRental.IdAluguer,
                returnState === 'bad' ? 'Danificado' : 'Em boas condicoes',
                returnState === 'bad' ? Number(fineAmount) : 0
            );
            setFeedback('Devolução registada com sucesso.');
            setIsReturnOpen(false);
            setSelectedRental(null);
            setReturnState('good');
            setFineAmount('');
            await loadData();
        } catch (err) {
            setError(err.message || 'Não foi possível registar a devolução.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateRental = async () => {
        if (!newUser || !newItem || !newReturnDate) {
            setError('Preenche utilizador, artigo e data prevista de entrega.');
            return;
        }
        setSubmitting(true);
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
            setFeedback('Aluguer registado com sucesso.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Não foi possível registar o aluguer presencial.');
        } finally {
            setSubmitting(false);
        }
    };

    const openCreateAd = () => {
        setEditingAd(null);
        setAdFormData(createEmptyForm());
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
            EstadoArtigo: item.EstadoArtigo !== false,
            DisponivelParaAluguer: item.DisponivelParaAluguer === true,
            TamanhoArtigo: buildSizeDrafts(item.TamanhoArtigo || [])
        });
        setSelectedImageFile(null);
        setIsAdModalOpen(true);
        setError('');
        setFeedback('');
    };

    const handleImageChange = (event) => {
        const file = event.target.files?.[0] || null;
        setSelectedImageFile(file);
        if (file) setAdFormData((current) => ({ ...current, ImagemPath: file.name }));
    };

    const handleSizeChange = (index, field, value) => {
        setAdFormData((current) => ({
            ...current,
            TamanhoArtigo: current.TamanhoArtigo.map((size, sizeIndex) => (
                sizeIndex === index
                    ? { ...size, [field]: field === 'Quantidade' ? (value === '' ? '' : Number(value)) : value }
                    : size
            ))
        }));
    };

    const addSizeRow = () => {
        setAdFormData((current) => ({
            ...current,
            TamanhoArtigo: [...current.TamanhoArtigo, createEmptySize()]
        }));
    };

    const removeSizeRow = (index) => {
        setAdFormData((current) => {
            const nextSizes = current.TamanhoArtigo.filter((_, sizeIndex) => sizeIndex !== index);
            return { ...current, TamanhoArtigo: nextSizes.length > 0 ? nextSizes : [createEmptySize()] };
        });
    };

    const handleSaveAd = async () => {
        const sizePayload = buildSizePayload(adFormData.TamanhoArtigo);
        if (!adFormData.Nome.trim() || !adFormData.CustoPorDia) {
            setError('Indica pelo menos o nome do artigo e o custo por dia.');
            return;
        }
        if (sizePayload.length === 0) {
            setError('Define pelo menos um tamanho com quantidade.');
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
                DisponivelParaAluguer: adFormData.DisponivelParaAluguer,
                TamanhoArtigo: sizePayload,
                ImagemFile: selectedImageFile
            };
            if (editingAd) {
                await editarArtigo(editingAd.IdArtigo, payload);
                setFeedback('Artigo atualizado com sucesso.');
            } else {
                await criarArtigo(payload);
                setFeedback('Artigo publicado com sucesso no Marketplace!');
            }
            setIsAdModalOpen(false);
            setEditingAd(null);
            setAdFormData(createEmptyForm());
            setSelectedImageFile(null);
            await loadData();
        } catch (err) {
            setError(err.message || 'Não foi possível guardar o artigo.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="inventory-page">
            <div className="inventory-header">
                <div>
                    <p className="inventory-eyebrow">{ROLE_LABELS[user?.Permissoes] || 'Portal'}</p>
                    <h1>Marketplace</h1>
                    <p className="inventory-subtitle">Publica e gere os teus artigos, consulta o catálogo e acompanha os teus alugueres.</p>
                </div>
                <button type="button" className="inventory-primary-button" onClick={openCreateAd}>
                    Novo artigo
                </button>
            </div>

            {feedback && <div className="inventory-banner inventory-banner--success">{feedback}</div>}
            {error && !isAdModalOpen && !isExtensionOpen && !isReturnOpen && (
                <div className="inventory-banner inventory-banner--error">{error}</div>
            )}

            <div className="inventory-stats" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                <article
                    className={`inventory-card inventory-stat-card ${activeTab === TAB_MARKETPLACE ? 'inventory-stat-card--active' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveTab(TAB_MARKETPLACE)}
                >
                    <div>
                        <p>Catálogo</p>
                        <strong>{inventory.length}</strong>
                    </div>
                    <span>🛒</span>
                </article>
                <article
                    className={`inventory-card inventory-stat-card ${activeTab === TAB_MY_ARTICLES ? 'inventory-stat-card--active' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveTab(TAB_MY_ARTICLES)}
                >
                    <div>
                        <p>Meus Artigos</p>
                        <strong>{myArticles.length}</strong>
                    </div>
                    <span>📦</span>
                </article>
                <article
                    className={`inventory-card inventory-stat-card ${activeTab === TAB_MY_RENTALS ? 'inventory-stat-card--active' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveTab(TAB_MY_RENTALS)}
                >
                    <div>
                        <p>Meus Alugueres</p>
                        <strong>{activeRentals.length}</strong>
                    </div>
                    <span>📋</span>
                </article>
                <article
                    className={`inventory-card inventory-stat-card ${activeTab === TAB_OWNER_RENTALS ? 'inventory-stat-card--active' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveTab(TAB_OWNER_RENTALS)}
                >
                    <div>
                        <p>Alugueres a Clientes</p>
                        <strong>{ownerRentals.length}</strong>
                    </div>
                    <span>🤝</span>
                </article>
            </div>

            {activeTab === TAB_MARKETPLACE && (
                <>
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
                                ['available', 'Disponíveis'],
                                ['empty', 'Sem Stock']
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
                            <p>A carregar artigos do marketplace...</p>
                        </section>
                    ) : filteredInventory.length === 0 ? (
                        <section className="inventory-card inventory-empty">
                            <p>Não foram encontrados artigos para os filtros atuais.</p>
                        </section>
                    ) : (
                        <div className="inventory-grid">
                            {filteredInventory.map((item) => {
                                const totalStock = getTotalStock(item);
                                const isInactive = item.EstadoArtigo === false;
                                const imageUrl = resolveInventoryImageUrl(item.ImagemPath);
                                const isOwner = item.IdUtilizadorCriador === getUserId(user);

                                return (
                                    <article key={item.IdArtigo} className={`inventory-card inventory-item ${isInactive ? 'inventory-item--inactive' : ''}`}>
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
                                                    {totalStock > 0 ? 'Disponível' : 'Sem stock'}
                                                </span>
                                                {isOwner && <span className="inventory-badge inventory-badge--available">Meu</span>}
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
                                                <span>Publicado por</span>
                                                <strong>{item.Criador?.Email || 'Sem registo'}</strong>
                                            </div>
                                        </div>
                                        <div className="inventory-modal-actions inventory-modal-actions--inline">
                                            <button type="button" className="inventory-secondary-button" onClick={() => openItemDetails(item)}>
                                                Ver detalhes
                                            </button>
                                            {isOwner && (
                                                <button type="button" className="inventory-primary-button" onClick={() => openEditAd(item)}>
                                                    Editar
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {activeTab === TAB_MY_ARTICLES && (
                <>
                    {loading ? (
                        <section className="inventory-card inventory-empty">
                            <p>A carregar os teus artigos...</p>
                        </section>
                    ) : myArticles.length === 0 ? (
                        <section className="inventory-card inventory-empty">
                            <p>Ainda não publicaste nenhum artigo.</p>
                            <button type="button" className="inventory-primary-button" onClick={openCreateAd} style={{ marginTop: '16px' }}>
                                Criar o meu primeiro artigo
                            </button>
                        </section>
                    ) : (
                        <div className="inventory-grid">
                            {myArticles.map((item) => {
                                const totalStock = getTotalStock(item);
                                const isInactive = item.EstadoArtigo === false;
                                const imageUrl = resolveInventoryImageUrl(item.ImagemPath);

                                return (
                                    <article key={item.IdArtigo} className={`inventory-card inventory-item ${isInactive ? 'inventory-item--inactive' : ''}`}>
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
                                                {item.DisponivelParaAluguer ? (
                                                    <span className="inventory-badge inventory-badge--available">No Marketplace</span>
                                                ) : (
                                                    <span className="inventory-badge inventory-badge--empty">Apenas Inventário</span>
                                                )}
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
                                        </div>
                                        <div className="inventory-modal-actions inventory-modal-actions--inline">
                                            <button type="button" className="inventory-secondary-button" onClick={() => openItemDetails(item)}>
                                                Ver detalhes
                                            </button>
                                            <button type="button" className="inventory-primary-button" onClick={() => openEditAd(item)}>
                                                Editar
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {activeTab === TAB_MY_RENTALS && (
                <div className="inventory-role-main" style={{ width: '100%' }}>
                    <section className="inventory-card inventory-role-panel">
                        <div className="inventory-role-panel-header">
                            <div>
                                <h2>Meus Alugueres</h2>
                                <p>Todos os teus pedidos em curso e pendentes.</p>
                            </div>
                            <strong>{activeRentals.length}</strong>
                        </div>
                        {activeRentals.length === 0 ? (
                            <p className="inventory-size-empty">Não tens alugueres em curso.</p>
                        ) : (
                            <div className="inventory-role-rentals">
                                {activeRentals.map((rental) => (
                                    <article key={rental.IdAluguer} className="inventory-card inventory-role-rental">
                                        <div className="inventory-role-rental-top">
                                            <div>
                                                <span className={`inventory-badge ${isPendingRental(rental) ? 'inventory-badge--empty' : 'inventory-badge--available'}`}>
                                                    {isPendingRental(rental) ? 'Pendente' : 'Em curso'}
                                                </span>
                                                <h3>Devolução até {formatDate(rental.DataEntrega)}</h3>
                                                <p>Registado a {formatDate(rental.DataLevantamento)}</p>
                                            </div>
                                        </div>
                                        <div className="inventory-role-rental-items">
                                            <p>Artigos:</p>
                                            <ul>
                                                {getRentalItems(rental).map((item) => (
                                                    <li key={item.id}>{item.name} ({item.size}) - Qtd. {item.quantity}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="inventory-modal-actions inventory-modal-actions--inline">
                                            <button type="button" className="inventory-primary-button" onClick={() => openExtensionDialog(rental)}>
                                                Solicitar extensão
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {activeTab === TAB_OWNER_RENTALS && (
                <div className="inventory-role-main" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                    {/* Move the new rental form to the top */}
                    <section className="inventory-card inventory-role-panel">
                        <div className="inventory-role-panel-header">
                            <div>
                                <h2>Novo Aluguer Manual</h2>
                                <p>Regista presencialmente um aluguer para um cliente com os teus artigos.</p>
                            </div>
                        </div>
                        <div className="inventory-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                            <label>
                                <span>Cliente</span>
                                <select value={newUser} onChange={(e) => setNewUser(e.target.value)}>
                                    <option value="">Selecione o utilizador</option>
                                    {usersList.map((u) => (
                                        <option key={u.IdUtilizador} value={u.IdUtilizador}>{buildUserLabel(u)}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>O teu artigo a alugar</span>
                                <select value={newItem} onChange={(e) => setNewItem(e.target.value)}>
                                    <option value="">Selecione o artigo</option>
                                    {selectableMySizes.map((size) => (
                                        <option key={size.IdTamanhoArtigo} value={size.IdTamanhoArtigo}>
                                            {buildItemLabel(size)} - Stock {size.Quantidade}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>Data de entrega prevista</span>
                                <input
                                    type="date"
                                    value={newReturnDate}
                                    onChange={(e) => setNewReturnDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </label>
                            <button type="button" className="inventory-primary-button" onClick={handleCreateRental} disabled={submitting}>
                                {submitting ? 'A registar...' : 'Registar Aluguer'}
                            </button>
                        </div>
                    </section>

                    <section className="inventory-card inventory-role-panel">
                        <div className="inventory-role-panel-header">
                            <div>
                                <h2>Alugueres a Clientes</h2>
                                <p>Histórico e estado atual de quem alugou os teus artigos.</p>
                            </div>
                            <strong>{ownerRentals.length}</strong>
                        </div>
                        {ownerRentals.length === 0 ? (
                            <p className="inventory-size-empty">Nenhum cliente alugou os teus artigos ainda.</p>
                        ) : (
                            <div className="inventory-role-rentals">
                                {activeOwnerRentals.map((rental) => {
                                    const pendingExtension = getPendingExtension(rental);
                                    const pendingFine = getPendingFine(rental);
                                    return (
                                        <article key={rental.IdAluguer} className="inventory-card inventory-role-rental">
                                            <div className="inventory-role-rental-top">
                                                <div>
                                                    <span className={`inventory-badge ${isPendingRental(rental) ? 'inventory-badge--empty' : 'inventory-badge--available'}`}>
                                                        {isPendingRental(rental) ? 'Pendente' : 'Em curso'}
                                                    </span>
                                                    {pendingFine && (
                                                        <span className="inventory-badge inventory-badge--inactive" style={{ marginLeft: '8px' }}>Multa: {formatCurrency(pendingFine.Custo)}</span>
                                                    )}
                                                    <h3>Cliente: {rental.Utilizador?.NomeCompleto || 'Utilizador'}</h3>
                                                    <p>Levantado: {formatDate(rental.DataLevantamento)} | Entrega prevista: {formatDate(rental.DataEntrega)}</p>
                                                </div>
                                            </div>
                                            <div className="inventory-role-rental-items">
                                                <p>Artigos teus alugados:</p>
                                                <ul>
                                                    {getRentalItems(rental).map((item) => (
                                                        <li key={item.id}>{item.name} ({item.size}) - Qtd. {item.quantity}</li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {pendingExtension && (
                                                <div className="inventory-form-note inventory-form-note--highlight" style={{ marginTop: '16px' }}>
                                                    <p style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Pedido de Extensão de Prazo</p>
                                                    <p style={{ margin: '0 0 12px' }}>Nova data pedida: {formatDate(pendingExtension.NovaDataProposta)}</p>
                                                    <div className="inventory-modal-actions inventory-modal-actions--inline">
                                                        <button type="button" className="inventory-secondary-button" onClick={() => handleRejectExtension(rental)} disabled={submitting}>Rejeitar</button>
                                                        <button type="button" className="inventory-primary-button" onClick={() => handleApproveExtension(rental)} disabled={submitting}>Aprovar</button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="inventory-modal-actions inventory-modal-actions--inline" style={{ marginTop: '16px' }}>
                                                <button type="button" className="inventory-primary-button" onClick={() => openReturnDialog(rental)}>
                                                    Registar Devolução
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}

                                {closedOwnerRentals.length > 0 && (
                                    <>
                                        <h3 style={{ marginTop: '24px', color: '#1c2e44' }}>Concluídos / Histórico</h3>
                                        {closedOwnerRentals.map((rental) => (
                                            <article key={rental.IdAluguer} className="inventory-card inventory-role-rental" style={{ opacity: 0.8 }}>
                                                <div className="inventory-role-rental-top">
                                                    <div>
                                                        <span className="inventory-badge inventory-badge--empty">Concluído</span>
                                                        <h3>Cliente: {rental.Utilizador?.NomeCompleto || 'Utilizador'}</h3>
                                                        <p>Entrega real: {rental.EstadoAluguer}</p>
                                                    </div>
                                                </div>
                                            </article>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* Modals */}
            {isDetailOpen && selectedItem && (
                <div className="inventory-modal-backdrop" onClick={() => setIsDetailOpen(false)}>
                    <section className="inventory-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="inventory-modal-header">
                            <div>
                                <p className="inventory-eyebrow">Detalhes do artigo</p>
                                <h2>{selectedItem.Nome}</h2>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsDetailOpen(false)}>Fechar</button>
                        </div>
                        <div className="inventory-grid">
                            <div className="inventory-detail-media">
                                {resolveInventoryImageUrl(selectedItem.ImagemPath) ? (
                                    <img className="inventory-detail-image" src={resolveInventoryImageUrl(selectedItem.ImagemPath)} alt={selectedItem.Nome} />
                                ) : (
                                    <div className="inventory-item-placeholder inventory-item-placeholder--large">{getFallbackLabel(selectedItem.Nome)}</div>
                                )}
                            </div>
                            <div className="inventory-form">
                                <div className="inventory-meta">
                                    <div className="inventory-meta-row"><span>Custo diário</span><strong>{formatCurrency(selectedItem.CustoPorDia)}</strong></div>
                                    <div className="inventory-meta-row"><span>Publicado por</span><strong>{selectedItem.Criador?.Email || 'Sem registo'}</strong></div>
                                    <div className="inventory-meta-row"><span>Estado</span><strong>{selectedItem.EstadoArtigo === false ? 'Inativo' : 'Ativo'}</strong></div>
                                </div>
                                <div className="inventory-sizes">
                                    <p className="inventory-sizes-title">Stock por tamanho</p>
                                    <div className="inventory-size-list">
                                        {(selectedItem.TamanhoArtigo || []).map((size) => (
                                            <div key={size.IdTamanhoArtigo} className="inventory-size-chip">
                                                <div className="inventory-size-chip-copy">
                                                    <span className="inventory-size-chip-label">{size.Tamanho}</span>
                                                    <small>{size.Condicao}</small>
                                                </div>
                                                <strong>{size.Quantidade} un.</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {isExtensionOpen && selectedRental && (
                <div className="inventory-modal-backdrop" onClick={() => setIsExtensionOpen(false)}>
                    <section className="inventory-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="inventory-modal-header">
                            <div>
                                <p className="inventory-eyebrow">Aluguer #{selectedRental.IdAluguer}</p>
                                <h2>Pedir mais tempo</h2>
                                <p className="inventory-modal-subtitle">Indica até que data precisas de prolongar o aluguer.</p>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsExtensionOpen(false)}>Fechar</button>
                        </div>
                        <div className="inventory-form">
                            <label>
                                <span>Nova data proposta</span>
                                <input
                                    type="date"
                                    value={extensionDate}
                                    onChange={(event) => setExtensionDate(event.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </label>
                            {error && <div className="inventory-banner inventory-banner--error">{error}</div>}
                            <div className="inventory-modal-actions">
                                <button type="button" className="inventory-secondary-button" onClick={() => setIsExtensionOpen(false)}>Cancelar</button>
                                <button type="button" className="inventory-primary-button" onClick={handleSubmitExtension} disabled={submitting || !extensionDate}>
                                    {submitting ? 'A enviar...' : 'Enviar Pedido'}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {isReturnOpen && selectedRental && (
                <div className="inventory-modal-backdrop" onClick={() => setIsReturnOpen(false)}>
                    <section className="inventory-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="inventory-modal-header">
                            <div>
                                <p className="inventory-eyebrow">Aluguer #{selectedRental.IdAluguer}</p>
                                <h2>Registar Devolução</h2>
                                <p className="inventory-modal-subtitle">Verifica o estado do artigo ao receberes de volta.</p>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsReturnOpen(false)}>Fechar</button>
                        </div>
                        <div className="inventory-form">
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
                            {error && <div className="inventory-banner inventory-banner--error">{error}</div>}
                            <div className="inventory-modal-actions">
                                <button type="button" className="inventory-secondary-button" onClick={() => setIsReturnOpen(false)}>Cancelar</button>
                                <button type="button" className="inventory-primary-button" onClick={handleSubmitReturn} disabled={submitting}>
                                    {submitting ? 'A registar...' : 'Confirmar Devolução'}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {isAdModalOpen && (
                <div className="inventory-modal-backdrop" onClick={() => setIsAdModalOpen(false)}>
                    <section className="inventory-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="inventory-modal-header">
                            <div>
                                <p className="inventory-eyebrow">{editingAd ? 'Editar artigo' : 'Novo artigo'}</p>
                                <h2>{editingAd ? 'Atualizar artigo' : 'Adicionar artigo'}</h2>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsAdModalOpen(false)}>Fechar</button>
                        </div>
                        <div className="inventory-form">
                            <div className="inventory-form-note inventory-form-note--highlight">
                                <p>Dados principais</p>
                                <label><span>Nome</span><input value={adFormData.Nome} onChange={(e) => setAdFormData((c) => ({ ...c, Nome: e.target.value }))} /></label>
                                <label><span>Custo por dia (EUR)</span><input type="number" step="0.01" value={adFormData.CustoPorDia} onChange={(e) => setAdFormData((c) => ({ ...c, CustoPorDia: e.target.value }))} /></label>
                                <label className="inventory-switch inventory-switch--spaced">
                                    <span>Disponível para aluguer</span>
                                    <input type="checkbox" checked={adFormData.DisponivelParaAluguer === true} onChange={(e) => setAdFormData((c) => ({ ...c, DisponivelParaAluguer: e.target.checked }))} />
                                </label>
                            </div>
                            <label><span>Imagem</span><input type="file" accept="image/*" onChange={handleImageChange} /></label>
                            {previewImageUrl && (
                                <div className="inventory-form-note">
                                    <div className="inventory-detail-media"><img className="inventory-detail-image" src={previewImageUrl} alt="Preview" /></div>
                                </div>
                            )}
                            {!editingAd ? null : (
                                <label className="inventory-switch">
                                    <span>Artigo ativo</span>
                                    <input type="checkbox" checked={adFormData.EstadoArtigo !== false} onChange={(e) => setAdFormData((c) => ({ ...c, EstadoArtigo: e.target.checked }))} />
                                </label>
                            )}
                            <div className="inventory-form-note">
                                <p>Stock por tamanho</p>
                                <div className="inventory-stock-editor">
                                    {adFormData.TamanhoArtigo.map((size, index) => (
                                        <div key={size.IdTamanhoArtigo || `new-${index}`} className="inventory-stock-card">
                                            <div className="inventory-stock-card-header">
                                                <strong>{`Tamanho ${index + 1}`}</strong>
                                                {!size.IdTamanhoArtigo && adFormData.TamanhoArtigo.length > 1 && (
                                                    <button type="button" className="inventory-secondary-button" onClick={() => removeSizeRow(index)}>Remover</button>
                                                )}
                                            </div>
                                            <div className="inventory-role-detail-grid inventory-role-detail-grid--triple">
                                                <label><span>Tamanho</span><input value={size.Tamanho} onChange={(e) => handleSizeChange(index, 'Tamanho', e.target.value)} /></label>
                                                <label><span>Quantidade</span><input type="number" min="0" value={size.Quantidade} onChange={(e) => handleSizeChange(index, 'Quantidade', e.target.value)} /></label>
                                                <label>
                                                    <span>Condição</span>
                                                    <select value={size.Condicao} onChange={(e) => handleSizeChange(index, 'Condicao', e.target.value)}>
                                                        {SIZE_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                                                    </select>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="inventory-stock-editor-actions" style={{ marginTop: '16px' }}>
                                    <button type="button" className="inventory-secondary-button" onClick={addSizeRow}>Adicionar tamanho</button>
                                </div>
                            </div>
                        </div>
                        {error && <div className="inventory-banner inventory-banner--error" style={{ marginTop: '16px' }}>{error}</div>}
                        <div className="inventory-modal-actions">
                            <button type="button" className="inventory-secondary-button" onClick={() => setIsAdModalOpen(false)}>Cancelar</button>
                            <button type="button" className="inventory-primary-button" onClick={handleSaveAd} disabled={submitting}>
                                {submitting ? 'A guardar...' : editingAd ? 'Guardar' : 'Publicar'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default RoleRental;
