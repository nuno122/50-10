const API_BASE_URL = 'http://localhost:3000/api';

const handleResponse = async (response) => {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const error = new Error(data?.erro || `Erro no pedido: ${response.statusText}`);
        if (data && typeof data === 'object') {
            Object.assign(error, data);
        }
        throw error;
    }

    return data;
};

const request = async (path, options = {}) => {
    // Get token from localStorage for auth
    const token = localStorage.getItem('authToken');
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const { headers: optionHeaders, ...fetchOptions } = options;
    
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...fetchOptions,
        headers: {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...(optionHeaders || {})
        }
    });

    return await handleResponse(response);
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

export const getMinhasDisponibilidades = async () => request('/disponibilidades/minhas');

export const getDisponibilidades = async ({ from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
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

export const validarAulaDirecao = async (idAula) =>
    request(`/aulas/${idAula}/validar-direcao`, { method: 'PATCH' });

export const getPagamentos = async () => request('/pagamentos');

export const getPagamentosEncarregado = async () => request('/pagamentos/encarregado');

export const pagarPagamento = async (idPagamento) =>
    request(`/pagamentos/${idPagamento}/pagar`, { method: 'PATCH' });


export const cancelarMarcacao = async (idMarcacao) =>
    request(`/marcacoes/${idMarcacao}/cancelar`, { method: 'PATCH' });

export const getMarcacoes = async () => request('/marcacoes');

export const getMinhasMarcacoes = async () => request('/marcacoes/minhas');

export const getAlunosEncarregado = async () => request('/marcacoes/encarregado/alunos');

export const getMarcacoesEncarregado = async (idAluno) =>
    request(`/marcacoes/encarregado/minhas?idAluno=${encodeURIComponent(idAluno)}`);

export const criarMarcacao = async ({ IdAluno, IdAula }) =>
    request('/marcacoes', {
        method: 'POST',
        body: JSON.stringify({ IdAluno, IdAula })
    });

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

export const getEstudios = async () => request('/master/estudios');

export const getEstilos = async () => request('/master/estilos');

export const getGeografia = async () => request('/master/geografia');
