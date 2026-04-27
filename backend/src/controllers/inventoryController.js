// inventoryController.js
const inventoryService = require('../services/inventoryService');

const getInventario = async (req, res) => {
    try {
        const artigos = await inventoryService.listarArtigos();
        res.json(artigos);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Não foi possível carregar os artigos.' });
    }
};

const criarArtigo = async (req, res) => {
    try {
        const novoArtigo = await inventoryService.criarArtigo(req.body);
        res.status(201).json(novoArtigo);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Não foi possível gravar o artigo.' });
    }
};

const editarArtigo = async (req, res) => {
    try {
        const artigoAtualizado = await inventoryService.editarArtigo(req.params.id, req.body);
        res.json(artigoAtualizado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Não foi possível atualizar o artigo.' });
    }
};

const removerArtigo = async (req, res) => {
    try {
        const resultado = await inventoryService.removerArtigo(req.params.id);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Não foi possível remover o artigo.' });
    }
};

const setEstadoDisponivel = async (req, res) => {
    try {
        const { estado } = req.body;
        if (typeof estado !== 'boolean') {
            return res.status(400).json({ erro: 'O campo estado deve ser true ou false.' });
        }
        const resultado = await inventoryService.setEstadoDisponivel(req.params.id, estado);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({ erro: erro.message || 'Erro ao atualizar estado do artigo.' });
    }
};

module.exports = { 
    getInventario, 
    criarArtigo, 
    editarArtigo, 
    removerArtigo, 
    setEstadoDisponivel 
};