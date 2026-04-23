const API_BASE_URL = 'http://localhost:3000/api';

const handleResponse = async (response) => {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.erro || `Erro no pedido: ${response.statusText}`);
    }

    return data;
};

const request = async (path, options = {}) => {
    // Get token from localStorage for auth
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...(options.headers || {})
        },
        ...options
    });

    return await handleResponse(response);
};

export const getUtilizadores = async () => request('/utilizadores');

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

export const criarArtigo = async ({ Nome, CustoPorDia }) =>
    request('/inventario', {
        method: 'POST',
        body: JSON.stringify({ Nome, CustoPorDia })
    });

export const editarArtigo = async (id, dados) =>
    request(`/inventario/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dados)
    });

export const getAulas = async () => request('/aulas');

export const criarAula = async (dados) =>
    request('/aulas', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

export const confirmarAulaProfessor = async (idAula) =>
    request(`/aulas/${idAula}/confirmar-professor`, { method: 'PATCH' });

export const validarAulaDirecao = async (idAula) =>
    request(`/aulas/${idAula}/validar-direcao`, { method: 'PATCH' });

export const getPagamentos = async () => request('/pagamentos');


export const cancelarMarcacao = async (idMarcacao) =>
    request(`/marcacoes/${idMarcacao}/cancelar`, { method: 'PATCH' });

export const getMarcacoes = async () => request('/marcacoes');

export const getMinhasMarcacoes = async () => request('/marcacoes/minhas');

export const criarMarcacao = async ({ IdAluno, IdAula }) =>
    request('/marcacoes', {
        method: 'POST',
        body: JSON.stringify({ IdAluno, IdAula })
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
