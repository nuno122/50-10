const inventarioService = require('../services/inventarioService');

const getInventario = async (req, res) => {
    try {
        const artigos = await inventarioService.listarArtigos();
        res.json(artigos);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Nao foi possivel carregar os artigos.'
        });
    }
};

const criarArtigo = async (req, res) => {
    try {
        const novoArtigo = await inventarioService.criarArtigo(req.body);
        res.status(201).json(novoArtigo);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Nao foi possivel gravar o artigo.'
        });
    }
};

const editarArtigo = async (req, res) => {
    try {
        const artigoAtualizado = await inventarioService.editarArtigo(req.params.id, req.body);
        res.json(artigoAtualizado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Nao foi possivel atualizar o artigo.'
        });
    }
};

const removerArtigo = async (req, res) => {
    try {
        const resultado = await inventarioService.removerArtigo(req.params.id);
        res.json(resultado);
    } catch (erro) {
        console.error(erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Nao foi possivel remover o artigo.'
        });
    }
};

module.exports = {
    getInventario,
    criarArtigo,
    editarArtigo,
    removerArtigo
};
