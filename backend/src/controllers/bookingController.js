const bookingService = require('../services/bookingService');

const criarMarcacao = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body;
        const resultado = await bookingService.criarMarcacao(IdAluno, IdAula);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao processar a marcacao.'
        });
    }
};

const getMarcacoes = async (req, res) => {
    try {
        const marcacoes = await bookingService.listarMarcacoes();
        res.json(marcacoes);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao carregar marcacoes.' });
    }
};

// NOVA: Cancelar marcação
const cancelarMarcacao = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await bookingService.processarCancelamento(id);
        res.status(200).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 400).json({
            erro: erro.message
        });
    }
};

module.exports = { criarMarcacao, getMarcacoes, cancelarMarcacao };
