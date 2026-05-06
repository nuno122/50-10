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
    const directMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directMatch) {
        return directMatch[1];
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toMinutes = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    if (!match) return null;
    return (Number(match[1]) * 60) + Number(match[2]);
};

const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB;

const buildDefaultForm = (request) => ({
    DataPretendida: toDateInputValue(request.DataPretendida),
    HoraPretendida: formatTimeInput(request.HoraPretendida),
    DuracaoMinutos: String(request.DuracaoMinutos || 60),
    CapacidadeMaxima: String(request.CapacidadePretendida || 1),
    IdProfessor: '',
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

    return (users || []).filter((user) => {
        if (user.Permissoes !== PERMISSOES.PROFESSOR || user.EstaAtivo === false || !user.Professor) {
            return false;
        }

        const styles = user.Professor?.EstiloProfessor || [];
        const supportsStyle = styles.length === 0 || styles.some((item) => item.IdEstiloDanca === request.IdEstiloDanca);
        if (!supportsStyle) {
            return false;
        }

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
};

const getStudioOptions = (studios, request, form, aulas) => {
    const criteria = getScheduleCriteria(request, form);

    return (studios || []).filter((studio) => {
        const styles = studio.EstudioEstilo || [];
        const supportsStyle = styles.length === 0 || styles.some((item) => item.IdEstiloDanca === request.IdEstiloDanca);
        if (!supportsStyle) {
            return false;
        }

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
    const pendingRequests = (requests || []).filter((request) => request.EstadoPedido === 'Pendente');

    return (
        <section className="rental-card rental-list-card">
            <div className="rental-form-header">
                <h2>Requisicao de Aula</h2>
                <p>Requisicoes enviadas pelos encarregados e aguardando decisao da Direcao.</p>
            </div>

            {pendingRequests.length === 0 ? (
                <div className="rental-empty">
                    <p className="rental-empty-title">Sem requisicoes pendentes</p>
                    <p className="rental-empty-copy">Quando surgirem novas requisicoes de aula, vao aparecer aqui.</p>
                </div>
            ) : (
                <div className="rental-list">
                    {pendingRequests.map((request) => {
                        const form = {
                            ...buildDefaultForm(request),
                            ...(forms[request.IdPedidoAulaPrivada] || {})
                        };
                        const teacherOptions = getTeacherOptions(users, request, form, disponibilidades, aulas);
                        const studioOptions = getStudioOptions(studios, request, form, aulas);

                        return (
                            <article key={request.IdPedidoAulaPrivada} className="rental-item">
                                <div className="rental-item-main">
                                    <div className="rental-item-top">
                                        <div className="rental-badges">
                                            <span className="rental-badge rental-badge--warning">Pendente</span>
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
                                            <select
                                                value={form.IdProfessor}
                                                onChange={(event) => onChangeForm(request.IdPedidoAulaPrivada, 'IdProfessor', event.target.value)}
                                            >
                                                <option value="">
                                                    {teacherOptions.length === 0 ? 'Sem professores disponiveis' : 'Selecione o professor'}
                                                </option>
                                                {teacherOptions.map((teacher) => (
                                                    <option key={teacher.IdUtilizador} value={teacher.IdUtilizador}>
                                                        {teacher.NomeCompleto}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label>
                                            <span>Estudio</span>
                                            <select
                                                value={form.IdEstudio}
                                                onChange={(event) => onChangeForm(request.IdPedidoAulaPrivada, 'IdEstudio', event.target.value)}
                                            >
                                                <option value="">
                                                    {studioOptions.length === 0 ? 'Sem estudios compativeis' : 'Selecione o estudio'}
                                                </option>
                                                {studioOptions.map((studio) => (
                                                    <option key={studio.IdEstudio} value={studio.IdEstudio}>
                                                        Estudio {studio.Numero} - Capacidade {studio.Capacidade}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

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
                                        onClick={() => onApprove(request.IdPedidoAulaPrivada, form)}
                                        disabled={saving}
                                    >
                                        Aprovar e Criar Aula
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
