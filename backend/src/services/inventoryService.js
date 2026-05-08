const inventoryRepo = require('../repositories/inventoryRepository');
const PERMISSOES = require('../config/permissions');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const podeGerirArtigo = (utilizador, artigo) => {
    if (!utilizador || !artigo) {
        return false;
    }

    return utilizador.Permissoes === PERMISSOES.DIRECAO
        || artigo.IdUtilizadorCriador === utilizador.IdUtilizador;
};

const podeVerArtigoInativo = (utilizador, artigo) => (
    utilizador?.IdUtilizador && artigo?.IdUtilizadorCriador === utilizador.IdUtilizador
);

const listarArtigos = async (utilizador) => {
    const artigos = await inventoryRepo.findAll();

    return artigos.filter((artigo) => (
        artigo.EstadoArtigo !== false || podeVerArtigoInativo(utilizador, artigo)
    ));
};

const criarArtigo = async (dados, utilizador) => {
    const { Nome, CustoPorDia } = dados || {};

    if (!Nome) {
        throw criarErro('Nome do artigo e obrigatorio.', 400);
    }

    if (CustoPorDia === undefined || CustoPorDia === null || CustoPorDia === '' || Number(CustoPorDia) <= 0) {
        throw criarErro('Custo por dia deve ser um valor positivo.', 400);
    }

    if (!utilizador?.IdUtilizador) {
        throw criarErro('Sessao invalida para publicar o anuncio.', 401);
    }

    return await inventoryRepo.create({
        ...dados,
        IdUtilizadorCriador: utilizador.IdUtilizador
    });
};

const editarArtigo = async (id, dados, utilizador) => {
    if (!id) {
        throw criarErro('ID do artigo e obrigatorio para edicao.', 400);
    }

    if (!dados || typeof dados !== 'object') {
        throw criarErro('Dados do artigo sao obrigatorios para edicao.', 400);
    }

    const artigoAtual = await inventoryRepo.findById(id);

    if (!artigoAtual) {
        throw criarErro('Artigo nao encontrado.', 404);
    }

    if (!podeGerirArtigo(utilizador, artigoAtual)) {
        throw criarErro('Nao tens permissao para editar este anuncio.', 403);
    }

    return await inventoryRepo.update(id, dados);
};

const removerArtigo = async (id, utilizador) => {
    if (!id) {
        throw criarErro('ID do artigo e obrigatorio para remocao.', 400);
    }

    const artigoAtual = await inventoryRepo.findById(id);

    if (!artigoAtual) {
        throw criarErro('Artigo nao encontrado.', 404);
    }

    if (!podeGerirArtigo(utilizador, artigoAtual)) {
        throw criarErro('Nao tens permissao para remover este anuncio.', 403);
    }

    return await inventoryRepo.delete(id);
};

module.exports = {
    listarArtigos,
    criarArtigo,
    editarArtigo,
    removerArtigo
};
