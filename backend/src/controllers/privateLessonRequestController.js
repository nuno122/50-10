const privateLessonRequestService = require('../services/privateLessonRequestService');

const handleRequestError = (res, erro, fallbackMessage, context) => {
    const status = erro.statusCode || 500;

    if (status >= 500) {
        console.error(`[privateLessonRequestController.${context}]`, erro);
    } else {
        console.warn(`[privateLessonRequestController.${context}] ${status} ${erro.message}`);
    }

    res.status(status).json({
        erro: erro.message || fallbackMessage
    });
};

const criarPedido = async (req, res) => {
    try {
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const pedido = await privateLessonRequestService.criarPedido(req.body, idEncarregado);
        res.status(201).json({
            mensagem: 'Pedido de Coaching registado com sucesso.',
            pedido
        });
    } catch (erro) {
        handleRequestError(res, erro, 'Erro ao registar o pedido de Coaching.', 'criarPedido');
    }
};

const getPedidos = async (req, res) => {
    try {
        const pedidos = await privateLessonRequestService.listarPedidos();
        res.json(pedidos);
    } catch (erro) {
        handleRequestError(res, erro, 'Erro ao carregar pedidos de Coaching.', 'getPedidos');
    }
};

const getPedidosDoEncarregado = async (req, res) => {
    try {
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const pedidos = await privateLessonRequestService.listarPedidosDoEncarregado(idEncarregado);
        res.json(pedidos);
    } catch (erro) {
        handleRequestError(res, erro, 'Erro ao carregar os pedidos do encarregado.', 'getPedidosDoEncarregado');
    }
};

const getPedidosDoProfessor = async (req, res) => {
    try {
        const idProfessor = req.utilizador ? req.utilizador.IdUtilizador : null;
        const pedidos = await privateLessonRequestService.listarPedidosDoProfessor(idProfessor);
        res.json(pedidos);
    } catch (erro) {
        handleRequestError(res, erro, 'Erro ao carregar os pedidos do professor.', 'getPedidosDoProfessor');
    }
};

const confirmarPedidoProfessor = async (req, res) => {
    try {
        const idProfessor = req.utilizador ? req.utilizador.IdUtilizador : null;
        const resultado = await privateLessonRequestService.confirmarPedidoProfessor(
            req.params.idPedidoAulaPrivada,
            req.body,
            idProfessor
        );
        res.json(resultado);
    } catch (erro) {
        handleRequestError(res, erro, 'Erro ao confirmar disponibilidade do professor.', 'confirmarPedidoProfessor');
    }
};

const rejeitarPedidoProfessor = async (req, res) => {
    try {
        const idProfessor = req.utilizador ? req.utilizador.IdUtilizador : null;
        const resultado = await privateLessonRequestService.rejeitarPedidoProfessor(
            req.params.idPedidoAulaPrivada,
            req.body?.ObservacaoProfessor,
            idProfessor
        );
        res.json(resultado);
    } catch (erro) {
        handleRequestError(res, erro, 'Erro ao rejeitar o pedido pelo professor.', 'rejeitarPedidoProfessor');
    }
};

const aprovarPedido = async (req, res) => {
    try {
        const idDiretor = req.utilizador ? req.utilizador.IdUtilizador : null;
        const resultado = await privateLessonRequestService.aprovarPedido(req.params.idPedidoAulaPrivada, req.body, idDiretor);
        res.json(resultado);
    } catch (erro) {
        handleRequestError(res, erro, 'Erro ao aprovar o pedido de Coaching.', 'aprovarPedido');
    }
};

const rejeitarPedido = async (req, res) => {
    try {
        const idDiretor = req.utilizador ? req.utilizador.IdUtilizador : null;
        const resultado = await privateLessonRequestService.rejeitarPedido(
            req.params.idPedidoAulaPrivada,
            req.body?.ObservacaoDirecao,
            idDiretor
        );
        res.json(resultado);
    } catch (erro) {
        handleRequestError(res, erro, 'Erro ao rejeitar o pedido de Coaching.', 'rejeitarPedido');
    }
};

module.exports = {
    criarPedido,
    getPedidos,
    getPedidosDoEncarregado,
    getPedidosDoProfessor,
    confirmarPedidoProfessor,
    rejeitarPedidoProfessor,
    aprovarPedido,
    rejeitarPedido
};
