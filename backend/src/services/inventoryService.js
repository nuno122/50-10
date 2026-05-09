const inventoryRepo = require('../repositories/inventoryRepository');
const PERMISSOES = require('../config/permissions');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const isValidArticleId = (id) => (
    typeof id === 'string' && UUID_REGEX.test(id.trim())
);

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
                Tamanho: tamanhoRaw || (quantidade > 0 ? '\u00danico' : ''),
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
            throw criarErro('A quantidade de cada tamanho deve ser um n\u00famero inteiro igual ou superior a zero.', 400);
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
        throw criarErro('Nome do artigo \u00e9 obrigat\u00f3rio.', 400);
    }

    if (CustoPorDia === undefined || CustoPorDia === null || CustoPorDia === '' || Number(CustoPorDia) <= 0) {
        throw criarErro('Custo por dia deve ser um valor positivo.', 400);
    }

    if (!utilizador?.IdUtilizador) {
        throw criarErro('Sess\u00e3o inv\u00e1lida para publicar o an\u00fancio.', 401);
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
        throw criarErro('ID do artigo \u00e9 obrigat\u00f3rio para edi\u00e7\u00e3o.', 400);
    }

    if (!isValidArticleId(id)) {
        throw criarErro('ID do artigo inv\u00e1lido.', 400);
    }

    if (!dados || typeof dados !== 'object') {
        throw criarErro('Os dados do artigo s\u00e3o obrigat\u00f3rios para edi\u00e7\u00e3o.', 400);
    }

    const artigoAtual = await inventoryRepo.findById(id);

    if (!artigoAtual) {
        throw criarErro('Artigo n\u00e3o encontrado.', 404);
    }

    if (!podeGerirArtigo(utilizador, artigoAtual)) {
        throw criarErro('N\u00e3o tens permiss\u00e3o para editar este an\u00fancio.', 403);
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
        throw criarErro('ID do artigo \u00e9 obrigat\u00f3rio para remo\u00e7\u00e3o.', 400);
    }

    if (!isValidArticleId(id)) {
        throw criarErro('ID do artigo inv\u00e1lido.', 400);
    }

    const artigoAtual = await inventoryRepo.findById(id);

    if (!artigoAtual) {
        throw criarErro('Artigo n\u00e3o encontrado.', 404);
    }

    if (!podeGerirArtigo(utilizador, artigoAtual)) {
        throw criarErro('N\u00e3o tens permiss\u00e3o para remover este an\u00fancio.', 403);
    }

    return await inventoryRepo.delete(id);
};

module.exports = {
    listarArtigos,
    criarArtigo,
    editarArtigo,
    removerArtigo
};
