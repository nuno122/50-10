const bookingService = require('../services/bookingService');

const criarMarcacao = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body;
        const resultado = await bookingService.criarMarcacao(IdAluno, IdAula);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao processar a marcação.'
        });
    }
};

const cancelarMarcacao = async (req, res) => {
    try {
        const { idMarcacao } = req.params;
        const { Motivo } = req.body;
        const idAluno = req.utilizador.IdUtilizador; // vem do token JWT

        const resultado = await bookingService.cancelarMarcacao(idMarcacao, idAluno, Motivo);
        res.json({ mensagem: 'Marcação cancelada com sucesso.', marcacao: resultado });
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao cancelar a marcação.'
        });
    }
};

const getMarcacoes = async (req, res) => {
    try {
        const marcacoes = await bookingService.listarMarcacoes();
        res.json(marcacoes);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao carregar marcações.' });
    }
};

const getMarcacoesDoAluno = async (req, res) => {
    try {
        // Pode vir da rota (/aluno/:idAluno) ou do próprio token (aluno a ver as suas)
        const idAluno = req.params.idAluno || req.utilizador.IdUtilizador;

        const marcacoes = await bookingService.listarMarcacoesDoAluno(idAluno);
        res.json(marcacoes);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar marcações do aluno.'
        });
    }
};

module.exports = { criarMarcacao, cancelarMarcacao, getMarcacoes, getMarcacoesDoAluno };