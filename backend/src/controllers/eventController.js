const eventService = require('../services/eventService');

const getEventos = async (req, res) => {
    try {
        const eventos = await eventService.listarEventos(req.utilizador);
        res.json(eventos);
    } catch (erro) {
        console.error('Erro em eventController.getEventos:', erro);
        const status = erro.statusCode || 500;
        res.status(status).json({ erro: erro.message || 'Erro interno do servidor.' });
    }
};

const createEvento = async (req, res) => {
    try {
        const evento = await eventService.criarEvento(req.body, req.utilizador);
        res.status(201).json(evento);
    } catch (erro) {
        console.error('Erro em eventController.createEvento:', erro);
        const status = erro.statusCode || 500;
        res.status(status).json({ erro: erro.message || 'Erro interno do servidor.' });
    }
};

const updateEvento = async (req, res) => {
    try {
        const evento = await eventService.editarEvento(req.params.idEvento, req.body, req.utilizador);
        res.json(evento);
    } catch (erro) {
        console.error('Erro em eventController.updateEvento:', erro);
        const status = erro.statusCode || 500;
        res.status(status).json({ erro: erro.message || 'Erro interno do servidor.' });
    }
};

const deleteEvento = async (req, res) => {
    try {
        const resultado = await eventService.removerEvento(req.params.idEvento, req.utilizador);
        res.json(resultado);
    } catch (erro) {
        console.error('Erro em eventController.deleteEvento:', erro);
        const status = erro.statusCode || 500;
        res.status(status).json({ erro: erro.message || 'Erro interno do servidor.' });
    }
};

const createComentario = async (req, res) => {
    try {
        const resultado = await eventService.adicionarComentario(
            req.params.idEvento,
            req.body?.Comentario,
            req.utilizador
        );
        res.status(201).json(resultado);
    } catch (erro) {
        console.error('Erro em eventController.createComentario:', erro);
        const status = erro.statusCode || 500;
        res.status(status).json({ erro: erro.message || 'Erro interno do servidor.' });
    }
};

const updateComentario = async (req, res) => {
    try {
        const resultado = await eventService.editarComentario(
            req.params.idEventoComentario,
            req.body?.Comentario,
            req.utilizador
        );
        res.json(resultado);
    } catch (erro) {
        console.error('Erro em eventController.updateComentario:', erro);
        const status = erro.statusCode || 500;
        res.status(status).json({ erro: erro.message || 'Erro interno do servidor.' });
    }
};

module.exports = {
    getEventos,
    createEvento,
    updateEvento,
    deleteEvento,
    createComentario,
    updateComentario
};
