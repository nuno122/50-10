const paymentRepo = require('../repositories/paymentRepository');

const create = async (Valor, DataLimite, IdMarcacao) => {
    return await paymentRepo.create({
        Valor,
        DataLimite,
        IdMarcacao,
        estado: 'Pendente'
    });
};

const GerarPagamento = async (listaMarcacoes, preco) => {
    const pagamentos = [];

    for (const marcacao of listaMarcacoes) {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() + 5);

        const pagamento = await create(preco, dataLimite, marcacao.IdMarcacao);
        pagamentos.push(pagamento);
    }

    return {
        mensagem: `${pagamentos.length} pagamentos gerados para as marcacoes ativas.`,
        pagamentos
    };
};

module.exports = {
    create,
    GerarPagamento,
    gerarPagamentosParaAula: GerarPagamento
};
