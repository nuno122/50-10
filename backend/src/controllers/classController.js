const classService = require('../services/classService');

const getAulas = async (req, res) => {
    try {
        const aulas = await classService.listarAulas();
        res.json(aulas);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar as aulas.'
        });
    }
};

const criarAula = async (req, res) => {
    try {
        const resultado = await classService.criarAula(req.body);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Nao foi possivel agendar a aula.'
        });
    }
};

module.exports = { getAulas, criarAula };
