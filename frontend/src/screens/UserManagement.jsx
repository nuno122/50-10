import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { atualizarEstadoUtilizador, atualizarUtilizador, criarUtilizador, getUtilizadores } from '../services/api';
import { PERMISSOES } from '../utils/permissions';

const MANAGED_ROLES = [PERMISSOES.ENCARREGADO, PERMISSOES.PROFESSOR, PERMISSOES.DIRECAO];

const ROLE_OPTIONS = [
    { value: PERMISSOES.ENCARREGADO, label: 'Encarregado' },
    { value: PERMISSOES.PROFESSOR, label: 'Professor' },
    { value: PERMISSOES.DIRECAO, label: 'Direcao' }
];

const emptyForm = {
    NomeCompleto: '',
    NomeUtilizador: '',
    Email: '',
    PalavraPasse: '',
    NumeroTelemovel: '',
    Nif: '',
    Morada: '',
    CodigoPostal: '',
    Permissoes: PERMISSOES.ENCARREGADO,
    Iban: ''
};

const getRoleLabel = (permission) => ROLE_OPTIONS.find((role) => role.value === permission)?.label || 'Outro';

const validateUserForm = (formData, editingUser) => {
    if (!formData.NomeCompleto.trim()) return 'Indica o nome completo.';
    if (!formData.NomeUtilizador.trim()) return 'Indica o nome de utilizador.';
    if (!formData.Email.trim()) return 'Indica o email.';
    if (!formData.Nif.trim()) return 'Indica o NIF.';
    if (!formData.CodigoPostal.trim()) return 'Indica o codigo postal.';
    if (!formData.Morada.trim()) return 'Indica a morada.';
    if (!editingUser && !formData.PalavraPasse.trim()) return 'Indica a palavra-passe.';
    if (Number(formData.Permissoes) === PERMISSOES.PROFESSOR && !formData.Iban.trim()) return 'Indica o IBAN do professor.';
    return '';
};

const UserManagement = () => {
    const { notify } = useNotifications();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [modalError, setModalError] = useState('');
    const [modalFeedback, setModalFeedback] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState(emptyForm);
    const submitLockRef = useRef(false);

    const closeModal = () => {
        setIsModalOpen(false);
        setModalError('');
        setModalFeedback('');
    };

    const loadUsers = async () => {
        setLoading(true);
        setError('');

        try {
            const data = await getUtilizadores();
            setUsers((data || []).filter((user) => MANAGED_ROLES.includes(user.Permissoes)));
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar os utilizadores.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData(emptyForm);
        setIsModalOpen(true);
        setError('');
        setFeedback('');
        setModalError('');
        setModalFeedback('');
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setFormData({
            NomeCompleto: user.NomeCompleto || '',
            NomeUtilizador: user.NomeUtilizador || '',
            Email: user.Email || '',
            PalavraPasse: '',
            NumeroTelemovel: user.NumeroTelemovel || '',
            Nif: user.Nif || '',
            Morada: user.Morada || '',
            CodigoPostal: user.CodigoPostal || '',
            Permissoes: user.Permissoes,
            Iban: user.Professor?.Iban || ''
        });
        setIsModalOpen(true);
        setError('');
        setFeedback('');
        setModalError('');
        setModalFeedback('');
    };

    const filteredUsers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        return users.filter((user) => {
            const matchesTerm = !term || [
                user.NomeCompleto,
                user.Email,
                user.NomeUtilizador,
                user.Nif
            ].some((value) => String(value || '').toLowerCase().includes(term));

            const matchesRole = roleFilter === 'all' || String(user.Permissoes) === roleFilter;
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'active' && user.EstaAtivo !== false)
                || (statusFilter === 'inactive' && user.EstaAtivo === false);

            return matchesTerm && matchesRole && matchesStatus;
        });
    }, [roleFilter, searchTerm, statusFilter, users]);

    const handleChange = (field, value) => {
        if (modalError) {
            setModalError('');
        }
        setFormData((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async () => {
        if (submitLockRef.current) {
            return;
        }

        const validationError = validateUserForm(formData, editingUser);
        if (validationError) {
            setModalError(validationError);
            setModalFeedback('');
            return;
        }

        submitLockRef.current = true;
        setSaving(true);
        setError('');
        setFeedback('');
        setModalError('');
        setModalFeedback('');

        try {
            const payload = {
                ...formData,
                Permissoes: Number(formData.Permissoes)
            };

            if (payload.Permissoes !== PERMISSOES.PROFESSOR) {
                payload.Iban = '';
            }

            if (!payload.PalavraPasse && editingUser) {
                delete payload.PalavraPasse;
            }

            if (editingUser) {
                await atualizarUtilizador(editingUser.IdUtilizador, payload);
                notify({
                    title: 'Utilizador atualizado',
                    message: `${payload.NomeCompleto} foi atualizado com sucesso.`,
                    tone: 'success'
                });
                setFeedback('Utilizador atualizado com sucesso.');
            } else {
                await criarUtilizador(payload);
                notify({
                    title: 'Utilizador criado',
                    message: `${payload.NomeCompleto} foi criado com sucesso.`,
                    tone: 'success'
                });
                setFeedback('Utilizador criado com sucesso.');
            }

            setIsModalOpen(false);
            await loadUsers();
        } catch (err) {
            setModalError(err.message || 'Nao foi possivel guardar o utilizador.');
        } finally {
            submitLockRef.current = false;
            setSaving(false);
        }
    };

    const handleToggleStatus = async (user) => {
        setError('');
        setFeedback('');

        try {
            await atualizarEstadoUtilizador(user.IdUtilizador, user.EstaAtivo === false);
            notify({
                title: user.EstaAtivo === false ? 'Utilizador ativado' : 'Utilizador inativado',
                message: `${user.NomeCompleto} foi atualizado com sucesso.`,
                tone: 'success'
            });
            setFeedback(`Utilizador ${user.EstaAtivo === false ? 'ativado' : 'inativado'} com sucesso.`);
            await loadUsers();
        } catch (err) {
            setError(err.message || 'Nao foi possivel atualizar o estado do utilizador.');
        }
    };

    return (
        <div className="user-admin-page">
            <div className="user-admin-header">
                <div>
                    <p className="user-admin-eyebrow">Direcao</p>
                    <h1>Gestao de Utilizadores</h1>
                    <p className="user-admin-subtitle">
                        Crie, edite e ative ou inative Encarregados, Professores e membros da Direcao.
                    </p>
                </div>

                <button type="button" className="schedule-button schedule-button--primary" onClick={openCreateModal}>
                    Novo Utilizador
                </button>
            </div>

            {feedback && <div className="inventory-banner inventory-banner--success">{feedback}</div>}
            {error && <div className="inventory-banner inventory-banner--error">{error}</div>}

            <section className="user-admin-toolbar">
                <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Pesquisar por nome, email, username ou NIF..."
                />

                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                    <option value="all">Todos os perfis</option>
                    {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={String(role.value)}>
                            {role.label}
                        </option>
                    ))}
                </select>

                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">Todos os estados</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                </select>
            </section>

            {loading ? (
                <section className="user-admin-empty">
                    <p>A carregar utilizadores...</p>
                </section>
            ) : filteredUsers.length === 0 ? (
                <section className="user-admin-empty">
                    <p className="user-admin-empty-title">Sem utilizadores para mostrar</p>
                    <p>Altere os filtros ou crie um novo utilizador.</p>
                </section>
            ) : (
                <section className="user-admin-grid">
                    {filteredUsers.map((user) => (
                        <article key={user.IdUtilizador} className="user-admin-card">
                            <div className="user-admin-card-top">
                                <div>
                                    <h2>{user.NomeCompleto}</h2>
                                    <p>{getRoleLabel(user.Permissoes)}</p>
                                </div>
                                <span className={`user-admin-badge ${user.EstaAtivo === false ? 'user-admin-badge--inactive' : 'user-admin-badge--active'}`}>
                                    {user.EstaAtivo === false ? 'Inativo' : 'Ativo'}
                                </span>
                            </div>

                            <div className="user-admin-card-grid">
                                <div>
                                    <span>Email</span>
                                    <p>{user.Email || '-'}</p>
                                </div>
                                <div>
                                    <span>Username</span>
                                    <p>{user.NomeUtilizador || '-'}</p>
                                </div>
                                <div>
                                    <span>Telemovel</span>
                                    <p>{user.NumeroTelemovel || '-'}</p>
                                </div>
                                <div>
                                    <span>NIF</span>
                                    <p>{user.Nif || '-'}</p>
                                </div>
                                <div>
                                    <span>Codigo Postal</span>
                                    <p>{user.CodigoPostal || '-'}</p>
                                </div>
                                <div>
                                    <span>Morada</span>
                                    <p>{user.Morada || '-'}</p>
                                </div>
                                {user.Permissoes === PERMISSOES.PROFESSOR && (
                                    <div>
                                        <span>IBAN</span>
                                        <p>{user.Professor?.Iban || '-'}</p>
                                    </div>
                                )}
                            </div>

                            <div className="user-admin-actions">
                                <button type="button" className="schedule-button schedule-button--ghost" onClick={() => openEditModal(user)}>
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    className={`schedule-button ${user.EstaAtivo === false ? 'schedule-button--primary' : 'user-admin-button--danger'}`}
                                    onClick={() => handleToggleStatus(user)}
                                >
                                    {user.EstaAtivo === false ? 'Ativar' : 'Inativar'}
                                </button>
                            </div>
                        </article>
                    ))}
                </section>
            )}

            {isModalOpen && (
                <div className="schedule-modal-backdrop" onClick={closeModal}>
                    <section className="schedule-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="schedule-modal-header">
                            <div>
                                <p className="user-admin-eyebrow">{editingUser ? 'Editar utilizador' : 'Novo utilizador'}</p>
                                <h2>{editingUser ? editingUser.NomeCompleto : 'Criar utilizador'}</h2>
                            </div>
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={closeModal}>
                                Fechar
                            </button>
                        </div>

                        <div className="schedule-form">
                            {modalFeedback && <div className="inventory-banner inventory-banner--success">{modalFeedback}</div>}
                            {modalError && <div className="inventory-banner inventory-banner--error">{modalError}</div>}

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Nome completo *</span>
                                    <input value={formData.NomeCompleto} onChange={(event) => handleChange('NomeCompleto', event.target.value)} />
                                </label>

                                <label>
                                    <span>Perfil *</span>
                                    <select
                                        value={formData.Permissoes}
                                        onChange={(event) => handleChange('Permissoes', Number(event.target.value))}
                                        disabled={Boolean(editingUser)}
                                    >
                                        {ROLE_OPTIONS.map((role) => (
                                            <option key={role.value} value={role.value}>
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Nome de utilizador *</span>
                                    <input value={formData.NomeUtilizador} onChange={(event) => handleChange('NomeUtilizador', event.target.value)} />
                                </label>

                                <label>
                                    <span>Email *</span>
                                    <input type="email" value={formData.Email} onChange={(event) => handleChange('Email', event.target.value)} />
                                </label>
                            </div>

                            <div className="schedule-form-grid">
                                <label>
                                    <span>{editingUser ? 'Nova palavra-passe' : 'Palavra-passe *'}</span>
                                    <input type="password" value={formData.PalavraPasse} onChange={(event) => handleChange('PalavraPasse', event.target.value)} />
                                </label>

                                <label>
                                    <span>Telemovel</span>
                                    <input value={formData.NumeroTelemovel} onChange={(event) => handleChange('NumeroTelemovel', event.target.value)} />
                                </label>
                            </div>

                            <div className="schedule-form-grid">
                                <label>
                                    <span>NIF *</span>
                                    <input value={formData.Nif} onChange={(event) => handleChange('Nif', event.target.value)} />
                                </label>

                                <label>
                                    <span>Codigo Postal *</span>
                                    <input value={formData.CodigoPostal} onChange={(event) => handleChange('CodigoPostal', event.target.value)} />
                                </label>
                            </div>

                            <label>
                                <span>Morada *</span>
                                <input value={formData.Morada} onChange={(event) => handleChange('Morada', event.target.value)} />
                            </label>

                            {Number(formData.Permissoes) === PERMISSOES.PROFESSOR && (
                                <label>
                                    <span>IBAN *</span>
                                    <input value={formData.Iban} onChange={(event) => handleChange('Iban', event.target.value)} />
                                </label>
                            )}
                        </div>

                        <div className="schedule-modal-actions">
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={closeModal}>
                                Cancelar
                            </button>
                            <button type="button" className="schedule-button schedule-button--primary" onClick={handleSubmit} disabled={saving}>
                                {saving ? 'A guardar...' : editingUser ? 'Guardar alteracoes' : 'Criar utilizador'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
