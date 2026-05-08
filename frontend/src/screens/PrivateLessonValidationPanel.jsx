import React from 'react';
import { PERMISSOES } from '../utils/permissions';

const toDateInputValue = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatTimeInput = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '';
};

const normalizeDateKey = (value) => {
    if (!value) return '';

    const text = String(value);
    const directMatch = text.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (directMatch) {
        return directMatch[1];
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toMinutes = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    if (!match) return null;
    return (Number(match[1]) * 60) + Number(match[2]);
};

const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB;

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const relationMatchesStyle = (relation, request) => (
    relation.IdEstiloDanca === request.IdEstiloDanca ||
    normalizeText(relation.EstiloDanca?.Nome) === normalizeText(request.EstiloDanca?.Nome)
);

const buildDefaultForm = (request) => ({
    DataPretendida: toDateInputValue(request.DataPretendida),
    HoraPretendida: formatTimeInput(request.HoraPretendida),
    DuracaoMinutos: String(request.DuracaoMinutos || 60),
    CapacidadeMaxima: String(request.CapacidadePretendida || 1),
    IdProfessor: request.IdProfessorConfirmado || '',
    StudioSelectionMode: 'compatible',
    IdEstudio: '',
    Preco: '0',
    ObservacaoDirecao: ''
});

const getScheduleCriteria = (request, form) => {
    const dateKey = normalizeDateKey(form.DataPretendida || request.DataPretendida);
    const startMinutes = toMinutes(form.HoraPretendida || request.HoraPretendida);
    const durationMinutes = Number(form.DuracaoMinutos || request.DuracaoMinutos || 0);
    const capacity = Number(form.CapacidadeMaxima || request.CapacidadePretendida || 1);
    const hasValidWindow = Boolean(dateKey) && Number.isFinite(startMinutes) && Number.isFinite(durationMinutes) && durationMinutes > 0;

    return {
        dateKey,
        startMinutes,
        durationMinutes,
        endMinutes: hasValidWindow ? startMinutes + durationMinutes : null,
        capacity,
        hasValidWindow
    };
};

const getTeacherOptions = (users, request, form, disponibilidades, aulas) => {
    const criteria = getScheduleCriteria(request, form);

    const styleTeachers = (users || []).filter((user) => {
        if (user.Permissoes !== PERMISSOES.PROFESSOR || user.EstaAtivo === false || !user.Professor) {
            return false;
        }

        const styles = user.Professor?.EstiloProfessor || [];
        return styles.some((item) => relationMatchesStyle(item, request));
    });

    const availableTeachers = styleTeachers.filter((user) => {

        if (!criteria.hasValidWindow) {
            return true;
        }

        const hasAvailability = (disponibilidades || []).some((entry) => (
            entry.IdProfessor === user.IdUtilizador &&
            normalizeDateKey(entry.Data) === criteria.dateKey &&
            criteria.startMinutes >= toMinutes(entry.HoraInicio) &&
            criteria.endMinutes <= toMinutes(entry.HoraFim)
        ));

        if (!hasAvailability) {
            return false;
        }

        const hasConflict = (aulas || []).some((aula) => (
            aula.EstaAtivo !== false &&
            aula.IdProfessor === user.IdUtilizador &&
            normalizeDateKey(aula.Data) === criteria.dateKey &&
            overlaps(
                criteria.startMinutes,
                criteria.endMinutes,
                toMinutes(aula.HoraInicio),
                toMinutes(aula.HoraFim)
            )
        ));

        return !hasConflict;
    });

    return availableTeachers.length > 0 ? availableTeachers : styleTeachers;
};

const getStudioOptions = (studios, request, form, aulas) => {
    const criteria = getScheduleCriteria(request, form);

    const allAvailableOptions = (studios || []).filter((studio) => {
        if (Number.isFinite(criteria.capacity) && criteria.capacity > 0 && Number(studio.Capacidade || 0) < criteria.capacity) {
            return false;
        }

        if (!criteria.hasValidWindow) {
            return true;
        }

        const hasConflict = (aulas || []).some((aula) => (
            aula.EstaAtivo !== false &&
            aula.IdEstudio === studio.IdEstudio &&
            normalizeDateKey(aula.Data) === criteria.dateKey &&
            overlaps(
                criteria.startMinutes,
                criteria.endMinutes,
                toMinutes(aula.HoraInicio),
                toMinutes(aula.HoraFim)
            )
        ));

        return !hasConflict;
    });

    const compatibleOptions = allAvailableOptions.filter((studio) => (
        (studio.EstudioEstilo || []).some((item) => relationMatchesStyle(item, request))
    ));

    return {
        compatibleOptions,
        allAvailableOptions,
        alternativeOptions: allAvailableOptions.filter((studio) => (
            !compatibleOptions.some((compatibleStudio) => compatibleStudio.IdEstudio === studio.IdEstudio)
        ))
    };
};

const PrivateLessonValidationPanel = ({
    requests,
    users,
    studios,
    aulas,
    disponibilidades,
    saving,
    forms,
    onChangeForm,
    onApprove,
    onReject,
    formatDate,
    formatTime
}) => {
    const pendingRequests = (requests || []).filter((request) => request.EstadoPedido === 'PendenteDirecao');

    return (
        <section className="rental-card rental-list-card">
            <div className="rental-form-header">
                <h2>Requisicao de Coaching</h2>
                <p>Pedidos de Coaching enviados pelos encarregados e aguardando decisao da Direcao.</p>
            </div>

            {pendingRequests.length === 0 ? (
                <div className="rental-empty">
                    <p className="rental-empty-title">Sem requisicoes pendentes</p>
                    <p className="rental-empty-copy">Quando surgirem novos pedidos de Coaching, vao aparecer aqui.</p>
                </div>
            ) : (
                <div className="rental-list">
                    {pendingRequests.map((request) => {
                        const form = {
                            ...buildDefaultForm(request),
                            ...(forms[request.IdPedidoAulaPrivada] || {})
                        };
                        const confirmedTeacher = (users || []).find((user) => user.IdUtilizador === request.IdProfessorConfirmado);
                        const studioState = getStudioOptions(studios, request, form, aulas);
                        const hasCompatibleSelection = studioState.compatibleOptions.some((studio) => studio.IdEstudio === form.IdEstudio);
                        const hasAvailableSelection = studioState.allAvailableOptions.some((studio) => studio.IdEstudio === form.IdEstudio);
                        const canUnlockAlternative = studioState.alternativeOptions.length > 0 || studioState.compatibleOptions.length === 0;
                        const studioSelectionMode = form.StudioSelectionMode === 'alternative'
                            ? 'alternative'
                            : hasCompatibleSelection
                                ? 'compatible'
                                : hasAvailableSelection
                                    ? 'alternative'
                                    : 'compatible';
                        const selectedStudioId = hasAvailableSelection ? form.IdEstudio : '';
                        const canApproveRequest = Boolean(request.IdProfessorConfirmado && selectedStudioId);
                        const approvalBlockedReason = !request.IdProfessorConfirmado
                            ? 'O professor ainda precisa de confirmar o pedido antes da aprovacao final.'
                            : !selectedStudioId
                                ? 'Escolha primeiro um estudio para aprovar este pedido.'
                                : '';
                        const showAlternativeSelector = studioSelectionMode === 'alternative' && canUnlockAlternative && studioState.allAvailableOptions.length > 0;
                        const normalizedForm = {
                            ...form,
                            IdEstudio: selectedStudioId
                        };
                        delete normalizedForm.StudioSelectionMode;

                        return (
                            <article key={request.IdPedidoAulaPrivada} className="rental-item">
                                <div className="rental-item-main">
                                    <div className="rental-item-top">
                                        <div className="rental-badges">
                                            <span className="rental-badge rental-badge--warning">Confirmado pelo professor</span>
                                            <span className="rental-badge rental-badge--muted">{request.EstiloDanca?.Nome || 'Estilo'}</span>
                                        </div>
                                    </div>

                                    <div className="rental-grid">
                                        <div>
                                            <span className="rental-label">Encarregado</span>
                                            <p>{request.Encarregado?.Utilizador?.NomeCompleto || 'Encarregado'}</p>
                                        </div>
                                        <div>
                                            <span className="rental-label">Educando</span>
                                            <p>{request.Aluno?.Utilizador?.NomeCompleto || 'Aluno'}</p>
                                        </div>
                                        <div>
                                            <span className="rental-label">Pedido original</span>
                                            <p>{formatDate(request.DataPretendida)} as {formatTime(request.HoraPretendida)}</p>
                                        </div>
                                        <div>
                                            <span className="rental-label">Duracao / capacidade</span>
                                            <p>{request.DuracaoMinutos} min - {request.CapacidadePretendida} participante(s)</p>
                                        </div>
                                    </div>

                                    {request.Observacoes && (
                                        <div className="rental-extension">
                                            <div>
                                                <p className="rental-extension-title">Observacoes do encarregado</p>
                                                <p>{request.Observacoes}</p>
                                            </div>
                                        </div>
                                    )}

                                    {studioState.compatibleOptions.length === 0 && studioState.allAvailableOptions.length > 0 && (
                                        <div className="rental-form-note">
                                            Nao existe nenhum estudio associado a este estilo disponivel para este horario.
                                            A Direcao pode escolher um estudio alternativo livre com capacidade suficiente.
                                        </div>
                                    )}

                                    {showAlternativeSelector && studioState.compatibleOptions.length > 0 && (
                                        <div className="rental-form-note">
                                            A lista abaixo mostra todos os estudios livres. Um estudio alternativo so deve ser usado
                                            quando nenhum estudio compativel servir para este horario.
                                        </div>
                                    )}

                                    {approvalBlockedReason && (
                                        <div className="rental-form-note">
                                            {approvalBlockedReason}
                                        </div>
                                    )}

                                    <div className="rental-form">
                                        <label>
                                            <span>Data aprovada</span>
                                            <input
                                                type="date"
                                                value={form.DataPretendida}
                                                onChange={(event) => onChangeForm(request.IdPedidoAulaPrivada, 'DataPretendida', event.target.value)}
                                            />
                                        </label>

                                        <label>
                                            <span>Hora aprovada</span>
                                            <input
                                                type="time"
                                                value={form.HoraPretendida}
                                                onChange={(event) => onChangeForm(request.IdPedidoAulaPrivada, 'HoraPretendida', event.target.value)}
                                            />
                                        </label>

                                        <label>
                                            <span>Duracao (min)</span>
                                            <input
                                                type="number"
                                                min="30"
                                                max="240"
                                                step="30"
                                                value={form.DuracaoMinutos}
                                                onChange={(event) => onChangeForm(request.IdPedidoAulaPrivada, 'DuracaoMinutos', event.target.value)}
                                            />
                                        </label>

                                        <label>
                                            <span>Capacidade</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="4"
                                                value={form.CapacidadeMaxima}
                                                onChange={(event) => onChangeForm(request.IdPedidoAulaPrivada, 'CapacidadeMaxima', event.target.value)}
                                            />
                                        </label>

                                        <label>
                                            <span>Professor</span>
                                            <input
                                                value={confirmedTeacher?.NomeCompleto || form.IdProfessor}
                                                readOnly
                                                title={confirmedTeacher?.NomeCompleto || 'Professor confirmado'}
                                            />
                                        </label>

                                        <label>
                                            <span>Estudio</span>
                                            <select
                                                value={showAlternativeSelector ? '__other__' : selectedStudioId}
                                                onChange={(event) => {
                                                    if (event.target.value === '__other__') {
                                                        onChangeForm(request.IdPedidoAulaPrivada, 'StudioSelectionMode', 'alternative');
                                                        onChangeForm(request.IdPedidoAulaPrivada, 'IdEstudio', '');
                                                        return;
                                                    }

                                                    onChangeForm(request.IdPedidoAulaPrivada, 'StudioSelectionMode', 'compatible');
                                                    onChangeForm(request.IdPedidoAulaPrivada, 'IdEstudio', event.target.value);
                                                }}
                                            >
                                                <option value="">
                                                    {studioState.compatibleOptions.length === 0
                                                        ? 'Sem estudios compativeis disponiveis'
                                                        : 'Selecione o estudio compativel'}
                                                </option>
                                                {studioState.compatibleOptions.map((studio) => (
                                                    <option key={studio.IdEstudio} value={studio.IdEstudio}>
                                                        Estudio {studio.Numero} - Capacidade {studio.Capacidade}
                                                    </option>
                                                ))}
                                                {canUnlockAlternative && (
                                                    <option value="__other__">Outro estudio</option>
                                                )}
                                            </select>
                                        </label>

                                        {showAlternativeSelector && (
                                            <label>
                                                <span>Outro estudio</span>
                                                <select
                                                    value={selectedStudioId}
                                                    onChange={(event) => {
                                                        onChangeForm(request.IdPedidoAulaPrivada, 'StudioSelectionMode', 'alternative');
                                                        onChangeForm(request.IdPedidoAulaPrivada, 'IdEstudio', event.target.value);
                                                    }}
                                                >
                                                    <option value="">
                                                        {studioState.allAvailableOptions.length === 0
                                                            ? 'Sem estudios livres neste horario'
                                                            : 'Selecione entre todos os estudios livres'}
                                                    </option>
                                                    {studioState.allAvailableOptions.map((studio) => {
                                                        const isCompatible = studioState.compatibleOptions.some((item) => item.IdEstudio === studio.IdEstudio);
                                                        return (
                                                            <option key={studio.IdEstudio} value={studio.IdEstudio}>
                                                                Estudio {studio.Numero} - Capacidade {studio.Capacidade}
                                                                {isCompatible ? ' - Compativel' : ' - Alternativo'}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </label>
                                        )}

                                        <label>
                                            <span>Preco (EUR)</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={form.Preco}
                                                onChange={(event) => onChangeForm(request.IdPedidoAulaPrivada, 'Preco', event.target.value)}
                                            />
                                        </label>

                                        <label>
                                            <span>Observacao da Direcao</span>
                                            <textarea
                                                rows="3"
                                                value={form.ObservacaoDirecao}
                                                onChange={(event) => onChangeForm(request.IdPedidoAulaPrivada, 'ObservacaoDirecao', event.target.value)}
                                                placeholder="Notas internas ou contexto para o encarregado..."
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="rental-actions">
                                    <button
                                        type="button"
                                        className="rental-button rental-button--ghost"
                                        onClick={() => onReject(request.IdPedidoAulaPrivada, form.ObservacaoDirecao)}
                                        disabled={saving}
                                    >
                                        Rejeitar
                                    </button>
                                    <button
                                        type="button"
                                        className="rental-button rental-button--warning"
                                        onClick={() => onApprove(request.IdPedidoAulaPrivada, normalizedForm)}
                                        disabled={saving || !canApproveRequest}
                                        title={approvalBlockedReason || 'Aprovar e Agendar Coaching'}
                                    >
                                        Aprovar e Agendar Coaching
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default PrivateLessonValidationPanel;
