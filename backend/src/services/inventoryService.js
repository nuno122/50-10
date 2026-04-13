const inventoryRepo = require('../repositories/inventoryRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const listarArtigos = async () => {
    return await inventoryRepo.findAll();
};

const criarArtigo = async ({ Nome, CustoPorDia }) => {
    if (!Nome || CustoPorDia === undefined || CustoPorDia === null || CustoPorDia === '') {
        throw criarErro('O Nome e o CustoPorDia sao obrigatorios.', 400);
    }

    return await inventoryRepo.create({ Nome, CustoPorDia });
};

const editarArtigo = async (id, dados) => {
    if (!id) {
        throw criarErro('O id do artigo e obrigatorio.', 400);
    }

    return await inventoryRepo.update(id, dados);
};

const removerArtigo = async (id) => {
    if (!id) {
        throw criarErro('O id do artigo e obrigatorio.', 400);
    }

    await inventoryRepo.delete(id);

    return { mensagem: 'Artigo removido com sucesso do catalogo!' };
};

module.exports = {
    listarArtigos,
    criarArtigo,
    editarArtigo,
    removerArtigo
};
