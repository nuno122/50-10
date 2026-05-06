const privateLessonRequestService = require('../services/privateLessonRequestService');

const criarPedido = async (req, res) => {
    try {
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const pedido = await privateLessonRequestService.criarPedido(req.body, idEncarregado);
        res.status(201).json({
            mensagem: 'Pedido de aula privada registado com sucesso.',
            pedido
        });
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao registar o pedido de aula privada.'
        });
    }
};

const getPedidos = async (req, res) => {
    try {
        const pedidos = await privateLessonRequestService.listarPedidos();
        res.json(pedidos);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar pedidos de aula privada.'
        });
    }
};

const getPedidosDoEncarregado = async (req, res) => {
    try {
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const pedidos = await privateLessonRequestService.listarPedidosDoEncarregado(idEncarregado);
        res.json(pedidos);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar os pedidos do encarregado.'
        });
    }
};

const aprovarPedido = async (req, res) => {
    try {
        const idDiretor = req.utilizador ? req.utilizador.IdUtilizador : null;
        const resultado = await privateLessonRequestService.aprovarPedido(req.params.idPedidoAulaPrivada, req.body, idDiretor);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao aprovar o pedido de aula privada.'
        });
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
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao rejeitar o pedido de aula privada.'
        });
    }
};

module.exports = {
    criarPedido,
    getPedidos,
    getPedidosDoEncarregado,
    aprovarPedido,
    rejeitarPedido
};
