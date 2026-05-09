const API_BASE_URL = 'http://localhost:3000/api';

const handleResponse = async (response, { method = 'GET', suppressErrorNotification = false, errorTitle = 'Operação não concluída' } = {}) => {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const error = new Error(data?.erro || `Erro no pedido: ${response.statusText}`);
        if (data && typeof data === 'object') {
            Object.assign(error, data);
        }

        if (
            response.status === 401
            && typeof window !== 'undefined'
            && localStorage.getItem('authToken')
        ) {
            window.dispatchEvent(new CustomEvent('entartes:auth-invalid', {
                detail: {
                    message: error.message,
                    status: response.status
                }
            }));
        }

        const shouldNotifyError = (
            typeof window !== 'undefined' &&
            !suppressErrorNotification &&
            response.status !== 401 &&
            String(method || 'GET').toUpperCase() !== 'GET'
        );

        if (shouldNotifyError) {
            window.dispatchEvent(new CustomEvent('entartes:request-error', {
                detail: {
                    title: errorTitle,
                    message: error.message,
                    status: response.status
                }
            }));
        }

        throw error;
    }

    return data;
};

const request = async (path, options = {}) => {
    // Get token from localStorage for auth
    const token = localStorage.getItem('authToken');
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const {
        headers: optionHeaders,
        suppressErrorNotification = false,
        errorTitle,
        ...fetchOptions
    } = options;
    const method = String(fetchOptions.method || 'GET').toUpperCase();
    
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...fetchOptions,
        headers: {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...(optionHeaders || {})
        }
    });

    return await handleResponse(response, {
        method,
        suppressErrorNotification,
        errorTitle
    });
};

export const getUtilizadores = async () => request('/utilizadores');

export const criarUtilizador = async (dados) =>
    request('/utilizadores', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

export const atualizarUtilizador = async (idUtilizador, dados) =>
    request(`/utilizadores/${idUtilizador}`, {
        method: 'PUT',
        body: JSON.stringify(dados)
    });

export const atualizarEstadoUtilizador = async (idUtilizador, EstaAtivo) =>
    request(`/utilizadores/${idUtilizador}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ EstaAtivo })
    });

export const loginUtilizador = async ({ Email, PalavraPasseHash }) =>
    request('/utilizadores/login', {
        method: 'POST',
        body: JSON.stringify({ Email, PalavraPasseHash })
    });

export const loginAutenticacao = async ({ Email, Password }) =>
    request('/autenticacao/login', {
        method: 'POST',
        body: JSON.stringify({ Email, Password })
    });

export const getInventario = async () => request('/inventario');

const buildInventoryPayload = (dados = {}) => {
    if (dados.ImagemFile) {
        const formData = new FormData();

        Object.entries(dados).forEach(([key, value]) => {
            if (key === 'ImagemFile' || value === undefined || value === null) {
                return;
            }

            formData.append(key, value);
        });
        formData.append('Imagem', dados.ImagemFile);

        return formData;
    }

    const { ImagemFile, ...jsonPayload } = dados;
    return JSON.stringify(jsonPayload);
};

export const criarArtigo = async (dados) =>
    request('/inventario', {
        method: 'POST',
        body: buildInventoryPayload(dados)
    });

export const editarArtigo = async (id, dados) =>
    request(`/inventario/${id}`, {
        method: 'PUT',
        body: buildInventoryPayload(dados)
    });

export const getAulas = async () => request('/aulas');

export const getEventos = async () => request('/eventos');

export const criarEvento = async (dados) =>
    request('/eventos', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

export const atualizarEvento = async (idEvento, dados) =>
    request(`/eventos/${idEvento}`, {
        method: 'PATCH',
        body: JSON.stringify(dados)
    });

export const removerEvento = async (idEvento) =>
    request(`/eventos/${idEvento}`, {
        method: 'DELETE'
    });

export const adicionarComentarioEvento = async (idEvento, Comentario) =>
    request(`/eventos/${idEvento}/comentarios`, {
        method: 'POST',
        body: JSON.stringify({ Comentario })
    });

export const editarComentarioEvento = async (idEventoComentario, Comentario) =>
    request(`/eventos/comentarios/${idEventoComentario}`, {
        method: 'PATCH',
        body: JSON.stringify({ Comentario })
    });

export const getPedidosAulaPrivada = async () => request('/pedidos-aula-privada');

export const getPedidosAulaPrivadaEncarregado = async () => request('/pedidos-aula-privada/encarregado');

export const getPedidosAulaPrivadaProfessor = async () => request('/pedidos-aula-privada/professor');

export const criarPedidoAulaPrivada = async (dados) =>
    request('/pedidos-aula-privada', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

export const confirmarPedidoAulaPrivadaProfessor = async (idPedidoAulaPrivada, dados = {}) =>
    request(`/pedidos-aula-privada/${idPedidoAulaPrivada}/confirmar-professor`, {
        method: 'PATCH',
        body: JSON.stringify(dados)
    });

export const rejeitarPedidoAulaPrivadaProfessor = async (idPedidoAulaPrivada, ObservacaoProfessor = '') =>
    request(`/pedidos-aula-privada/${idPedidoAulaPrivada}/rejeitar-professor`, {
        method: 'PATCH',
        body: JSON.stringify({ ObservacaoProfessor })
    });

export const aprovarPedidoAulaPrivada = async (idPedidoAulaPrivada, dados) =>
    request(`/pedidos-aula-privada/${idPedidoAulaPrivada}/aprovar`, {
        method: 'PATCH',
        body: JSON.stringify(dados)
    });

export const rejeitarPedidoAulaPrivada = async (idPedidoAulaPrivada, ObservacaoDirecao = '') =>
    request(`/pedidos-aula-privada/${idPedidoAulaPrivada}/rejeitar`, {
        method: 'PATCH',
        body: JSON.stringify({ ObservacaoDirecao })
    });

export const getMinhasDisponibilidades = async () => request('/disponibilidades/minhas');

export const getDisponibilidades = async ({ from, to, idProfessor } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (idProfessor) params.set('idProfessor', idProfessor);
    const query = params.toString();
    return request(`/disponibilidades${query ? `?${query}` : ''}`);
};

export const guardarMinhasDisponibilidades = async ({ replaceRange, replaceDates, disponibilidades }) =>
    request('/disponibilidades/minhas', {
        method: 'PUT',
        body: JSON.stringify({ replaceRange, replaceDates, disponibilidades })
    });

export const criarAula = async (dados) =>
    request('/aulas', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

export const criarAulasEmLote = async ({ Aulas }) =>
    request('/aulas/lote', {
        method: 'POST',
        body: JSON.stringify({ Aulas })
    });

export const confirmarAulaProfessor = async (idAula) =>
    request(`/aulas/${idAula}/confirmar-professor`, { method: 'PATCH' });

export const cancelarAulaProfessor = async (idAula) =>
    request(`/aulas/${idAula}/cancelar`, { method: 'PATCH' });

export const validarAulaDirecao = async (idAula, dados = {}) =>
    request(`/aulas/${idAula}/validar-direcao`, {
        method: 'PATCH',
        body: JSON.stringify(dados)
    });

export const getPagamentos = async () => request('/pagamentos');

export const getPagamentosEncarregado = async () => request('/pagamentos/encarregado');

export const pagarPagamento = async (idPagamento) =>
    request(`/pagamentos/${idPagamento}/pagar`, { method: 'PATCH' });

export const getMarcacoes = async () => request('/marcacoes');

export const getPedidosCancelamentoPendentes = async () => request('/marcacoes/cancelamentos/pendentes');

export const getAlunosEncarregado = async () => request('/marcacoes/encarregado/alunos');

export const getMarcacoesEncarregado = async (idAluno) =>
    request(`/marcacoes/encarregado/minhas?idAluno=${encodeURIComponent(idAluno)}`);

export const criarMarcacaoEncarregado = async ({ IdAluno, IdAula }) =>
    request('/marcacoes/encarregado', {
        method: 'POST',
        body: JSON.stringify({ IdAluno, IdAula })
    });

export const cancelarMarcacaoEncarregado = async (idMarcacao, Motivo) =>
    request(`/marcacoes/encarregado/${idMarcacao}/cancelar`, {
        method: 'PATCH',
        body: JSON.stringify({ Motivo })
    });

export const aprovarCancelamentoMarcacao = async (idMarcacao, ObservacaoDirecao = '') =>
    request(`/marcacoes/${idMarcacao}/cancelamentos/aprovar`, {
        method: 'PATCH',
        body: JSON.stringify({ ObservacaoDirecao })
    });

export const rejeitarCancelamentoMarcacao = async (idMarcacao, ObservacaoDirecao = '') =>
    request(`/marcacoes/${idMarcacao}/cancelamentos/rejeitar`, {
        method: 'PATCH',
        body: JSON.stringify({ ObservacaoDirecao })
    });

export const getAlugueres = async () => request('/alugueres');

export const criarAluguer = async (dados) =>
    request('/alugueres', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

export const solicitarExtensaoAluguer = async (idAluguer, novaDataProposta) =>
    request(`/alugueres/${idAluguer}/extensao`, {
        method: 'POST',
        body: JSON.stringify({ NovaDataProposta: novaDataProposta })
    });

export const avaliarPedidoExtensao = async (idPedido, aprovado, valorAdicional = 0) =>
    request(`/alugueres/pedidos-extensao/${idPedido}/avaliar`, {
        method: 'PATCH',
        body: JSON.stringify({ Aprovado: aprovado, ValorAdicional: valorAdicional })
    });

export const registarDevolucaoAluguer = async (idAluguer, EstadoEntrega, Multa = 0) =>
    request(`/alugueres/${idAluguer}/devolucao`, {
        method: 'PATCH',
        body: JSON.stringify({ EstadoEntrega, Multa })
    });

export const getEstudios = async ({ incluirInativos = false } = {}) => {
    const params = new URLSearchParams();
    if (incluirInativos) params.set('incluirInativos', 'true');
    const query = params.toString();
    return request(`/master/estudios${query ? `?${query}` : ''}`);
};

export const getEstilos = async ({ incluirInativos = false } = {}) => {
    const params = new URLSearchParams();
    if (incluirInativos) params.set('incluirInativos', 'true');
    const query = params.toString();
    return request(`/master/estilos${query ? `?${query}` : ''}`);
};

export const getProfessores = async () => request('/master/professores');

export const getGeografia = async () => request('/master/geografia');

export const criarEstudio = async (dados) =>
    request('/master/estudios', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

export const atualizarEstudio = async (idEstudio, dados) =>
    request(`/master/estudios/${idEstudio}`, {
        method: 'PATCH',
        body: JSON.stringify(dados)
    });

export const atualizarEstadoEstudio = async (idEstudio, EstaAtivo) =>
    request(`/master/estudios/${idEstudio}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ EstaAtivo })
    });

export const removerEstudio = async (idEstudio) =>
    request(`/master/estudios/${idEstudio}`, {
        method: 'DELETE'
    });

export const criarEstilo = async (dados) =>
    request('/master/estilos', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

export const atualizarEstilo = async (idEstilo, dados) =>
    request(`/master/estilos/${idEstilo}`, {
        method: 'PATCH',
        body: JSON.stringify(dados)
    });

export const atualizarEstadoEstilo = async (idEstilo, EstaAtivo) =>
    request(`/master/estilos/${idEstilo}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ EstaAtivo })
    });

export const removerEstilo = async (idEstilo) =>
    request(`/master/estilos/${idEstilo}`, {
        method: 'DELETE'
    });
