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

const exportarFinanceiro = async (req, res) => {
    try {
        const { DataInicio, DataFim } = req.query;
        const workbook = await masterService.exportarDadosFinanceiros(DataInicio, DataFim);
        await masterService.download(res, workbook, `financeiro_${DataInicio}_${DataFim}.xlsx`);
    } catch (erro) {
        res.status(erro.statusCode || 500).json({ erro: erro.message });
    }
};

const exportarMensal = async (req, res) => {
    try {
        const workbook = await masterService.exportarMensal();
        const agora = new Date();
        const nome = `mensal_${agora.getFullYear()}_${agora.getMonth() + 1}.xlsx`;
        await masterService.download(res, workbook, nome);
    } catch (erro) {
        res.status(erro.statusCode || 500).json({ erro: erro.message });
    }
};

module.exports = {
    getEstudios,
    getEstilos,
    getGeografia,
    exportarMensal,
    exportarFinanceiro  // ← estava em falta!
};