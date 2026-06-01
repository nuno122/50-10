const rentalService = require('../services/rentalService');
const { handleControllerError } = require('./controllerError');

const getAlugueres = async (req, res) => {
    try {
        const asOwner = req.query.asOwner === 'true';
        const alugueres = await rentalService.listarAlugueres(req.utilizador, { asOwner });
        res.json(alugueres);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao carregar alugueres.', 'rentalController.getAlugueres');
    }
};

const criarAluguer = async (req, res) => {
    try {
        const resultado = await rentalService.criarAluguer(req.body, req.utilizador);
        res.status(201).json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao criar aluguer.', 'rentalController.criarAluguer');
    }
};

const solicitarExtensaoController = async (req, res) => {
    try {
        const resultado = await rentalService.SolicitarExtensaoPrazo({
            IdAluguer: req.params.id,
            NovaDataProposta: req.body.NovaDataProposta
        }, req.utilizador);
        res.status(201).json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao solicitar extensao.', 'rentalController.solicitarExtensao');
    }
};

const avaliarPedidoController = async (req, res) => {
    try {
        const resultado = await rentalService.AvaliarPedidoExtensao({
            IdPedido: req.params.id,
            Aprovado: req.body.Aprovado === 'true' || req.body.Aprovado === true,
            ValorAdicional: Number(req.body.ValorAdicional) || 0
        }, req.utilizador);
        res.json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao avaliar pedido.', 'rentalController.avaliarPedidoExtensao');
    }
};

const registarDevolucaoController = async (req, res) => {
    try {
        const resultado = await rentalService.RegistarDevolucao({
            IdAluguer: req.params.id,
            EstadoEntrega: req.body.EstadoEntrega,
            Multa: req.body.Multa
        }, req.utilizador);
        res.json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Erro ao registar devolucao.', 'rentalController.registarDevolucao');
    }
};

module.exports = {
    getAlugueres,
    criarAluguer,
    solicitarExtensao: solicitarExtensaoController,
    avaliarPedidoExtensao: avaliarPedidoController,
    registarDevolucao: registarDevolucaoController
};
