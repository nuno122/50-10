const inventoryService = require('../services/inventoryService');

const getInventario = async (req, res) => {
    try {
        const artigos = await inventoryService.listarArtigos(req.utilizador);
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
        const dados = {
            ...req.body,
            ...(req.file?.filename ? { ImagemPath: req.file.filename } : {})
        };
        const novoArtigo = await inventoryService.criarArtigo(dados, req.utilizador);
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
        const dados = {
            ...req.body,
            ...(req.file?.filename ? { ImagemPath: req.file.filename } : {})
        };
        const artigoAtualizado = await inventoryService.editarArtigo(req.params.id, dados, req.utilizador);
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
        const resultado = await inventoryService.removerArtigo(req.params.id, req.utilizador);
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
