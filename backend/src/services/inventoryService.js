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

const normalizeRentalFlag = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }

    return Boolean(value);
};

const normalizeSizeEntries = (value, { required = false } = {}) => {
    if (value === undefined) {
        if (required) {
            throw criarErro('Indica pelo menos um tamanho com quantidade.', 400);
        }

        return undefined;
    }

    if (!Array.isArray(value)) {
        throw criarErro('Os tamanhos do artigo devem ser enviados numa lista.', 400);
    }

    const normalized = value
        .map((entry) => {
            const quantidade = Number(entry?.Quantidade ?? 0);
            const tamanhoRaw = String(entry?.Tamanho || '').trim();

            return {
                IdTamanhoArtigo: entry?.IdTamanhoArtigo ? String(entry.IdTamanhoArtigo) : undefined,
                Tamanho: tamanhoRaw || (quantidade > 0 ? 'Único' : ''),
                Quantidade: quantidade,
                Condicao: String(entry?.Condicao || 'Bom').trim() || 'Bom'
            };
        })
        .filter((entry) => (
            entry.IdTamanhoArtigo
            || entry.Tamanho
            || entry.Quantidade !== 0
            || entry.Condicao !== 'Bom'
        ));

    if (required && normalized.length === 0) {
        throw criarErro('Indica pelo menos um tamanho com quantidade.', 400);
    }

    normalized.forEach((entry) => {
        if (!entry.Tamanho) {
            throw criarErro('Cada registo de stock deve incluir um tamanho.', 400);
        }

        if (!Number.isInteger(entry.Quantidade) || entry.Quantidade < 0) {
            throw criarErro('A quantidade de cada tamanho deve ser um número inteiro igual ou superior a zero.', 400);
        }
    });

    return normalized;
};

const listarArtigos = async (utilizador, filtros = {}) => {
    const onlyMine = normalizeRentalFlag(filtros.mine) === true;
    const artigos = await inventoryRepo.findAll({
        DisponivelParaAluguer: normalizeRentalFlag(filtros.DisponivelParaAluguer),
        IdUtilizadorCriador: onlyMine ? utilizador?.IdUtilizador : undefined
    });

    return artigos.filter((artigo) => (
        artigo.EstadoArtigo !== false || podeVerArtigoInativo(utilizador, artigo)
    ));
};

const criarArtigo = async (dados, utilizador) => {
    const { Nome, CustoPorDia } = dados || {};
    const disponivelParaAluguer = normalizeRentalFlag(dados?.DisponivelParaAluguer) === true;
    const tamanhos = normalizeSizeEntries(dados?.TamanhoArtigo, { required: true });

    if (!Nome) {
        throw criarErro('Nome do artigo é obrigatório.', 400);
    }

    if (CustoPorDia === undefined || CustoPorDia === null || CustoPorDia === '' || Number(CustoPorDia) <= 0) {
        throw criarErro('Custo por dia deve ser um valor positivo.', 400);
    }

    if (!utilizador?.IdUtilizador) {
        throw criarErro('Sessão inválida para publicar o anúncio.', 401);
    }

    return await inventoryRepo.create({
        ...dados,
        IdUtilizadorCriador: utilizador.IdUtilizador,
        DisponivelParaAluguer: disponivelParaAluguer,
        TamanhoArtigo: tamanhos
    });
};

const editarArtigo = async (id, dados, utilizador) => {
    if (!id) {
        throw criarErro('ID do artigo é obrigatório para edição.', 400);
    }

    if (!dados || typeof dados !== 'object') {
        throw criarErro('Os dados do artigo são obrigatórios para edição.', 400);
    }

    const artigoAtual = await inventoryRepo.findById(id);

    if (!artigoAtual) {
        throw criarErro('Artigo não encontrado.', 404);
    }

    if (!podeGerirArtigo(utilizador, artigoAtual)) {
        throw criarErro('Não tens permissão para editar este anúncio.', 403);
    }

    const payload = { ...dados };

    if (Object.prototype.hasOwnProperty.call(dados, 'DisponivelParaAluguer')) {
        payload.DisponivelParaAluguer = normalizeRentalFlag(dados.DisponivelParaAluguer) === true;
    }

    if (Object.prototype.hasOwnProperty.call(dados, 'TamanhoArtigo')) {
        payload.TamanhoArtigo = normalizeSizeEntries(dados.TamanhoArtigo, { required: true });
    }

    return await inventoryRepo.update(id, payload);
};

const removerArtigo = async (id, utilizador) => {
    if (!id) {
        throw criarErro('ID do artigo é obrigatório para remoção.', 400);
    }

    const artigoAtual = await inventoryRepo.findById(id);

    if (!artigoAtual) {
        throw criarErro('Artigo não encontrado.', 404);
    }

    if (!podeGerirArtigo(utilizador, artigoAtual)) {
        throw criarErro('Não tens permissão para remover este anúncio.', 403);
    }

    return await inventoryRepo.delete(id);
};

module.exports = {
    listarArtigos,
    criarArtigo,
    editarArtigo,
    removerArtigo
};
