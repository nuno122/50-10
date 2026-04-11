const aulaService = require('../services/aulaService');

const getAulas = async (req, res) => {
    try {
        const aulas = await aulaService.listarAulas();
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
        const resultado = await aulaService.criarAula(req.body);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Nao foi possivel agendar a aula.'
        });
    }
};

module.exports = { getAulas, criarAula };
