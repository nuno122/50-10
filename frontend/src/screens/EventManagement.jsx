import React, { useEffect, useMemo, useState } from 'react';
import {
    adicionarComentarioEvento,
    atualizarEvento,
    criarEvento,
    editarComentarioEvento,
    getEventos,
    removerEvento
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../utils/permissions';

const createEmptyForm = () => ({
    Titulo: '',
    Descricao: '',
    DataPublicacaoInicio: '',
    DataPublicacaoFim: '',
    DataEvento: '',
    Local: '',
    TipoEvento: '',
    Link: ''
});

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(date);
};

const toDateInputValue = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toDateTimeLocalValue = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const buildFormFromEvent = (eventItem) => ({
    Titulo: eventItem?.Titulo || '',
    Descricao: eventItem?.Descricao || '',
    DataPublicacaoInicio: toDateTimeLocalValue(eventItem?.DataPublicacaoInicio),
    DataPublicacaoFim: toDateTimeLocalValue(eventItem?.DataPublicacaoFim),
    DataEvento: toDateInputValue(eventItem?.DataEvento),
    Local: eventItem?.Local || '',
    TipoEvento: eventItem?.TipoEvento === 'Geral' ? '' : (eventItem?.TipoEvento || ''),
    Link: eventItem?.Link || ''
});

const getStatusBadge = (eventItem) => {
    const now = new Date();
    const publicationStart = new Date(eventItem?.DataPublicacaoInicio);
    const publicationEnd = new Date(eventItem?.DataPublicacaoFim);

    if (!eventItem?.EstadoEvento) {
        return { label: 'Inativo', tone: 'muted' };
    }

    if (!Number.isNaN(publicationStart.getTime()) && now < publicationStart) {
        return { label: 'Agendado', tone: 'blue' };
    }

    if (!Number.isNaN(publicationEnd.getTime()) && now > publicationEnd) {
        return { label: 'Expirado', tone: 'amber' };
    }

    return { label: 'Publicado', tone: 'green' };
};

const EventManagement = () => {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [deletingEventId, setDeletingEventId] = useState('');
    const [commentingEventId, setCommentingEventId] = useState('');
    const [commentDrafts, setCommentDrafts] = useState({});
    const [editingCommentId, setEditingCommentId] = useState('');
    const [editingCommentDraft, setEditingCommentDraft] = useState('');
    const [savingCommentId, setSavingCommentId] = useState('');
    const [formData, setFormData] = useState(createEmptyForm());

    const canManageEvents = user?.Permissoes === PERMISSOES.DIRECAO;
    const canComment = user?.Permissoes === PERMISSOES.PROFESSOR;

    const pageCopy = useMemo(() => {
        if (canManageEvents) {
            return {
                eyebrow: 'Direção',
                title: 'Gestão de eventos',
                subtitle: 'Crie, edite e remova eventos, mantendo a comunicação da escola sempre atualizada.'
            };
        }

        if (canComment) {
            return {
                eyebrow: 'Professor',
                title: 'Eventos da Escola',
                subtitle: 'Consulte os eventos publicados e registe observações nos eventos que acompanha.'
            };
        }

        return {
            eyebrow: 'Encarregado',
            title: 'Eventos da Escola',
            subtitle: 'Consulte os eventos publicados pela Direção.'
        };
    }, [canComment, canManageEvents]);

    const loadEvents = async () => {
        setLoading(true);
        setError('');

        try {
            const data = await getEventos();
            setEvents(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || 'Não foi possível carregar os eventos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEvents();
    }, []);

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setFormData((current) => ({
            ...current,
            [name]: value
        }));
    };

    const handleStartEventEdit = (eventItem) => {
        setSelectedEventId(eventItem.IdEvento);
        setFormData(buildFormFromEvent(eventItem));
        setError('');
        setFeedback('');
    };

    const handleCancelEventEdit = () => {
        setSelectedEventId('');
        setFormData(createEmptyForm());
    };

    const handleEventSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        setFeedback('');

        try {
            if (selectedEventId) {
                await atualizarEvento(selectedEventId, formData);
                setFeedback('Evento atualizado com sucesso.');
            } else {
                await criarEvento(formData);
                setFeedback('Evento criado com sucesso.');
            }

            handleCancelEventEdit();
            await loadEvents();
        } catch (err) {
            setError(err.message || 'Não foi possível guardar o evento.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteEvent = async (idEvento) => {
        if (!window.confirm('Tem a certeza de que pretende remover este evento?')) {
            return;
        }

        setDeletingEventId(idEvento);
        setError('');
        setFeedback('');

        try {
            await removerEvento(idEvento);
            if (selectedEventId === idEvento) {
                handleCancelEventEdit();
            }
            setFeedback('Evento removido com sucesso.');
            await loadEvents();
        } catch (err) {
            setError(err.message || 'Não foi possível remover o evento.');
        } finally {
            setDeletingEventId('');
        }
    };

    const handleCommentSubmit = async (event, idEvento) => {
        event.preventDefault();
        const comentario = String(commentDrafts[idEvento] || '').trim();
        if (!comentario) {
            setError('Escreva um comentário antes de guardar.');
            return;
        }

        setCommentingEventId(idEvento);
        setError('');
        setFeedback('');

        try {
            await adicionarComentarioEvento(idEvento, comentario);
            setFeedback('Comentário adicionado com sucesso.');
            setCommentDrafts((current) => ({
                ...current,
                [idEvento]: ''
            }));
            await loadEvents();
        } catch (err) {
            setError(err.message || 'Não foi possível adicionar o comentário.');
        } finally {
            setCommentingEventId('');
        }
    };

    const handleStartCommentEdit = (comment) => {
        setEditingCommentId(comment.IdEventoComentario);
        setEditingCommentDraft(comment.Comentario || '');
        setError('');
        setFeedback('');
    };

    const handleCancelCommentEdit = () => {
        setEditingCommentId('');
        setEditingCommentDraft('');
    };

    const handleCommentUpdate = async (event, idEventoComentario) => {
        event.preventDefault();
        const comentario = String(editingCommentDraft || '').trim();
        if (!comentario) {
            setError('Escreva um comentário antes de guardar.');
            return;
        }

        setSavingCommentId(idEventoComentario);
        setError('');
        setFeedback('');

        try {
            await editarComentarioEvento(idEventoComentario, comentario);
            setFeedback('Comentário atualizado com sucesso.');
            handleCancelCommentEdit();
            await loadEvents();
        } catch (err) {
            setError(err.message || 'Não foi possível atualizar o comentário.');
        } finally {
            setSavingCommentId('');
        }
    };

    const canEditOwnComment = (comment) => (
        canComment &&
        (() => {
            const userId = user?.IdUtilizador || user?.Id || null;
            return comment.IdProfessor === userId || comment.Professor?.Utilizador?.IdUtilizador === userId;
        })()
    );

    return (
        <div className="events-page">
            <div className="events-header">
                <div>
                    <p className="events-eyebrow">{pageCopy.eyebrow}</p>
                    <h1>{pageCopy.title}</h1>
                    <p className="events-subtitle">{pageCopy.subtitle}</p>
                </div>
            </div>

            {feedback && <div className="events-banner events-banner--success">{feedback}</div>}
            {error && <div className="events-banner events-banner--error">{error}</div>}

            {canManageEvents && (
                <section className="events-card">
                    <div className="events-card-header">
                        <h2>{selectedEventId ? 'Editar Evento' : 'Novo Evento'}</h2>
                        <p>{selectedEventId ? 'Atualize os dados do evento selecionado.' : 'Defina a janela de publicação e os dados que todos vão ver no portal.'}</p>
                    </div>

                    <form className="events-form" onSubmit={handleEventSubmit}>
                        <label className="events-field events-field--full">
                            <span>Título</span>
                            <input
                                type="text"
                                name="Titulo"
                                value={formData.Titulo}
                                onChange={handleFormChange}
                                required
                            />
                        </label>

                        <label className="events-field events-field--full">
                            <span>Descrição</span>
                            <textarea
                                name="Descricao"
                                value={formData.Descricao}
                                onChange={handleFormChange}
                                rows="4"
                                required
                            />
                        </label>

                        <label className="events-field">
                            <span>Publicação início</span>
                            <input
                                type="datetime-local"
                                name="DataPublicacaoInicio"
                                value={formData.DataPublicacaoInicio}
                                onChange={handleFormChange}
                                required
                            />
                        </label>

                        <label className="events-field">
                            <span>Publicação fim</span>
                            <input
                                type="datetime-local"
                                name="DataPublicacaoFim"
                                value={formData.DataPublicacaoFim}
                                onChange={handleFormChange}
                                required
                            />
                        </label>

                        <label className="events-field">
                            <span>Data do Evento</span>
                            <input
                                type="date"
                                name="DataEvento"
                                value={formData.DataEvento}
                                onChange={handleFormChange}
                                required
                            />
                        </label>

                        <label className="events-field">
                            <span>Tipo de Evento</span>
                            <input
                                type="text"
                                name="TipoEvento"
                                value={formData.TipoEvento}
                                onChange={handleFormChange}
                            />
                        </label>

                        <label className="events-field">
                            <span>Local</span>
                            <input
                                type="text"
                                name="Local"
                                value={formData.Local}
                                onChange={handleFormChange}
                            />
                        </label>

                        <label className="events-field events-field--full">
                            <span>Link</span>
                            <input
                                type="url"
                                name="Link"
                                value={formData.Link}
                                onChange={handleFormChange}
                                placeholder="https://..."
                            />
                        </label>

                        <div className="events-actions">
                            {selectedEventId && (
                                <button
                                    type="button"
                                    className="events-secondary-button"
                                    onClick={handleCancelEventEdit}
                                >
                                    Cancelar edição
                                </button>
                            )}
                            <button type="submit" className="events-primary-button" disabled={submitting}>
                                {submitting ? 'A guardar...' : selectedEventId ? 'Guardar alteracoes' : 'Criar evento'}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="events-card">
                <div className="events-card-header">
                    <h2>Lista de Eventos</h2>
                    <p>{canManageEvents ? 'Todos os eventos registados na plataforma.' : 'Eventos atualmente publicados no portal.'}</p>
                </div>

                {loading ? (
                    <div className="events-empty">
                        <p>A carregar eventos...</p>
                    </div>
                ) : events.length === 0 ? (
                    <div className="events-empty">
                        <p>Não existem eventos para apresentar de momento.</p>
                    </div>
                ) : (
                    <div className="events-list">
                        {events.map((eventItem) => {
                            const status = getStatusBadge(eventItem);
                            const comments = Array.isArray(eventItem.EventoComentario) ? eventItem.EventoComentario : [];

                            return (
                                <article key={eventItem.IdEvento} className="event-item">
                                    <div className="event-item-top">
                                        <div>
                                            <div className="event-item-badges">
                                                <span className={`event-badge event-badge--${status.tone}`}>{status.label}</span>
                                                <span className="event-chip">{eventItem.TipoEvento || 'Geral'}</span>
                                            </div>
                                            <h3>{eventItem.Titulo}</h3>
                                            <p className="event-item-description">{eventItem.Descricao}</p>
                                        </div>

                                        <div className="event-item-actions">
                                            {eventItem.Link ? (
                                                <a
                                                    className="events-link"
                                                    href={eventItem.Link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Abrir link
                                                </a>
                                            ) : (
                                                <span className="events-link events-link--muted">Sem link</span>
                                            )}

                                            {canManageEvents && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="events-secondary-button"
                                                        onClick={() => handleStartEventEdit(eventItem)}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="events-danger-button"
                                                        onClick={() => handleDeleteEvent(eventItem.IdEvento)}
                                                        disabled={deletingEventId === eventItem.IdEvento}
                                                    >
                                                        {deletingEventId === eventItem.IdEvento ? 'A remover...' : 'Remover'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="event-meta-grid">
                                        <div>
                                            <span>Data do evento</span>
                                            <strong>{formatDate(eventItem.DataEvento)}</strong>
                                        </div>
                                        <div>
                                            <span>Local</span>
                                            <strong>{eventItem.Local || '-'}</strong>
                                        </div>
                                        {canManageEvents && (
                                            <div>
                                                <span>Criado por</span>
                                                <strong>{eventItem.Criador?.NomeCompleto || '-'}</strong>
                                            </div>
                                        )}
                                    </div>

                                    <div className="event-comments">
                                        <div className="event-comments-header">
                                            <h4>Comentários dos Professores</h4>
                                            <span>{comments.length}</span>
                                        </div>

                                        {comments.length === 0 ? (
                                            <p className="event-comments-empty">Ainda nao existem comentarios para este evento.</p>
                                        ) : (
                                            <div className="event-comments-list">
                                                {comments.map((comment) => (
                                                    <div key={comment.IdEventoComentario} className="event-comment-item">
                                                        <div className="event-comment-meta">
                                                            <strong>{comment.Professor?.Utilizador?.NomeCompleto || 'Professor'}</strong>
                                                            <div className="event-comment-meta-right">
                                                                <span>{formatDateTime(comment.DataComentario)}</span>
                                                                {canEditOwnComment(comment) && editingCommentId !== comment.IdEventoComentario && (
                                                                    <button
                                                                        type="button"
                                                                        className="event-comment-link"
                                                                        onClick={() => handleStartCommentEdit(comment)}
                                                                    >
                                                                        Editar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {editingCommentId === comment.IdEventoComentario ? (
                                                            <form
                                                                className="event-comment-form"
                                                                onSubmit={(submitEvent) => handleCommentUpdate(submitEvent, comment.IdEventoComentario)}
                                                            >
                                                                <textarea
                                                                    value={editingCommentDraft}
                                                                    onChange={(changeEvent) => setEditingCommentDraft(changeEvent.target.value)}
                                                                    rows="3"
                                                                />
                                                                <div className="event-inline-actions">
                                                                    <button
                                                                        type="button"
                                                                        className="events-secondary-button"
                                                                        onClick={handleCancelCommentEdit}
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                    <button
                                                                        type="submit"
                                                                        className="events-secondary-button"
                                                                        disabled={savingCommentId === comment.IdEventoComentario}
                                                                    >
                                                                        {savingCommentId === comment.IdEventoComentario ? 'A guardar...' : 'Guardar'}
                                                                    </button>
                                                                </div>
                                                            </form>
                                                        ) : (
                                                            <p>{comment.Comentario}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {canComment && (
                                            <form
                                                className="event-comment-form"
                                                onSubmit={(submitEvent) => handleCommentSubmit(submitEvent, eventItem.IdEvento)}
                                            >
                                                <textarea
                                                    value={commentDrafts[eventItem.IdEvento] || ''}
                                                    onChange={(changeEvent) => setCommentDrafts((current) => ({
                                                        ...current,
                                                        [eventItem.IdEvento]: changeEvent.target.value
                                                    }))}
                                                    placeholder="Escreva um comentário sobre este evento"
                                                    rows="3"
                                                />

                                                <button
                                                    type="submit"
                                                    className="events-secondary-button"
                                                    disabled={commentingEventId === eventItem.IdEvento}
                                                >
                                                    {commentingEventId === eventItem.IdEvento ? 'A guardar...' : 'Adicionar comentário'}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};

export default EventManagement;

