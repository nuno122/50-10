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

// ─── GerarPagamento: cria um pagamento individual ────────────────────────────

const GerarPagamentoIndividual = async (idAluno, valor, descricao) => {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + 5); // 5 dias de prazo

    const dadosPagamento = {
        Valor: valor,
        DataLimite: dataLimite,
        IdAluno: idAluno,
        descricao: descricao || '',
        estado: 'Pendente'
    };

    return await paymentRepo.create(dadosPagamento);
};

// ─── GerarPagamentosMassa: cria pagamentos para uma lista de alunos ──────────

const GerarPagamentosMassa = async (alunosIds, valor, descricao) => {
    let gerados = 0;

    for (const idAluno of alunosIds) {
        await GerarPagamentoIndividual(idAluno, valor, descricao);
        gerados++;
    }

    return { gerados };
};

module.exports = {
    create,
    GerarPagamento,
    GerarPagamentoIndividual,
    GerarPagamentosMassa,
    gerarPagamentosParaAula: GerarPagamento
};
