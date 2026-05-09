const availabilityService = require('../services/availabilityService');

const getDisponibilidades = async (req, res) => {
    try {
        const disponibilidades = await availabilityService.listarDisponibilidades({
            from: req.query.from,
            to: req.query.to,
            idProfessor: req.query.idProfessor
        });
        res.json(disponibilidades);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Não foi possível carregar as disponibilidades.'
        });
    }
};

const getMinhasDisponibilidades = async (req, res) => {
    try {
        const disponibilidades = await availabilityService.listarMinhasDisponibilidades(req.utilizador);
        res.json(disponibilidades);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Não foi possível carregar as disponibilidades.'
        });
    }
};

const guardarMinhasDisponibilidades = async (req, res) => {
    try {
        const resultado = await availabilityService.guardarMinhasDisponibilidades(req.utilizador, req.body);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Não foi possível guardar as disponibilidades.'
        });
    }
};

module.exports = {
    getDisponibilidades,
    getMinhasDisponibilidades,
    guardarMinhasDisponibilidades
};
