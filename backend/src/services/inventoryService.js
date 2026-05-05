const inventoryRepo = require('../repositories/inventoryRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const listarArtigos = async () => {
    return await inventoryRepo.findAll();
};

const criarArtigo = async (dados) => {
    const { Nome, CustoPorDia } = dados || {};

    if (!Nome) {
        throw criarErro('Nome do artigo \u00e9 obrigat\u00f3rio.', 400);
    }

    if (CustoPorDia === undefined || CustoPorDia === null || CustoPorDia === '' || Number(CustoPorDia) <= 0) {
        throw criarErro('Custo por dia deve ser um valor positivo.', 400);
    }

    return await inventoryRepo.create(dados);
};

const editarArtigo = async (id, dados) => {
    if (!id) {
        throw criarErro('ID do artigo \u00e9 obrigat\u00f3rio para edi\u00e7\u00e3o.', 400);
    }

    if (!dados || typeof dados !== 'object') {
        throw criarErro('Dados do artigo s\u00e3o obrigat\u00f3rios para edi\u00e7\u00e3o.', 400);
    }

    return await inventoryRepo.update(id, dados);
};

const removerArtigo = async (id) => {
    if (!id) {
        throw criarErro('ID do artigo \u00e9 obrigat\u00f3rio para remo\u00e7\u00e3o.', 400);
    }

    return await inventoryRepo.delete(id);
};

module.exports = {
    listarArtigos,
    criarArtigo,
    editarArtigo,
    removerArtigo
};
