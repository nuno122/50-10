const rentalRepository = require('../repositories/rentalRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const listarAlugueres = async () => {
    return await rentalRepository.buscarTodos();
};

const criarAluguer = async ({ IdUtilizador, DataLevantamento, DataEntrega, ListaArtigos }) => {
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

    for (const artigo of ListaArtigos) {
        if (!artigo.IdTamanhoArtigo || !artigo.Quantidade) {
            throw criarErro('Cada artigo deve ter IdTamanhoArtigo e Quantidade.', 400);
        }

        const stock = await rentalRepository.buscarStockArtigo(artigo.IdTamanhoArtigo);

        if (!stock) {
            throw criarErro(`Artigo/Tamanho nao encontrado: ${artigo.IdTamanhoArtigo}`, 404);
        }

        if (stock.Quantidade < artigo.Quantidade) {
            throw criarErro(`Stock insuficiente para o artigo ${artigo.IdTamanhoArtigo}.`, 400);
        }
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

const SolicitarExtensaoPrazo = async ({ IdAluguer, NovaDataProposta }) => {
    if (!IdAluguer || !NovaDataProposta) {
        throw criarErro('IdAluguer e NovaDataProposta sao obrigatorios.', 400);
    }

    const dataProposta = new Date(NovaDataProposta);
    if (Number.isNaN(dataProposta.getTime())) {
        throw criarErro('NovaDataProposta invalida.', 400);
    }

    const pedido = await rentalRepository.criarPedidoExtensao(IdAluguer, NovaDataProposta);
    return {
        mensagem: 'Pedido de extensao criado com sucesso!',
        pedido
    };
};

const AvaliarPedidoExtensao = async ({ IdPedido, Aprovado, ValorAdicional = 0 }) => {
    const pedido = await rentalRepository.getPedidoExtensaoById(IdPedido);
    if (!pedido) {
        throw criarErro('Pedido de extensao nao encontrado.', 404);
    }

    if (pedido.EstadoAprovacao !== 'Pendente') {
        throw criarErro('Pedido ja foi avaliado.', 400);
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

const RegistarDevolucao = async ({ IdAluguer, EstadoEntrega, Multa = 0 }) => {
    if (!IdAluguer || !EstadoEntrega) {
        throw criarErro('IdAluguer e EstadoEntrega sao obrigatorios.', 400);
    }

    if (!['Em boas condicoes', 'Danificado'].includes(EstadoEntrega)) {
        throw criarErro('EstadoEntrega invalido.', 400);
    }

    const aluguer = await rentalRepository.getAluguerById(IdAluguer);
    if (!aluguer) {
        throw criarErro('Aluguer nao encontrado.', 404);
    }

    if (String(aluguer.EstadoAluguer || '').toLowerCase() === 'entregue') {
        throw criarErro('A devolucao deste aluguer ja foi registada.', 400);
    }

    const multaNormalizada = Number(Multa || 0);
    if (Number.isNaN(multaNormalizada) || multaNormalizada < 0) {
        throw criarErro('Multa invalida.', 400);
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
