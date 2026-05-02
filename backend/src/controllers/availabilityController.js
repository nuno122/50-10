const availabilityService = require('../services/availabilityService');

const getDisponibilidades = async (req, res) => {
    try {
        const disponibilidades = await availabilityService.listarDisponibilidades({
            from: req.query.from,
            to: req.query.to
        });
        res.json(disponibilidades);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Nao foi possivel carregar as disponibilidades.'
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
            erro: erro.message || 'Nao foi possivel carregar as disponibilidades.'
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
            erro: erro.message || 'Nao foi possivel guardar as disponibilidades.'
        });
    }
};

module.exports = {
    getDisponibilidades,
    getMinhasDisponibilidades,
    guardarMinhasDisponibilidades
};
