const bookingService = require('../services/bookingService');
const { handleControllerError } = require('./controllerError');

const criarMarcacao = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body;
        const resultado = await bookingService.FazerMarcacao(IdAula, IdAluno);
        res.status(201).json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao processar a marcacao.', 'bookingController.criarMarcacao');
    }
};

const criarMarcacaoEncarregado = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body;
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const resultado = await bookingService.FazerMarcacaoComoEncarregado(IdAula, IdAluno, idEncarregado);
        res.status(201).json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao processar a marcacao.', 'bookingController.criarMarcacaoEncarregado');
    }
};

const cancelarMarcacao = async (req, res) => {
    try {
        const idMarcacao = req.params.idMarcacao || req.params.id;
        const { Motivo } = req.body;
        const idAluno = req.utilizador ? req.utilizador.IdUtilizador : null;

        const resultado = await bookingService.CancelarMarcacao(idMarcacao, idAluno, Motivo);
        res.status(200).json(resultado);
    } catch (erro) {
        erro.statusCode = erro.statusCode || 400;
        handleControllerError(res, erro, 'Erro ao cancelar a marcacao.', 'bookingController.cancelarMarcacao');
    }
};

const cancelarMarcacaoEncarregado = async (req, res) => {
    try {
        const idMarcacao = req.params.idMarcacao || req.params.id;
        const { Motivo } = req.body;
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;

        const resultado = await bookingService.CancelarMarcacaoComoEncarregado(idMarcacao, idEncarregado, Motivo);
        res.status(200).json(resultado);
    } catch (erro) {
        erro.statusCode = erro.statusCode || 400;
        handleControllerError(res, erro, 'Erro ao cancelar a marcacao.', 'bookingController.cancelarMarcacaoEncarregado');
    }
};

const getMarcacoes = async (req, res) => {
    try {
        const marcacoes = await bookingService.listarMarcacoes();
        res.json(marcacoes);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao carregar marcacoes.', 'bookingController.getMarcacoes');
    }
};

const getMarcacoesDoAluno = async (req, res) => {
    try {
        const idAluno = req.params.idAluno || (req.utilizador ? req.utilizador.IdUtilizador : null);
        const marcacoes = await bookingService.listarMarcacoesDoAluno(idAluno);
        res.json(marcacoes);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao carregar marcacoes do aluno.', 'bookingController.getMarcacoesDoAluno');
    }
};

const getAlunosDoEncarregado = async (req, res) => {
    try {
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const alunos = await bookingService.listarAlunosDoEncarregado(idEncarregado);
        res.json(alunos);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao carregar os alunos do encarregado.', 'bookingController.getAlunosDoEncarregado');
    }
};

const getMarcacoesDoEncarregado = async (req, res) => {
    try {
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const idAluno = req.query.idAluno;
        const marcacoes = await bookingService.listarMarcacoesDoEncarregado(idEncarregado, idAluno);
        res.json(marcacoes);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao carregar marcacoes do encarregado.', 'bookingController.getMarcacoesDoEncarregado');
    }
};

const getPedidosCancelamentoPendentes = async (req, res) => {
    try {
        const pedidos = await bookingService.listarPedidosCancelamentoPendentes();
        res.json(pedidos);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao carregar pedidos de cancelamento pendentes.', 'bookingController.getPedidosCancelamentoPendentes');
    }
};

const aprovarPedidoCancelamento = async (req, res) => {
    try {
        const idMarcacao = req.params.idMarcacao;
        const observacao = req.body?.ObservacaoDirecao;
        const idDiretor = req.utilizador ? req.utilizador.IdUtilizador : null;
        const resultado = await bookingService.aprovarPedidoCancelamento(idMarcacao, idDiretor, observacao);
        res.json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao aprovar o pedido de cancelamento.', 'bookingController.aprovarPedidoCancelamento');
    }
};

const rejeitarPedidoCancelamento = async (req, res) => {
    try {
        const idMarcacao = req.params.idMarcacao;
        const observacao = req.body?.ObservacaoDirecao;
        const idDiretor = req.utilizador ? req.utilizador.IdUtilizador : null;
        const resultado = await bookingService.rejeitarPedidoCancelamento(idMarcacao, idDiretor, observacao);
        res.json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao rejeitar o pedido de cancelamento.', 'bookingController.rejeitarPedidoCancelamento');
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
    getMarcacoesDoEncarregado,
    getPedidosCancelamentoPendentes,
    aprovarPedidoCancelamento,
    rejeitarPedidoCancelamento
};
