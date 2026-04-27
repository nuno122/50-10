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

const solicitarExtensao = async ({ IdAluguer, NovaDataProposta }) => {
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

const avaliarPedidoExtensao = async ({ IdPedido, Aprovado, ValorAdicional = 0 }) => {
    console.log('Service input ValorAdicional:', ValorAdicional, typeof ValorAdicional); // Debug
    const pedido = await rentalRepository.getPedidoExtensaoById(IdPedido);
    if (!pedido) {
        throw criarErro('Pedido de extensao nao encontrado.', 404);
    }

    if (pedido.EstadoAprovacao !== 'Pendente') {
        throw criarErro('Pedido ja foi avaliado.', 400);
    }

    // Update ValorAdicional first
    await rentalRepository.atualizarPedidoValorAdicional(IdPedido, ValorAdicional);

    await rentalRepository.atualizarEstadoPedido(IdPedido, Aprovado ? 'Aprovado' : 'Rejeitado');

    if (Aprovado) {
        const aluguerAtualizado = await rentalRepository.atualizarAluguer(
            pedido.IdAluguer, 
            pedido.NovaDataProposta,
            ValorAdicional
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

// Adiciona ao rentalService.js existente

const calcularCustoTotal = async (IdAluguer) => {
    if (!IdAluguer) throw criarErro('IdAluguer é obrigatório.', 400);

    const aluguer = await rentalRepository.buscarPorId(IdAluguer);
    if (!aluguer) throw criarErro('Aluguer não encontrado.', 404);

    const dataLevantamento = new Date(aluguer.DataLevantamento);
    const dataEntrega = new Date(aluguer.DataEntrega);
    const dias = Math.ceil((dataEntrega - dataLevantamento) / (1000 * 60 * 60 * 24));

    // Custo base de cada artigo × dias
    const custoBase = aluguer.ArtigoAluguer.reduce((total, item) => {
        const custoPorDia = item.TamanhoArtigo.Artigo.CustoPorDia;
        return total + (custoPorDia * item.Quantidade * dias);
    }, 0);

    // Soma valores adicionais das extensões aprovadas
    const custoExtensoes = aluguer.PedidoExtensao
        .filter(p => p.EstadoAprovacao === 'Aprovado')
        .reduce((total, p) => total + Number(p.ValorAdicional), 0);

    const custoTotal = custoBase + custoExtensoes;

    return {
        IdAluguer,
        dias,
        custoBase,
        custoExtensoes,
        custoTotal
    };
};

const registrarDevolucao = async (IdAluguer, artigos) => {
    if (!IdAluguer) throw criarErro('IdAluguer é obrigatório.', 400);
    if (!Array.isArray(artigos) || artigos.length === 0) {
        throw criarErro('Lista de artigos é obrigatória.', 400);
    }

    const aluguer = await rentalRepository.buscarPorId(IdAluguer);
    if (!aluguer) throw criarErro('Aluguer não encontrado.', 404);

    if (aluguer.EstadoAluguer === 'Devolvido') {
        throw criarErro('Este aluguer já foi devolvido.', 400);
    }

    let multaTotal = 0;

    for (const artigo of artigos) {
        if (!artigo.IdTamanhoArtigo || !artigo.EstadoDevolucao) {
            throw criarErro('Cada artigo deve ter IdTamanhoArtigo e EstadoDevolucao.', 400);
        }

        // Aplica multa se danificado
        if (artigo.EstadoDevolucao === 'Danificado') {
            multaTotal += artigo.Multa || 0;
        }

        await rentalRepository.atualizarEstadoArtigo(
            IdAluguer,
            artigo.IdTamanhoArtigo,
            artigo.EstadoDevolucao
        );
    }

    const aluguerAtualizado = await rentalRepository.finalizarAluguer(IdAluguer, multaTotal);

    return {
        mensagem: 'Devolução registada com sucesso.',
        multaTotal,
        aluguer: aluguerAtualizado
    };
};

module.exports = {
    listarAlugueres,
    criarAluguer,
    solicitarExtensao,
    avaliarPedidoExtensao,
    calcularCustoTotal,
    registrarDevolucao
};

