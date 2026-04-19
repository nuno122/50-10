const disponibilidadeService = require('../services/disponibilidadeService');

const criarDisponibilidade = async (req, res) => {
    try {
        const { Data, HoraInicio, HoraFim } = req.body;
        const idProfessor = req.utilizador.IdUtilizador;
        const resultado = await disponibilidadeService.criarDisponibilidade(idProfessor, Data, HoraInicio, HoraFim);
        res.status(201).json(resultado);
    } catch (erro) {
        console.error('Erro criarDisponibilidade:', erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message });
    }
};

const listarMinhasDisponibilidades = async (req, res) => {
    try {
        const idProfessor = req.utilizador.IdUtilizador;
        const disponibilidades = await disponibilidadeService.listarMinhas(idProfessor);
        res.json(disponibilidades);
    } catch (erro) {
        console.error('Erro listarMinhasDisponibilidades:', erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message });
    }
};

module.exports = {
    criarDisponibilidade,
    listarMinhasDisponibilidades
};

