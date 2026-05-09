import React, { useEffect, useMemo, useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { criarArtigo, editarArtigo, getInventario } from '../services/api';
import { resolveInventoryImageUrl } from '../utils/imagePaths';

const SIZE_CONDITIONS = ['Bom', 'Muito bom', 'Usado', 'Danificado'];

const createEmptySize = () => ({
    IdTamanhoArtigo: '',
    Tamanho: '',
    Quantidade: 0,
    Condicao: 'Bom'
});

const createEmptyForm = (disponivelParaAluguer = false) => ({
    Nome: '',
    CustoPorDia: '',
    ImagemPath: '',
    EstadoArtigo: true,
    DisponivelParaAluguer: disponivelParaAluguer,
    TamanhoArtigo: [createEmptySize()]
});

const getTotalStock = (item) => (
    (item.TamanhoArtigo || []).reduce((sum, size) => sum + Number(size.Quantidade || 0), 0)
);

const getConditionSummary = (item) => {
    const conditions = [...new Set((item.TamanhoArtigo || []).map((size) => size.Condicao || 'Bom'))];
    if (conditions.length === 0) return 'Sem informação';
    return conditions.join(', ');
};

const getFallbackLabel = (name) => String(name || '?').trim().charAt(0).toUpperCase() || '?';

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

const InventoryManagement = ({ inventoryType = 'marketplace' }) => {
    const { user } = useAuth();
    const { notify, refreshSnapshot } = useNotifications();
    const isRentalCatalog = inventoryType === 'rental';
    const [inventory, setInventory] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState(createEmptyForm(isRentalCatalog));
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const pageCopy = {
        title: isRentalCatalog ? 'Catálogo de aluguer' : 'Meu inventário',
        subtitle: isRentalCatalog
            ? 'Todos veem aqui os artigos disponibilizados para aluguer e o respetivo stock.'
            : 'Consulta e gere apenas os artigos criados pela tua conta.',
        button: isRentalCatalog ? 'Adicionar artigo de aluguer' : 'Adicionar artigo',
        loading: isRentalCatalog ? 'A carregar artigos de aluguer...' : 'A carregar inventário...',
        saveError: isRentalCatalog ? 'Não foi possível guardar o artigo de aluguer.' : 'Não foi possível guardar o artigo.',
        publishTitle: isRentalCatalog ? 'Artigo de aluguer criado' : 'Artigo publicado',
        publishMessage: isRentalCatalog
            ? `${formData.Nome || 'O artigo'} ficou disponível no catálogo de aluguer.`
            : `${formData.Nome || 'O artigo'} foi guardado no teu inventário.`,
        updateTitle: isRentalCatalog ? 'Artigo de aluguer atualizado' : 'Artigo atualizado',
        updateMessage: isRentalCatalog
            ? `${formData.Nome || 'O artigo'} foi atualizado no catálogo de aluguer.`
            : `${formData.Nome || 'O artigo'} foi atualizado no teu inventário.`
    };

    const loadInventory = async () => {
        setLoading(true);
        setError('');

        try {
            const data = await getInventario(
                isRentalCatalog
                    ? { disponivelParaAluguer: true }
                    : { mine: true }
            );
            const visibleData = (data || []).filter((item) => {
                if (isRentalCatalog) {
                    return item.EstadoArtigo !== false;
                }

                return true;
            });
            setInventory(visibleData);
        } catch (err) {
            setError(err.message || 'Não foi possível carregar o inventário.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInventory();
    }, [isRentalCatalog, user?.IdUtilizador]);

    const filteredInventory = useMemo(() => (
        inventory.filter((item) => {
            const matchesSearch = item.Nome?.toLowerCase().includes(searchQuery.toLowerCase());
            const totalStock = getTotalStock(item);

            let matchesStatus = false;
            if (filterStatus === 'all') matchesStatus = true;
            else if (filterStatus === 'inactive') matchesStatus = item.EstadoArtigo === false;
            else if (filterStatus === 'available') matchesStatus = item.EstadoArtigo !== false && totalStock > 0;
            else matchesStatus = item.EstadoArtigo !== false && totalStock === 0;

            return matchesSearch && matchesStatus;
        })
    ), [filterStatus, inventory, searchQuery]);

    const availableCount = inventory.filter((item) => item.EstadoArtigo !== false && getTotalStock(item) > 0).length;
    const outOfStockCount = inventory.filter((item) => item.EstadoArtigo !== false && getTotalStock(item) === 0).length;

    const selectedImagePreviewUrl = useMemo(() => (
        selectedImageFile ? URL.createObjectURL(selectedImageFile) : ''
    ), [selectedImageFile]);
    const previewImageUrl = selectedImagePreviewUrl || resolveInventoryImageUrl(formData.ImagemPath);

    useEffect(() => () => {
        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
        }
    }, [selectedImagePreviewUrl]);

    const openCreate = () => {
        setIsCreating(true);
        setSelectedItem(null);
        setFormData(createEmptyForm(isRentalCatalog));
        setSelectedImageFile(null);
        setIsDialogOpen(true);
    };

    const openEdit = (item) => {
        setIsCreating(false);
        setSelectedItem(item);
        setFormData({
            Nome: item.Nome || '',
            CustoPorDia: item.CustoPorDia ?? '',
            ImagemPath: item.ImagemPath || '',
            EstadoArtigo: item.EstadoArtigo !== false,
            DisponivelParaAluguer: item.DisponivelParaAluguer === true,
            TamanhoArtigo: buildSizeDrafts(item.TamanhoArtigo || [])
        });
        setSelectedImageFile(null);
        setIsDialogOpen(true);
        setError('');
    };

    const handleImageChange = (event) => {
        const file = event.target.files?.[0] || null;
        setSelectedImageFile(file);

        if (file) {
            setFormData((current) => ({ ...current, ImagemPath: file.name }));
        }
    };

    const handleSizeChange = (index, field, value) => {
        setFormData((current) => ({
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
        setFormData((current) => ({
            ...current,
            TamanhoArtigo: [...current.TamanhoArtigo, createEmptySize()]
        }));
    };

    const removeSizeRow = (index) => {
        setFormData((current) => {
            const nextSizes = current.TamanhoArtigo.filter((_, sizeIndex) => sizeIndex !== index);
            return {
                ...current,
                TamanhoArtigo: nextSizes.length > 0 ? nextSizes : [createEmptySize()]
            };
        });
    };

    const handleSave = async () => {
        const sizePayload = buildSizePayload(formData.TamanhoArtigo);

        if (!formData.Nome.trim() || !formData.CustoPorDia) {
            setError('Indica pelo menos o nome do artigo e o custo por dia.');
            return;
        }

        if (sizePayload.length === 0) {
            setError('Define pelo menos um tamanho com quantidade.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const payload = {
                Nome: formData.Nome,
                CustoPorDia: formData.CustoPorDia,
                ImagemPath: formData.ImagemPath,
                EstadoArtigo: formData.EstadoArtigo,
                DisponivelParaAluguer: formData.DisponivelParaAluguer,
                TamanhoArtigo: sizePayload,
                ImagemFile: selectedImageFile
            };

            if (isCreating) {
                await criarArtigo(payload);
                await refreshSnapshot();
                notify({
                    title: pageCopy.publishTitle,
                    message: pageCopy.publishMessage,
                    tone: 'success'
                });
            } else if (selectedItem) {
                await editarArtigo(selectedItem.IdArtigo, payload);
                await refreshSnapshot();
                notify({
                    title: pageCopy.updateTitle,
                    message: pageCopy.updateMessage,
                    tone: 'success'
                });
            }

            setIsDialogOpen(false);
            setSelectedItem(null);
            setFormData(createEmptyForm(isRentalCatalog));
            setSelectedImageFile(null);
            await loadInventory();
        } catch (err) {
            setError(err.message || pageCopy.saveError);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="inventory-page">
            <div className="inventory-header">
                <div>
                    <p className="inventory-eyebrow">Direção</p>
                    <h1>{pageCopy.title}</h1>
                    <p className="inventory-subtitle">{pageCopy.subtitle}</p>
                </div>

                <button type="button" className="inventory-primary-button" onClick={openCreate}>
                    {pageCopy.button}
                </button>
            </div>

            {error && <div className="inventory-banner inventory-banner--error">{error}</div>}

            <div className="inventory-stats">
                <article className="inventory-card inventory-stat-card">
                    <div>
                        <p>Total de Artigos</p>
                        <strong>{inventory.length}</strong>
                    </div>
                    <span>PK</span>
                </article>
                <article className="inventory-card inventory-stat-card">
                    <div>
                        <p>Disponíveis</p>
                        <strong>{availableCount}</strong>
                    </div>
                    <span>OK</span>
                </article>
                <article className="inventory-card inventory-stat-card">
                    <div>
                        <p>Sem Stock</p>
                        <strong>{outOfStockCount}</strong>
                    </div>
                    <span>ST</span>
                </article>
            </div>

            <section className="inventory-card inventory-toolbar">
                <div className="inventory-search">
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Pesquisar por nome..."
                    />
                </div>

                <div className="inventory-filters">
                    {[
                        ['all', 'Todos'],
                        ['available', 'Disponíveis'],
                        ['rented', 'Sem Stock'],
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
                    <p>{pageCopy.loading}</p>
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
                                        <p>{`EUR ${Number(item.CustoPorDia || 0).toFixed(2)} / dia`}</p>
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
                                        <span>Condição</span>
                                        <strong>{getConditionSummary(item)}</strong>
                                    </div>
                                    <div className="inventory-meta-row">
                                        <span>Email do criador</span>
                                        <strong>{item.Criador?.Email || 'Artigo antigo'}</strong>
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

                                <button type="button" className="inventory-secondary-button" onClick={() => openEdit(item)}>
                                    Editar
                                </button>
                            </article>
                        );
                    })}
                </div>
            )}

            {isDialogOpen && (
                <div className="inventory-modal-backdrop" onClick={() => setIsDialogOpen(false)}>
                    <section className="inventory-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="inventory-modal-header">
                            <div>
                                <p className="inventory-eyebrow">{isCreating ? 'Novo artigo' : 'Editar artigo'}</p>
                                <h2>{isCreating ? 'Adicionar artigo' : 'Atualizar artigo'}</h2>
                                <p className="inventory-modal-subtitle">
                                    Organiza os dados principais do artigo e gere o stock por tamanho num só passo.
                                </p>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsDialogOpen(false)}>
                                Fechar
                            </button>
                        </div>

                        <div className="inventory-form">
                            <div className="inventory-form-note inventory-form-note--highlight">
                                <p>Dados principais</p>

                                <label>
                                    <span>Nome do artigo</span>
                                    <input
                                        value={formData.Nome}
                                        onChange={(event) => setFormData((current) => ({ ...current, Nome: event.target.value }))}
                                        placeholder="Ex: Tutu clássico"
                                    />
                                </label>

                                <label>
                                    <span>Custo por dia (EUR)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.CustoPorDia}
                                        onChange={(event) => setFormData((current) => ({ ...current, CustoPorDia: event.target.value }))}
                                        placeholder="Ex: 5"
                                    />
                                </label>

                                <label className="inventory-switch inventory-switch--spaced">
                                    <span>Disponibilizar para aluguer</span>
                                    <input
                                        type="checkbox"
                                        checked={formData.DisponivelParaAluguer === true}
                                        onChange={(event) => setFormData((current) => ({ ...current, DisponivelParaAluguer: event.target.checked }))}
                                    />
                                </label>

                                <small className="inventory-field-hint">
                                    {formData.DisponivelParaAluguer
                                        ? 'Este artigo ficará visível no catálogo de aluguer.'
                                        : 'Este artigo ficará apenas no inventário do respetivo criador.'}
                                </small>
                            </div>

                            <label>
                                <span>Imagem</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                                {formData.ImagemPath && (
                                    <small className="inventory-field-hint">
                                        {selectedImageFile ? `Selecionada: ${selectedImageFile.name}` : `Atual: ${formData.ImagemPath}`}
                                    </small>
                                )}
                            </label>

                            {previewImageUrl && (
                                <div className="inventory-form-note">
                                    <p>Pré-visualização da imagem.</p>
                                    <div className="inventory-detail-media">
                                        <img className="inventory-detail-image" src={previewImageUrl} alt={formData.Nome || 'Pré-visualização do artigo'} />
                                    </div>
                                </div>
                            )}

                            {!isCreating && (
                                <label className="inventory-switch">
                                    <span>Artigo ativo</span>
                                    <input
                                        type="checkbox"
                                        checked={formData.EstadoArtigo !== false}
                                        onChange={(event) => setFormData((current) => ({ ...current, EstadoArtigo: event.target.checked }))}
                                    />
                                </label>
                            )}

                            <div className="inventory-form-note">
                                <p>Stock por tamanho</p>
                                <div className="inventory-stock-editor">
                                    {formData.TamanhoArtigo.map((size, index) => (
                                        <div key={size.IdTamanhoArtigo || `new-${index}`} className="inventory-stock-card">
                                            <div className="inventory-stock-card-header">
                                                <strong>{`Tamanho ${index + 1}`}</strong>
                                                {!size.IdTamanhoArtigo && formData.TamanhoArtigo.length > 1 && (
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
                            <button type="button" className="inventory-secondary-button" onClick={() => setIsDialogOpen(false)}>
                                Cancelar
                            </button>
                            <button type="button" className="inventory-primary-button" onClick={handleSave} disabled={saving}>
                                {saving ? 'A guardar...' : isCreating ? 'Adicionar' : 'Guardar'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default InventoryManagement;
