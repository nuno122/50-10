const paymentRepo = require('../repositories/paymentRepository');

// ─── Usado pela classService (validacao de aula) ──────────────────────────────

const gerarPagamentosParaAula = async (listaAlunos, preco, idAula) => {
    const pagamentos = [];

    for (const aluno of listaAlunos) {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() + 5); // 5 dias

        const dadosPagamento = {
            Valor: preco,
            DataLimite: dataLimite,
            IdAluno: aluno.IdUtilizador,
            IdAula: idAula,
            estado: 'Pendente'
        };

        const pagamento = await paymentRepo.criarPagamento(dadosPagamento);
        pagamentos.push(pagamento);
    }

    return {
        mensagem: `${pagamentos.length} pagamentos gerados para os alunos presentes.`,
        pagamentos
    };
};

// ─── GerarPagamento: cria um pagamento individual ────────────────────────────

const GerarPagamento = async (idAluno, valor, descricao) => {
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
        await GerarPagamento(idAluno, valor, descricao);
        gerados++;
    }

    return { gerados };
};

module.exports = {
    gerarPagamentosParaAula,
    GerarPagamento,
    GerarPagamentosMassa
};
