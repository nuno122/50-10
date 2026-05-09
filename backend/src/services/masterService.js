const masterRepo = require('../repositories/masterRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const limparTexto = (value) => String(value || '').trim();

const normalizarIds = (ids) => (
    [...new Set((Array.isArray(ids) ? ids : [])
        .map((id) => limparTexto(id))
        .filter(Boolean))]
);

const normalizarBoolean = (value) => (
    value === true ||
    value === 'true' ||
    value === 1 ||
    value === '1'
);

const construirDataHora = (dataValue, horaValue) => {
    const data = new Date(dataValue);
    const hora = new Date(horaValue);

    if (Number.isNaN(data.getTime()) || Number.isNaN(hora.getTime())) {
        return new Date(0);
    }

    data.setHours(hora.getUTCHours(), hora.getUTCMinutes(), 0, 0);
    return data;
};

const obterHoje = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
};

const filtrarAulasFuturas = (aulas = []) => (
    aulas.filter((aula) => construirDataHora(aula.Data, aula.HoraFim) > new Date())
);

const filtrarPedidosFuturos = (pedidos = []) => (
    pedidos.filter((pedido) => construirDataHora(pedido.DataPretendida, pedido.HoraPretendida) > new Date())
);

const temMarcacoesAtivas = (aula) => Array.isArray(aula?.Marcacao) && aula.Marcacao.length > 0;

const validarInativacaoEstilo = async (estiloAtual) => {
    const [aulasRelacionadas, pedidosRelacionados, estudiosAtivosRelacionados] = await Promise.all([
        masterRepo.findActiveAulasByEstilo(estiloAtual.IdEstiloDanca, obterHoje()),
        masterRepo.findPendingPedidosByEstilo(estiloAtual.IdEstiloDanca, obterHoje()),
        masterRepo.findActiveStudiosByEstilo(estiloAtual.IdEstiloDanca)
    ]);

    const aulasFuturas = filtrarAulasFuturas(aulasRelacionadas);
    if (aulasFuturas.length > 0) {
        if (aulasFuturas.some(temMarcacoesAtivas)) {
            throw criarErro('Não pode inativar este estilo porque tem aulas futuras com marcações associadas.', 400);
        }

        throw criarErro('Não pode inativar este estilo porque tem aulas futuras associadas.', 400);
    }

    const pedidosFuturos = filtrarPedidosFuturos(pedidosRelacionados);
    if (pedidosFuturos.length > 0) {
        throw criarErro('Não pode inativar este estilo porque existem pedidos de Coaching pendentes para esse estilo.', 400);
    }

    const deixaEstudiosSemEstilos = estudiosAtivosRelacionados.some((estudio) => (
        Array.isArray(estudio.EstudioEstilo) &&
        estudio.EstudioEstilo.length <= 1 &&
        estudio.EstudioEstilo.some((entry) => entry.IdEstiloDanca === estiloAtual.IdEstiloDanca)
    ));

    if (deixaEstudiosSemEstilos) {
        throw criarErro('Não pode inativar este estilo porque deixaria estúdios ativos sem estilos ativos associados.', 400);
    }
};

const validarInativacaoEstudio = async (estudioAtual) => {
    const aulasRelacionadas = await masterRepo.findActiveAulasByEstudio(estudioAtual.IdEstudio, obterHoje());
    const aulasFuturas = filtrarAulasFuturas(aulasRelacionadas);

    if (aulasFuturas.length === 0) {
        return;
    }

    if (aulasFuturas.some(temMarcacoesAtivas)) {
        throw criarErro('Não pode inativar este estúdio porque tem aulas futuras com marcações associadas.', 400);
    }

    throw criarErro('Não pode inativar este estúdio porque tem aulas futuras associadas.', 400);
};

const validarAtualizacaoEstudioFuturo = async (estudioAtual, capacidade, idsEstiloDanca) => {
    const aulasRelacionadas = await masterRepo.findActiveAulasByEstudio(estudioAtual.IdEstudio, obterHoje());
    const aulasFuturas = filtrarAulasFuturas(aulasRelacionadas);

    if (aulasFuturas.length === 0) {
        return;
    }

    const maiorCapacidadeFutura = Math.max(
        0,
        ...aulasFuturas.map((aula) => Number(aula.CapacidadeMaxima || 0))
    );

    if (capacidade < maiorCapacidadeFutura) {
        throw criarErro('Não pode reduzir a capacidade do estúdio abaixo da capacidade máxima de aulas futuras já agendadas.', 400);
    }

    const idsPermitidos = new Set(idsEstiloDanca);
    const aulasComEstiloRemovido = aulasFuturas.filter((aula) => !idsPermitidos.has(aula.IdEstiloDanca));

    if (aulasComEstiloRemovido.length > 0) {
        throw criarErro('Não pode remover deste estúdio estilos que ainda estão a ser usados em aulas futuras.', 400);
    }
};

const listarEstudios = async ({ incluirInativos = false } = {}) => {
    const estudios = await masterRepo.findAllEstudios({ incluirInativos });
    if (!estudios) {
        throw criarErro('Não foi possível aceder aos estúdios.', 404);
    }
    return estudios;
};

const listarEstilos = async ({ incluirInativos = false } = {}) => {
    const estilos = await masterRepo.findAllEstilos({ incluirInativos });
    if (!estilos) {
        throw criarErro('Não foi possível aceder aos estilos de dança.', 404);
    }
    return estilos;
};

const listarProfessores = async () => {
    const professores = await masterRepo.findAllProfessores();
    if (!professores) {
        throw criarErro('Não foi possível aceder aos professores.', 404);
    }
    return professores;
};

const listarGeografia = async () => {
    const paises = await masterRepo.findAllPaises();
    const distritos = await masterRepo.findAllDistritos();

    if (!paises || !distritos) {
        throw criarErro('Não foi possível carregar os dados geográficos.', 404);
    }

    return {
        paises,
        distritos
    };
};

const validarIdsEstilo = async (ids) => {
    const idsNormalizados = normalizarIds(ids);

    if (idsNormalizados.length === 0) {
        throw criarErro('Selecione pelo menos um estilo ativo para o estúdio.', 400);
    }

    const estilos = await masterRepo.findEstilosByIds(idsNormalizados);

    if (estilos.length !== idsNormalizados.length) {
        throw criarErro('Um ou mais estilos selecionados nao existem ou estao inativos.', 400);
    }

    return idsNormalizados;
};

const criarEstilo = async (dados) => {
    const Nome = limparTexto(dados?.Nome);

    if (!Nome) {
        throw criarErro('O nome do estilo e obrigatorio.', 400);
    }

    const existente = await masterRepo.findEstiloByNome(Nome);
    if (existente && existente.EstaAtivo !== false) {
        throw criarErro('Ja existe um estilo com esse nome.', 400);
    }

    if (existente?.EstaAtivo === false) {
        throw criarErro('Ja existe um estilo inativo com esse nome. Reativa-o em vez de criar outro.', 400);
    }

    return await masterRepo.createEstilo({ Nome });
};

const atualizarEstilo = async (id, dados) => {
    const IdEstiloDanca = limparTexto(id);
    const Nome = limparTexto(dados?.Nome);

    if (!IdEstiloDanca) {
        throw criarErro('O ID do estilo e obrigatorio.', 400);
    }

    if (!Nome) {
        throw criarErro('O nome do estilo e obrigatorio.', 400);
    }

    const estiloAtual = await masterRepo.findEstiloById(IdEstiloDanca);
    if (!estiloAtual) {
        throw criarErro('Estilo nao encontrado.', 404);
    }

    const existente = await masterRepo.findEstiloByNome(Nome);
    if (existente && existente.IdEstiloDanca !== IdEstiloDanca) {
        throw criarErro('Ja existe um estilo com esse nome.', 400);
    }

    return await masterRepo.updateEstilo(IdEstiloDanca, { Nome });
};

const atualizarEstadoEstilo = async (id, estaAtivo) => {
    const IdEstiloDanca = limparTexto(id);

    if (!IdEstiloDanca) {
        throw criarErro('O ID do estilo e obrigatorio.', 400);
    }

    const estiloAtual = await masterRepo.findEstiloById(IdEstiloDanca);
    if (!estiloAtual) {
        throw criarErro('Estilo nao encontrado.', 404);
    }

    const proximoEstado = normalizarBoolean(estaAtivo);

    if (proximoEstado === Boolean(estiloAtual.EstaAtivo)) {
        return estiloAtual;
    }

    if (!proximoEstado) {
        await validarInativacaoEstilo(estiloAtual);
    }

    return await masterRepo.updateEstiloStatus(IdEstiloDanca, proximoEstado);
};

const removerEstilo = async (id) => {
    const IdEstiloDanca = limparTexto(id);

    if (!IdEstiloDanca) {
        throw criarErro('O ID do estilo e obrigatorio.', 400);
    }

    const estiloAtual = await masterRepo.findEstiloById(IdEstiloDanca);
    if (!estiloAtual) {
        throw criarErro('Estilo nao encontrado.', 404);
    }

    if (estiloAtual.EstaAtivo === false) {
        throw criarErro('O estilo já se encontra inativo.', 400);
    }

    await validarInativacaoEstilo(estiloAtual);

    return await masterRepo.updateEstiloStatus(IdEstiloDanca, false);
};

const criarEstudio = async (dados) => {
    const Numero = Number(dados?.Numero);
    const Capacidade = Number(dados?.Capacidade);
    const IdsEstiloDanca = await validarIdsEstilo(dados?.IdsEstiloDanca);

    if (!Number.isInteger(Numero) || Numero < 1) {
        throw criarErro('O número do estúdio tem de ser um inteiro positivo.', 400);
    }

    if (!Number.isInteger(Capacidade) || Capacidade < 1) {
        throw criarErro('A capacidade do estúdio tem de ser um inteiro positivo.', 400);
    }

    const existente = await masterRepo.findEstudioByNumero(Numero);
    if (existente && existente.EstaAtivo !== false) {
        throw criarErro('Já existe um estúdio com esse número.', 400);
    }

    if (existente?.EstaAtivo === false) {
        throw criarErro('Já existe um estúdio inativo com esse número. Reative-o em vez de criar outro.', 400);
    }

    return await masterRepo.createEstudio({
        Numero,
        Capacidade,
        IdsEstiloDanca
    });
};

const atualizarEstudio = async (id, dados) => {
    const IdEstudio = limparTexto(id);
    const Numero = Number(dados?.Numero);
    const Capacidade = Number(dados?.Capacidade);
    const IdsEstiloDanca = await validarIdsEstilo(dados?.IdsEstiloDanca);

    if (!IdEstudio) {
        throw criarErro('O ID do estúdio é obrigatório.', 400);
    }

    if (!Number.isInteger(Numero) || Numero < 1) {
        throw criarErro('O número do estúdio tem de ser um inteiro positivo.', 400);
    }

    if (!Number.isInteger(Capacidade) || Capacidade < 1) {
        throw criarErro('A capacidade do estúdio tem de ser um inteiro positivo.', 400);
    }

    const estudioAtual = await masterRepo.findEstudioById(IdEstudio);
    if (!estudioAtual) {
        throw criarErro('Estudio nao encontrado.', 404);
    }

    const existente = await masterRepo.findEstudioByNumero(Numero);
    if (existente && existente.IdEstudio !== IdEstudio) {
        throw criarErro('Já existe um estúdio com esse número.', 400);
    }

    await validarAtualizacaoEstudioFuturo(estudioAtual, Capacidade, IdsEstiloDanca);

    return await masterRepo.updateEstudio(IdEstudio, {
        Numero,
        Capacidade,
        IdsEstiloDanca
    });
};

const atualizarEstadoEstudio = async (id, estaAtivo) => {
    const IdEstudio = limparTexto(id);

    if (!IdEstudio) {
        throw criarErro('O ID do estúdio é obrigatório.', 400);
    }

    const estudioAtual = await masterRepo.findEstudioById(IdEstudio);
    if (!estudioAtual) {
        throw criarErro('Estudio nao encontrado.', 404);
    }

    const proximoEstado = normalizarBoolean(estaAtivo);

    if (proximoEstado === Boolean(estudioAtual.EstaAtivo)) {
        return estudioAtual;
    }

    if (proximoEstado) {
        const temEstiloAtivo = (estudioAtual.EstudioEstilo || []).some((entry) => entry.EstiloDanca?.EstaAtivo !== false);
        if (!temEstiloAtivo) {
            throw criarErro('Não pode reativar um estúdio sem pelo menos um estilo ativo associado.', 400);
        }
    } else {
        await validarInativacaoEstudio(estudioAtual);
    }

    return await masterRepo.updateEstudioStatus(IdEstudio, proximoEstado);
};

const removerEstudio = async (id) => {
    const IdEstudio = limparTexto(id);

    if (!IdEstudio) {
        throw criarErro('O ID do estúdio é obrigatório.', 400);
    }

    const estudioAtual = await masterRepo.findEstudioById(IdEstudio);
    if (!estudioAtual) {
        throw criarErro('Estudio nao encontrado.', 404);
    }

    if (estudioAtual.EstaAtivo === false) {
        throw criarErro('O estúdio já se encontra inativo.', 400);
    }

    await validarInativacaoEstudio(estudioAtual);

    return await masterRepo.updateEstudioStatus(IdEstudio, false);
};

module.exports = {
    listarEstudios,
    listarEstilos,
    listarProfessores,
    listarGeografia,
    criarEstilo,
    atualizarEstilo,
    atualizarEstadoEstilo,
    removerEstilo,
    criarEstudio,
    atualizarEstudio,
    atualizarEstadoEstudio,
    removerEstudio
};
