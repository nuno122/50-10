const marcacaoService = require('../services/marcacaoService');

const criarMarcacao = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body;
        const resultado = await marcacaoService.criarMarcacao(IdAluno, IdAula);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Erro ao processar a marcacao.'
        });
    }
};

const getMarcacoes = async (req, res) => {
    try {
        const marcacoes = await marcacaoService.listarMarcacoes();
        res.json(marcacoes);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao carregar marcacoes.' });
    }
};

module.exports = { criarMarcacao, getMarcacoes };
