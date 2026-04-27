// rentalController.js
const rentalService = require('../services/rentalService');

const getAlugueres = async (req, res) => {
    try {
        const alugueres = await rentalService.listarAlugueres();
        res.json(alugueres);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao carregar alugueres.' });
    }
};

const criarAluguer = async (req, res) => {
    try {
        const resultado = await rentalService.criarAluguer(req.body);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao criar aluguer.' });
    }
};

const calcularCusto = async (req, res) => {
    try {
        const resultado = await rentalService.calcularCustoTotal(req.params.id);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao calcular custo.' });
    }
};

const solicitarExtensaoController = async (req, res) => {
    try {
        const resultado = await rentalService.solicitarExtensao({
            IdAluguer: req.params.id,
            NovaDataProposta: req.body.NovaDataProposta
        });
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao solicitar extensão.' });
    }
};

const registrarDevolucao = async (req, res) => {
    try {
        const resultado = await rentalService.registrarDevolucao(req.params.id, req.body.Artigos);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao registar devolução.' });
    }
};

const avaliarPedidoController = async (req, res) => {
    try {
        const resultado = await rentalService.avaliarPedidoExtensao({
            IdPedido: req.params.id,
            Aprovado: req.body.Aprovado === 'true' || req.body.Aprovado === true,
            ValorAdicional: Number(req.body.ValorAdicional) || 0
        });
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao avaliar pedido.' });
    }
};

module.exports = { 
    getAlugueres, 
    criarAluguer,
    calcularCusto,
    solicitarExtensao: solicitarExtensaoController,
    registrarDevolucao,
    avaliarPedidoExtensao: avaliarPedidoController 
};