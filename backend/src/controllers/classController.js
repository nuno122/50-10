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

const confirmarAula = async (req, res) => {
    try {
        const idAula = req.params.id;
        const resultado = await classService.confirmarPresencaProfessor(idAula);
        res.json({ mensagem: 'Aula confirmada pelo professor.', aula: resultado });
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message });
    }
};

const validarAula = async (req, res) => {
    try {
        const idAula = req.params.id;
        const resultado = await classService.validarAulaDirecao(idAula);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(400).json({ erro: erro.message || 'Erro na validação da aula.' });
    }
};

module.exports = { getAulas, criarAula, confirmarAula, validarAula };
