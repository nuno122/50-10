// classController.js
const classService = require('../services/classService');

const getAulas = async (req, res) => {
    try {
        const aulas = await classService.listarAulas();
        res.json(aulas);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao carregar as aulas.' });
    }
};

const getAulasDisponiveis = async (req, res) => {
    try {
        const aulas = await classService.getAulasDisponiveis();
        res.json(aulas);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao carregar aulas disponíveis.' });
    }
};

const consultarVagas = async (req, res) => {
    try {
        const resultado = await classService.consultarVagas(req.params.id);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao consultar vagas.' });
    }
};

const criarAula = async (req, res) => {
    try {
        const resultado = await classService.criarAula(req.body);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Não foi possível agendar a aula.' });
    }
};

const confirmarAula = async (req, res) => {
    try {
        const resultado = await classService.confirmarPresencaProfessor(req.params.id);
        res.json({ mensagem: 'Aula confirmada pelo professor.', aula: resultado });
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message });
    }
};

const validarAula = async (req, res) => {
    try {
        const resultado = await classService.validarAulaDirecao(req.params.id);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro na validação da aula.' });
    }
};

const validarConclusao = async (req, res) => {
    try {
        const resultado = await classService.validarConclusaoAula(req.params.id);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao concluir a aula.' });
    }
};

module.exports = { 
    getAulas, 
    getAulasDisponiveis, 
    consultarVagas, 
    criarAula, 
    confirmarAula, 
    validarAula, 
    validarConclusao 
};