const bookingService = require('../services/bookingService');

const criarMarcacao = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body;
        const resultado = await bookingService.FazerMarcacao(IdAula, IdAluno);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao processar a marcacao.'
        });
    }
};

const criarMarcacaoEncarregado = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body;
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const resultado = await bookingService.FazerMarcacaoComoEncarregado(IdAula, IdAluno, idEncarregado);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao processar a marcacao.'
        });
    }
};

const cancelarMarcacao = async (req, res) => {
    try {
        const idMarcacao = req.params.idMarcacao || req.params.id;
        const { Motivo } = req.body;
        const idAluno = req.utilizador ? req.utilizador.IdUtilizador : null;

        const resultado = await bookingService.CancelarMarcacao(idMarcacao, idAluno, Motivo);
        res.status(200).json({ mensagem: 'Marcacao cancelada com sucesso.', marcacao: resultado });
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 400).json({
            erro: erro.message || 'Erro ao cancelar a marcacao.'
        });
    }
};

const cancelarMarcacaoEncarregado = async (req, res) => {
    try {
        const idMarcacao = req.params.idMarcacao || req.params.id;
        const { Motivo } = req.body;
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;

        const resultado = await bookingService.CancelarMarcacaoComoEncarregado(idMarcacao, idEncarregado, Motivo);
        res.status(200).json({ mensagem: 'Marcacao cancelada com sucesso.', marcacao: resultado });
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 400).json({
            erro: erro.message || 'Erro ao cancelar a marcacao.'
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

const getMarcacoesDoAluno = async (req, res) => {
    try {
        const idAluno = req.params.idAluno || (req.utilizador ? req.utilizador.IdUtilizador : null);
        const marcacoes = await bookingService.listarMarcacoesDoAluno(idAluno);
        res.json(marcacoes);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar marcacoes do aluno.'
        });
    }
};

const getAlunosDoEncarregado = async (req, res) => {
    try {
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const alunos = await bookingService.listarAlunosDoEncarregado(idEncarregado);
        res.json(alunos);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar os alunos do encarregado.'
        });
    }
};

const getMarcacoesDoEncarregado = async (req, res) => {
    try {
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const idAluno = req.query.idAluno;
        const marcacoes = await bookingService.listarMarcacoesDoEncarregado(idEncarregado, idAluno);
        res.json(marcacoes);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar marcacoes do encarregado.'
        });
    }
};

module.exports = {
    criarMarcacao,
    criarMarcacaoEncarregado,
    cancelarMarcacao,
    cancelarMarcacaoEncarregado,
    getMarcacoes,
    getMarcacoesDoAluno,
    getAlunosDoEncarregado,
    getMarcacoesDoEncarregado
};
