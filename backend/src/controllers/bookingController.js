const bookingService = require('../services/bookingService');

const criarMarcacao = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body;
        const resultado = await bookingService.FazerMarcacao(IdAula, IdAluno);
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
        // Uni as duas lógicas: usa o ID da rota e o ID do aluno do token para segurança
        const idMarcacao = req.params.idMarcacao || req.params.id;
        const { Motivo } = req.body;
        const idAluno = req.utilizador ? req.utilizador.IdUtilizador : null; 

        const resultado = await bookingService.CancelarMarcacao(idMarcacao, idAluno, Motivo);
        res.status(200).json({ mensagem: 'Marcação cancelada com sucesso.', marcacao: resultado });
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 400).json({
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
        const idAluno = req.params.idAluno || (req.utilizador ? req.utilizador.IdUtilizador : null);
        const marcacoes = await bookingService.listarMarcacoesDoAluno(idAluno);
        res.json(marcacoes);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar marcações do aluno.'
        });
    }
};

module.exports = { 
    criarMarcacao, 
    cancelarMarcacao, 
    getMarcacoes, 
    getMarcacoesDoAluno 
};
