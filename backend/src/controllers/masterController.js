const masterService = require('../services/masterService');

const getEstudios = async (req, res) => {
    try {
        const estudios = await masterService.listarEstudios();
        res.json(estudios);
    } catch (erro) {
        console.error("Erro em masterController.getEstudios:", erro);
        const status = erro.statusCode || 500;
        res.status(status).json({ erro: erro.message || "Erro interno do servidor." });
    }
};

const getEstilos = async (req, res) => {
    try {
        const estilos = await masterService.listarEstilos();
        res.json(estilos);
    } catch (erro) {
        console.error("Erro em masterController.getEstilos:", erro);
        const status = erro.statusCode || 500;
        res.status(status).json({ erro: erro.message || "Erro interno do servidor." });
    }
};

const getGeografia = async (req, res) => {
    try {
        const geografia = await masterService.listarGeografia();
        res.json(geografia);
    } catch (erro) {
        console.error("Erro em masterController.getGeografia:", erro);
        const status = erro.statusCode || 500;
        res.status(status).json({ erro: erro.message || "Erro interno do servidor." });
    }
};

module.exports = {
    getEstudios,
    getEstilos,
    getGeografia
};