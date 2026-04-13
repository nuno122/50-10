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

module.exports = { getAlugueres, criarAluguer };
