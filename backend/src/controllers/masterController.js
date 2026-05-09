const masterService = require('../services/masterService');
const { handleControllerError } = require('./controllerError');

const parseBoolean = (value) => (
    value === true ||
    value === 'true' ||
    value === 1 ||
    value === '1'
);

const getEstudios = async (req, res) => {
    try {
        const estudios = await masterService.listarEstudios({
            incluirInativos: parseBoolean(req.query.incluirInativos)
        });
        res.json(estudios);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.getEstudios');
    }
};

const getEstilos = async (req, res) => {
    try {
        const estilos = await masterService.listarEstilos({
            incluirInativos: parseBoolean(req.query.incluirInativos)
        });
        res.json(estilos);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.getEstilos');
    }
};

const getProfessores = async (req, res) => {
    try {
        const professores = await masterService.listarProfessores();
        res.json(professores);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.getProfessores');
    }
};

const getGeografia = async (req, res) => {
    try {
        const geografia = await masterService.listarGeografia();
        res.json(geografia);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.getGeografia');
    }
};

const createEstilo = async (req, res) => {
    try {
        const estilo = await masterService.criarEstilo(req.body);
        res.status(201).json(estilo);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.createEstilo');
    }
};

const updateEstilo = async (req, res) => {
    try {
        const estilo = await masterService.atualizarEstilo(req.params.id, req.body);
        res.json(estilo);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.updateEstilo');
    }
};

const updateEstiloStatus = async (req, res) => {
    try {
        const estilo = await masterService.atualizarEstadoEstilo(req.params.id, req.body?.EstaAtivo);
        res.json(estilo);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.updateEstiloStatus');
    }
};

const deleteEstilo = async (req, res) => {
    try {
        await masterService.removerEstilo(req.params.id);
        res.json({ mensagem: 'Estilo inativado com sucesso.' });
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.deleteEstilo');
    }
};

const createEstudio = async (req, res) => {
    try {
        const estudio = await masterService.criarEstudio(req.body);
        res.status(201).json(estudio);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.createEstudio');
    }
};

const updateEstudio = async (req, res) => {
    try {
        const estudio = await masterService.atualizarEstudio(req.params.id, req.body);
        res.json(estudio);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.updateEstudio');
    }
};

const updateEstudioStatus = async (req, res) => {
    try {
        const estudio = await masterService.atualizarEstadoEstudio(req.params.id, req.body?.EstaAtivo);
        res.json(estudio);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.updateEstudioStatus');
    }
};

const deleteEstudio = async (req, res) => {
    try {
        await masterService.removerEstudio(req.params.id);
        res.json({ mensagem: 'Estudio inativado com sucesso.' });
    } catch (erro) {
        handleControllerError(res, erro, 'Erro interno do servidor.', 'masterController.deleteEstudio');
    }
};

module.exports = {
    getEstudios,
    getEstilos,
    getProfessores,
    getGeografia,
    createEstilo,
    updateEstilo,
    updateEstiloStatus,
    deleteEstilo,
    createEstudio,
    updateEstudio,
    updateEstudioStatus,
    deleteEstudio
};
