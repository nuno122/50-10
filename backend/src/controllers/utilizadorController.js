const utilizadorService = require('../services/utilizadorService');

const getUtilizadores = async (req, res) => {
    try {
        const utilizadores = await utilizadorService.listarUtilizadores();
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
        const novoUtilizador = await utilizadorService.criarUtilizador(req.body);
        res.status(201).json(novoUtilizador);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao criar utilizador.'
        });
    }
};

const login = async (req, res) => {
    try {
        const { Email, PalavraPasseHash } = req.body;
        const resultado = await utilizadorService.autenticarUtilizador(Email, PalavraPasseHash);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro no processo de login.'
        });
    }
};

module.exports = { getUtilizadores, criarUtilizador, login };
