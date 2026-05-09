import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ROLE_LABELS } from '../utils/permissions';
import { criarArtigo, editarArtigo, getInventario } from '../services/api';
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
    DisponivelParaAluguer: false,
    TamanhoArtigo: [createEmptySize()]
});

const formatCurrency = (value) => new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
}).format(Number(value || 0));

const getTotalStock = (item) => (
    (item.TamanhoArtigo || []).reduce((sum, size) => sum + Number(size.Quantidade || 0), 0)
);

const getConditionSummary = (item) => {
    const conditions = [...new Set((item.TamanhoArtigo || []).map((size) => size.Condicao || 'Bom'))];
    if (conditions.length === 0) return 'Sem informação';
    return conditions.join(', ');
};

const getFallbackLabel = (name) => String(name || '?').trim().charAt(0).toUpperCase() || '?';

const getRoleSubtitle = (permission) => {
    if (ROLE_LABELS[permission]) {
        return 'Consulta e gere apenas os artigos publicados pela tua conta.';
    }

    return 'Consulta e gere apenas os teus artigos.';
};

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

const RoleInventory = () => {
    const { user } = useAuth();
    const { notify, refreshSnapshot } = useNotifications();
    const [inventory, setInventory] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isAdModalOpen, setIsAdModalOpen] = useState(false);
    const [editingAd, setEditingAd] = useState(null);
    const [adFormData, setAdFormData] = useState(createEmptyForm());
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const inventoryData = await getInventario({ mine: true });
            setInventory(inventoryData);
        } catch (err) {
            setError(err.message || 'Não foi possível carregar o inventário.');
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

    const inactiveCount = useMemo(() => (
        inventory.filter((item) => item.EstadoArtigo === false).length
    ), [inventory]);

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

    const openItemDetails = (item) => {
        setSelectedItem(item);
        setIsDetailOpen(true);
    };

    const handleImageChange = (event) => {
        const file = event.target.files?.[0] || null;
        setSelectedImageFile(file);

        if (file) {
            setAdFormData((current) => ({ ...current, ImagemPath: file.name }));
        }
    };

    const handleSizeChange = (index, field, value) => {
        setAdFormData((current) => ({
            ...current,
            TamanhoArtigo: current.TamanhoArtigo.map((size, sizeIndex) => (
                sizeIndex === index
                    ? {
                        ...size,
                        [field]: field === 'Quantidade'
                            ? (value === '' ? '' : Number(value))
                            : value
                    }
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
            return {
                ...current,
                TamanhoArtigo: nextSizes.length > 0 ? nextSizes : [createEmptySize()]
            };
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
                await refreshSnapshot();
                notify({
                    title: 'Artigo atualizado',
                    message: `${adFormData.Nome || 'O artigo'} foi atualizado com sucesso.`,
                    tone: 'success'
                });
                setFeedback('Artigo atualizado com sucesso.');
            } else {
                await criarArtigo(payload);
                await refreshSnapshot();
                notify({
                    title: 'Artigo publicado',
                    message: `${adFormData.Nome || 'O artigo'} foi publicado no teu inventário.`,
                    tone: 'success'
                });
                setFeedback('Artigo publicado com sucesso.');
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
                    <h1>Meu inventário</h1>
                    <p className="inventory-subtitle">{getRoleSubtitle(user?.Permissoes)}</p>
                </div>

                <button type="button" className="inventory-primary-button" onClick={openCreateAd}>
                    Novo artigo
                </button>
            </div>

            {feedback && <div className="inventory-banner inventory-banner--success">{feedback}</div>}
            {error && <div className="inventory-banner inventory-banner--error">{error}</div>}

            <div className="inventory-stats">
                <article className="inventory-card inventory-stat-card">
                    <div>
                        <p>Meus Artigos</p>
                        <strong>{inventory.length}</strong>
                    </div>
                    <span>IT</span>
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
                        <p>Inativos</p>
                        <strong>{inactiveCount}</strong>
                    </div>
                    <span>OFF</span>
                </article>
            </div>

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
                    <p>A carregar inventário...</p>
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
                                            {totalStock > 0 ? 'Disponível' : 'Sem stock'}
                                        </span>
                                        {item.DisponivelParaAluguer === true && (
                                            <span className="inventory-badge inventory-badge--available">Para aluguer</span>
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
                                    <div className="inventory-meta-row">
                                        <span>Condição</span>
                                        <strong>{getConditionSummary(item)}</strong>
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
                                    <button type="button" className="inventory-primary-button" onClick={() => openEditAd(item)}>
                                        Editar artigo
                                    </button>
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
                            <p>Informações do artigo.</p>
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
                                    <span>Disponível para aluguer</span>
                                    <strong>{selectedItem.DisponivelParaAluguer === true ? 'Sim' : 'Não'}</strong>
                                </div>
                                <div className="inventory-meta-row">
                                    <span>Total em stock</span>
                                    <strong>{getTotalStock(selectedItem)}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="inventory-form-note">
                            <p>Tamanhos, condição e quantidades.</p>
                            {(selectedItem.TamanhoArtigo || []).length === 0 ? (
                                <p className="inventory-size-empty">Sem tamanhos.</p>
                            ) : (
                                <div className="inventory-size-list">
                                    {selectedItem.TamanhoArtigo.map((size) => (
                                        <div key={size.IdTamanhoArtigo} className="inventory-size-chip">
                                            <span>{`Tam. ${size.Tamanho} | Condição: ${size.Condicao || 'Bom'}`}</span>
                                            <strong>{size.Quantidade}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                <h2>{editingAd ? adFormData.Nome : 'Publicar artigo'}</h2>
                                <p className="inventory-modal-subtitle">
                                    Organiza os dados principais do artigo e gere o stock por tamanho num só passo.
                                </p>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsAdModalOpen(false)}>
                                Fechar
                            </button>
                        </div>

                        <div className="inventory-form">
                            <div className="inventory-form-note inventory-form-note--highlight">
                                <p>Dados principais</p>

                                <label>
                                    <span>Nome do artigo</span>
                                    <input
                                        value={adFormData.Nome}
                                        onChange={(event) => setAdFormData((current) => ({ ...current, Nome: event.target.value }))}
                                        placeholder="Ex: Vestido contemporâneo"
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

                                <label className="inventory-switch inventory-switch--spaced">
                                    <span>Disponibilizar para aluguer</span>
                                    <input
                                        type="checkbox"
                                        checked={adFormData.DisponivelParaAluguer === true}
                                        onChange={(event) => setAdFormData((current) => ({ ...current, DisponivelParaAluguer: event.target.checked }))}
                                    />
                                </label>

                                <small className="inventory-field-hint">
                                    {adFormData.DisponivelParaAluguer
                                        ? 'Este artigo também aparecerá no catálogo público de aluguer.'
                                        : 'Este artigo ficará visível apenas no teu inventário.'}
                                </small>
                            </div>

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
                                    <p>Pré-visualização da imagem.</p>
                                    <div className="inventory-detail-media">
                                        <img className="inventory-detail-image" src={previewImageUrl} alt={adFormData.Nome || 'Pré-visualização do artigo'} />
                                    </div>
                                </div>
                            )}

                            {editingAd && (
                                <label className="inventory-switch">
                                    <span>Artigo ativo</span>
                                    <input
                                        type="checkbox"
                                        checked={adFormData.EstadoArtigo !== false}
                                        onChange={(event) => setAdFormData((current) => ({ ...current, EstadoArtigo: event.target.checked }))}
                                    />
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
                                                    <button
                                                        type="button"
                                                        className="inventory-secondary-button"
                                                        onClick={() => removeSizeRow(index)}
                                                    >
                                                        Remover
                                                    </button>
                                                )}
                                            </div>

                                            <div className="inventory-role-detail-grid inventory-role-detail-grid--triple">
                                                <label>
                                                    <span>Tamanho</span>
                                                    <input
                                                        value={size.Tamanho}
                                                        onChange={(event) => handleSizeChange(index, 'Tamanho', event.target.value)}
                                                        placeholder="Ex: M"
                                                    />
                                                </label>

                                                <label>
                                                    <span>Quantidade</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={size.Quantidade}
                                                        onChange={(event) => handleSizeChange(index, 'Quantidade', event.target.value)}
                                                    />
                                                </label>

                                                <label>
                                                    <span>Condição</span>
                                                    <select
                                                        value={size.Condicao}
                                                        onChange={(event) => handleSizeChange(index, 'Condicao', event.target.value)}
                                                    >
                                                        {SIZE_CONDITIONS.map((condition) => (
                                                            <option key={condition} value={condition}>{condition}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="inventory-stock-editor-actions">
                                    <button type="button" className="inventory-secondary-button" onClick={addSizeRow}>
                                        Adicionar tamanho
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="inventory-modal-actions">
                            <button type="button" className="inventory-secondary-button" onClick={() => setIsAdModalOpen(false)}>
                                Cancelar
                            </button>
                            <button type="button" className="inventory-primary-button" onClick={handleSaveAd} disabled={submitting}>
                                {submitting ? 'A guardar...' : editingAd ? 'Guardar artigo' : 'Publicar artigo'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default RoleInventory;
