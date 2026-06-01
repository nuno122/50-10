const rentalRepository = require('../repositories/rentalRepository');
const PERMISSOES = require('../config/permissions');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const utilizadorEDirecao = (utilizador) => utilizador?.Permissoes === PERMISSOES.DIRECAO;

const utilizadorEDonoDoArtigo = (aluguer, utilizador) => {
    if (!aluguer || !utilizador?.IdUtilizador) return false;
    return (aluguer.ArtigoAluguer || []).some(
        (entry) => entry.TamanhoArtigo?.Artigo?.IdUtilizadorCriador === utilizador.IdUtilizador
    );
};

const listarAlugueres = async (utilizador, { asOwner = false } = {}) => {
    const isDirecao = utilizadorEDirecao(utilizador);

    if (asOwner) {
        return await rentalRepository.buscarTodos({
            IdUtilizadorCriadorArtigo: utilizador?.IdUtilizador
        });
    }

    return await rentalRepository.buscarTodos({
        IdUtilizador: isDirecao ? undefined : utilizador?.IdUtilizador
    });
};

const garantirAcessoAoAluguer = (aluguer, utilizador) => {
    if (!aluguer) {
        throw criarErro('Aluguer nao encontrado.', 404);
    }

    if (
        !utilizadorEDirecao(utilizador)
        && String(aluguer.IdUtilizador) !== String(utilizador?.IdUtilizador)
        && !utilizadorEDonoDoArtigo(aluguer, utilizador)
    ) {
        throw criarErro('Nao tem permissao para alterar este aluguer.', 403);
    }
};

const podeUsarArtigoInativo = (utilizador, artigo) => (
    utilizador?.IdUtilizador && artigo?.IdUtilizadorCriador === utilizador.IdUtilizador
);

const criarAluguer = async ({ IdUtilizador, DataLevantamento, DataEntrega, ListaArtigos }, utilizador) => {
    if (!IdUtilizador || !DataLevantamento || !DataEntrega) {
        throw criarErro('IdUtilizador, DataLevantamento e DataEntrega sao obrigatorios.', 400);
    }

    if (!Array.isArray(ListaArtigos) || ListaArtigos.length === 0) {
        throw criarErro('ListaArtigos deve conter pelo menos um artigo.', 400);
    }

    const dataLevantamento = new Date(DataLevantamento);
    const dataEntrega = new Date(DataEntrega);

    if (Number.isNaN(dataLevantamento.getTime()) || Number.isNaN(dataEntrega.getTime())) {
        throw criarErro('As datas do aluguer sao invalidas.', 400);
    }

    if (dataEntrega < dataLevantamento) {
        throw criarErro('A DataEntrega nao pode ser anterior a DataLevantamento.', 400);
    }

    let isOwnerOfAllArticles = true;

    for (const artigo of ListaArtigos) {
        if (!artigo.IdTamanhoArtigo || !artigo.Quantidade) {
            throw criarErro('Cada artigo deve ter IdTamanhoArtigo e Quantidade.', 400);
        }

        const stock = await rentalRepository.buscarStockArtigo(artigo.IdTamanhoArtigo);

        if (!stock) {
            throw criarErro(`Artigo/Tamanho nao encontrado: ${artigo.IdTamanhoArtigo}`, 404);
        }

        if (stock.Artigo?.DisponivelParaAluguer !== true) {
            throw criarErro(`Artigo indisponivel para aluguer: ${artigo.IdTamanhoArtigo}.`, 400);
        }

        if (stock.Artigo?.EstadoArtigo === false && !podeUsarArtigoInativo(utilizador, stock.Artigo)) {
            throw criarErro(`Artigo indisponivel para aluguer: ${artigo.IdTamanhoArtigo}.`, 403);
        }

        if (stock.Quantidade < artigo.Quantidade) {
            throw criarErro(`Stock insuficiente para o artigo ${artigo.IdTamanhoArtigo}.`, 400);
        }

        if (stock.Artigo?.IdUtilizadorCriador !== utilizador?.IdUtilizador) {
            isOwnerOfAllArticles = false;
        }
    }

    if (
        !utilizadorEDirecao(utilizador)
        && String(IdUtilizador) !== String(utilizador?.IdUtilizador)
        && !isOwnerOfAllArticles
    ) {
        throw criarErro('Nao pode criar alugueres para outra conta sem ser dono dos artigos.', 403);
    }

    const aluguer = await rentalRepository.criarComTransacao(
        IdUtilizador,
        DataLevantamento,
        DataEntrega,
        ListaArtigos
    );

    return {
        mensagem: 'Aluguer criado com sucesso!',
        aluguer
    };
};

const SolicitarExtensaoPrazo = async ({ IdAluguer, NovaDataProposta }, utilizador) => {
    if (!IdAluguer || !NovaDataProposta) {
        throw criarErro('IdAluguer e NovaDataProposta sao obrigatorios.', 400);
    }

    const aluguer = await rentalRepository.getAluguerById(IdAluguer);
    garantirAcessoAoAluguer(aluguer, utilizador);

    const dataProposta = new Date(NovaDataProposta);
    if (Number.isNaN(dataProposta.getTime())) {
        throw criarErro('NovaDataProposta inválida.', 400);
    }

    const pedido = await rentalRepository.criarPedidoExtensao(IdAluguer, NovaDataProposta);
    return {
        mensagem: 'Pedido de extensão criado com sucesso!',
        pedido
    };
};

const AvaliarPedidoExtensao = async ({ IdPedido, Aprovado, ValorAdicional = 0 }, utilizador) => {
    const pedido = await rentalRepository.getPedidoExtensaoById(IdPedido);
    if (!pedido) {
        throw criarErro('Pedido de extensão não encontrado.', 404);
    }

    if (pedido.EstadoAprovacao !== 'Pendente') {
        throw criarErro('Pedido ja foi avaliado.', 400);
    }

    const aluguer = await rentalRepository.getAluguerById(pedido.IdAluguer);

    if (!utilizadorEDirecao(utilizador) && !utilizadorEDonoDoArtigo(aluguer, utilizador)) {
        throw criarErro('Apenas o dono do artigo ou a Direcao podem avaliar pedidos de extensao.', 403);
    }

    await rentalRepository.atualizarPedidoValorAdicional(IdPedido, ValorAdicional);
    await rentalRepository.atualizarEstadoPedido(IdPedido, Aprovado ? 'Aprovado' : 'Rejeitado');

    if (Aprovado) {
        const aluguerAtualizado = await rentalRepository.atualizarAluguer(
            pedido.IdAluguer,
            pedido.NovaDataProposta
        );

        const pedidoAtualizado = await rentalRepository.getPedidoExtensaoById(IdPedido);
        return {
            mensagem: 'Extensao aprovada e aluguer atualizado!',
            pedido: pedidoAtualizado,
            aluguerAtualizado
        };
    }

    const pedidoAtualizado = await rentalRepository.getPedidoExtensaoById(IdPedido);
    return {
        mensagem: 'Extensao rejeitada.',
        pedido: pedidoAtualizado
    };
};

const RegistarDevolucao = async ({ IdAluguer, EstadoEntrega, Multa = 0 }, utilizador) => {
    if (!IdAluguer || !EstadoEntrega) {
        throw criarErro('IdAluguer e EstadoEntrega sao obrigatorios.', 400);
    }

    if (!['Em boas condicoes', 'Danificado'].includes(EstadoEntrega)) {
        throw criarErro('EstadoEntrega inválido.', 400);
    }

    const aluguer = await rentalRepository.getAluguerById(IdAluguer);
    garantirAcessoAoAluguer(aluguer, utilizador);

    if (String(aluguer.EstadoAluguer || '').toLowerCase() === 'entregue') {
        throw criarErro('A devolução deste aluguer já foi registada.', 400);
    }

    const multaNormalizada = Number(Multa || 0);
    if (Number.isNaN(multaNormalizada) || multaNormalizada < 0) {
        throw criarErro('Multa inválida.', 400);
    }

    if (
        !utilizadorEDirecao(utilizador)
        && !utilizadorEDonoDoArtigo(aluguer, utilizador)
        && multaNormalizada > 0
    ) {
        throw criarErro('Apenas o dono do artigo ou a Direcao pode aplicar multa na devolucao.', 403);
    }

    const aluguerAtualizado = await rentalRepository.registarDevolucao(
        IdAluguer,
        EstadoEntrega,
        multaNormalizada
    );

    return {
        mensagem: multaNormalizada > 0
            ? 'Devolucao registada com multa pendente.'
            : 'Devolucao registada com sucesso.',
        aluguer: aluguerAtualizado
    };
};

module.exports = {
    listarAlugueres,
    criarAluguer,
    SolicitarExtensaoPrazo,
    AvaliarPedidoExtensao,
    RegistarDevolucao,
    solicitarExtensao: SolicitarExtensaoPrazo,
    avaliarPedidoExtensao: AvaliarPedidoExtensao,
    registarDevolucao: RegistarDevolucao
};
