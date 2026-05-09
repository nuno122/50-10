const classService = require('../services/classService');
const { handleControllerError } = require('./controllerError');

const getAulas = async (req, res) => {
    try {
        const aulas = await classService.ConsultarVagas();
        res.json(aulas);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao carregar as aulas.', 'classController.getAulas');
    }
};

const criarAula = async (req, res) => {
    try {
        const resultado = await classService.criarAula(req.body);
        res.status(201).json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Nao foi possivel agendar a aula.', 'classController.criarAula');
    }
};

const criarAulasEmLote = async (req, res) => {
    try {
        const resultado = await classService.criarAulasEmLote(req.body);
        const statusCode = resultado.totalFalhas === 0 ? 201 : 200;
        res.status(statusCode).json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Nao foi possivel importar as aulas.', 'classController.criarAulasEmLote');
    }
};

const confirmarAula = async (req, res) => {
    try {
        const idAula = req.params.id;
        const resultado = await classService.ConfirmarPresenca(idAula);
        res.json({ mensagem: 'Aula confirmada pelo professor.', aula: resultado });
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao confirmar a aula.', 'classController.confirmarAula');
    }
};

const cancelarAula = async (req, res) => {
    try {
        const idAula = req.params.id;
        const resultado = await classService.cancelarAula(idAula, req.utilizador);
        res.json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao cancelar a aula.', 'classController.cancelarAula');
    }
};

const validarAula = async (req, res) => {
    try {
        const idAula = req.params.id;
        const resultado = await classService.validarAula(idAula, req.body);
        res.json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro na validacao da aula.', 'classController.validarAula');
    }
};

module.exports = {
    exibirAulas: getAulas,
    getAulas,
    criarAula,
    criarAulasEmLote,
    confirmarAula,
    cancelarAula,
    validarAula
};
