const inventoryService = require('../services/inventoryService');
const { handleControllerError } = require('./controllerError');

const parseInventoryPayload = (body = {}) => {
    const dados = { ...body };

    if (typeof dados.TamanhoArtigo === 'string') {
        try {
            dados.TamanhoArtigo = JSON.parse(dados.TamanhoArtigo);
        } catch (erro) {
            const invalidPayloadError = new Error('Formato invalido para os tamanhos do artigo.');
            invalidPayloadError.statusCode = 400;
            throw invalidPayloadError;
        }
    }

    return dados;
};

const getInventario = async (req, res) => {
    try {
        const artigos = await inventoryService.listarArtigos(req.utilizador, {
            DisponivelParaAluguer: req.query.disponivelParaAluguer,
            mine: req.query.mine
        });
        res.json(artigos);
    } catch (erro) {
        handleControllerError(res, erro, 'Nao foi possivel carregar os artigos.', 'inventoryController.getInventario');
    }
};

const criarArtigo = async (req, res) => {
    try {
        const dados = {
            ...parseInventoryPayload(req.body),
            ...(req.file?.filename ? { ImagemPath: req.file.filename } : {})
        };
        const novoArtigo = await inventoryService.criarArtigo(dados, req.utilizador);
        res.status(201).json(novoArtigo);
    } catch (erro) {
        handleControllerError(res, erro, 'Nao foi possivel gravar o artigo.', 'inventoryController.criarArtigo');
    }
};

const editarArtigo = async (req, res) => {
    try {
        const dados = {
            ...parseInventoryPayload(req.body),
            ...(req.file?.filename ? { ImagemPath: req.file.filename } : {})
        };
        const artigoAtualizado = await inventoryService.editarArtigo(req.params.id, dados, req.utilizador);
        res.json(artigoAtualizado);
    } catch (erro) {
        handleControllerError(res, erro, 'Nao foi possivel atualizar o artigo.', 'inventoryController.editarArtigo');
    }
};

const removerArtigo = async (req, res) => {
    try {
        const resultado = await inventoryService.removerArtigo(req.params.id, req.utilizador);
        res.json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Nao foi possivel remover o artigo.', 'inventoryController.removerArtigo');
    }
};

module.exports = {
    getInventario,
    criarArtigo,
    editarArtigo,
    removerArtigo
};
