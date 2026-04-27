import React, { useEffect, useMemo, useState } from 'react';
import { criarArtigo, editarArtigo, getInventario } from '../services/api';

const emptyForm = {
    Nome: '',
    CustoPorDia: '',
    EstadoArtigo: true
};

const InventoryManagement = () => {
    const [inventory, setInventory] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const loadInventory = async () => {
        setLoading(true);
        setError('');

        try {
            const data = await getInventario();
            setInventory(data);
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar o inventario.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInventory();
    }, []);

    const filteredInventory = useMemo(() => (
        inventory.filter((item) => {
            const matchesSearch = item.Nome?.toLowerCase().includes(searchQuery.toLowerCase());
            const totalStock = (item.TamanhoArtigo || []).reduce((sum, size) => sum + Number(size.Quantidade || 0), 0);

            let matchesStatus = false;
            if (filterStatus === 'all') matchesStatus = true;
            else if (filterStatus === 'inactive') matchesStatus = item.EstadoArtigo === false;
            else if (filterStatus === 'available') matchesStatus = item.EstadoArtigo !== false && totalStock > 0;
            else matchesStatus = item.EstadoArtigo !== false && totalStock === 0;

            return matchesSearch && matchesStatus;
        })
    ), [filterStatus, inventory, searchQuery]);

    const availableCount = inventory.filter((item) => item.EstadoArtigo !== false && (item.TamanhoArtigo || []).some((size) => Number(size.Quantidade || 0) > 0)).length;
    const outOfStockCount = inventory.filter((item) => item.EstadoArtigo !== false && (item.TamanhoArtigo || []).reduce((sum, size) => sum + Number(size.Quantidade || 0), 0) === 0).length;

    const openCreate = () => {
        setIsCreating(true);
        setSelectedItem(null);
        setFormData(emptyForm);
        setIsDialogOpen(true);
    };

    const openEdit = (item) => {
        setIsCreating(false);
        setSelectedItem(item);
        setFormData({
            Nome: item.Nome || '',
            CustoPorDia: item.CustoPorDia ?? '',
            EstadoArtigo: item.EstadoArtigo !== false
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');

        try {
            if (isCreating) {
                await criarArtigo({
                    Nome: formData.Nome,
                    CustoPorDia: Number(formData.CustoPorDia)
                });
            } else if (selectedItem) {
                await editarArtigo(selectedItem.IdArtigo, {
                    Nome: formData.Nome,
                    CustoPorDia: Number(formData.CustoPorDia),
                    EstadoArtigo: formData.EstadoArtigo
                });
            }

            setIsDialogOpen(false);
            setSelectedItem(null);
            setFormData(emptyForm);
            await loadInventory();
        } catch (err) {
            setError(err.message || 'Nao foi possivel guardar o artigo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="inventory-page">
            <div className="inventory-header">
                <div>
                    <p className="inventory-eyebrow">Direcao</p>
                    <h1>Gestao de Inventario</h1>
                    <p className="inventory-subtitle">
                        Informacao apresentada a partir dos registos reais de artigos e tamanhos em stock.
                    </p>
                </div>

                <button type="button" className="inventory-primary-button" onClick={openCreate}>
                    Adicionar Artigo
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
                        <p>Disponiveis</p>
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
                        ['available', 'Disponiveis'],
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
                    <p>A carregar inventario...</p>
                </section>
            ) : (
                <div className="inventory-grid">
                    {filteredInventory.map((item) => {
                        const totalStock = (item.TamanhoArtigo || []).reduce((sum, size) => sum + Number(size.Quantidade || 0), 0);
                        const isInactive = item.EstadoArtigo === false;

                        return (
                            <article
                                key={item.IdArtigo}
                                className={`inventory-card inventory-item ${isInactive ? 'inventory-item--inactive' : ''}`}
                            >
                                <div className="inventory-item-top">
                                    <div>
                                        <h3>{item.Nome}</h3>
                                        <p>{`EUR ${Number(item.CustoPorDia || 0).toFixed(2)} / dia`}</p>
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
                                <h2>{isCreating ? 'Adicionar Artigo' : 'Atualizar Artigo'}</h2>
                            </div>
                            <button type="button" className="inventory-close" onClick={() => setIsDialogOpen(false)}>
                                Fechar
                            </button>
                        </div>

                        <div className="inventory-form">
                            <label>
                                <span>Nome do artigo</span>
                                <input
                                    value={formData.Nome}
                                    onChange={(event) => setFormData((current) => ({ ...current, Nome: event.target.value }))}
                                    placeholder="Ex: Tutu Classico"
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

                            {selectedItem && (
                                <div className="inventory-form-note">
                                    <p>Tamanhos e quantidades registados na base de dados.</p>
                                    <div className="inventory-size-list">
                                        {(selectedItem.TamanhoArtigo || []).map((size) => (
                                            <div key={size.IdTamanhoArtigo} className="inventory-size-chip">
                                                <span>{size.Tamanho}</span>
                                                <strong>{size.Quantidade}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
