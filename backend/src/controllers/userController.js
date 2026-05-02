const userService = require('../services/userService');

const getUtilizadores = async (req, res) => {
    try {
        const utilizadores = await userService.listarUtilizadores();
        res.json(utilizadores);
    } catch (erro) {
        console.error('Erro getUtilizadores:', erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar utilizadores.'
        });
    }
};

const criarUtilizador = async (req, res) => {
    try {
        const novoUtilizador = await userService.criarUtilizador(req.body);
        res.status(201).json(novoUtilizador);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao criar utilizador.'
        });
    }
};

const atualizarUtilizador = async (req, res) => {
    try {
        const utilizador = await userService.atualizarUtilizador(req.params.id, req.body);
        res.json(utilizador);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao atualizar utilizador.'
        });
    }
};

const atualizarEstadoUtilizador = async (req, res) => {
    try {
        const utilizador = await userService.atualizarEstadoUtilizador(req.params.id, req.body.EstaAtivo);
        res.json(utilizador);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao atualizar o estado do utilizador.'
        });
    }
};

const login = async (req, res) => {
    try {
        const { Email, PalavraPasseHash } = req.body;
        const resultado = await userService.autenticarUtilizador(Email, PalavraPasseHash);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro no processo de login.'
        });
    }
};

module.exports = {
    getUtilizadores,
    criarUtilizador,
    atualizarUtilizador,
    atualizarEstadoUtilizador,
    login
};
