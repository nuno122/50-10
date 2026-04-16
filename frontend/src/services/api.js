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

export const getAulas = async () => request('/aulas');

export const criarAula = async (dados) =>
    request('/aulas', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

export const getMarcacoes = async () => request('/marcacoes');

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

export const getEstudios = async () => request('/master/estudios');

export const getEstilos = async () => request('/master/estilos');

export const getGeografia = async () => request('/master/geografia');
export const criarDisponibilidade = async (dados) => request('/disponibilidade', { method: 'POST', body: JSON.stringify(dados) });
export const getMinhasDisponibilidades = async () => request('/disponibilidade/minhas');
