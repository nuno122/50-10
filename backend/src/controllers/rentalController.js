const rentalService = require('../services/rentalService');

const getAlugueres = async (req, res) => {
    try {
        const alugueres = await rentalService.listarAlugueres();
        res.json(alugueres);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao carregar alugueres.'
        });
    }
};

const criarAluguer = async (req, res) => {
    try {
        const resultado = await rentalService.criarAluguer(req.body);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao criar aluguer.'
        });
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
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao solicitar extensao.'
        });
    }
};

const avaliarPedidoController = async (req, res) => {
    try {
        console.log('Controller input:', req.body); // Debug
        const resultado = await rentalService.avaliarPedidoExtensao({
            IdPedido: req.params.id,
            Aprovado: req.body.Aprovado === 'true' || req.body.Aprovado === true,
            ValorAdicional: Number(req.body.ValorAdicional) || 0
        });
        console.log('Service result:', resultado); // Debug
        res.json(resultado);
    } catch (erro) {
        console.error('Controller error:', erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao avaliar pedido.'
        });
    }
};

module.exports = { 
    getAlugueres, 
    criarAluguer,
    solicitarExtensao: solicitarExtensaoController,
    avaliarPedidoExtensao: avaliarPedidoController 
};
