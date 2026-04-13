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

module.exports = {
    listarAlugueres,
    criarAluguer
};
