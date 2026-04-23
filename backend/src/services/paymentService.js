const paymentRepo = require('../repositories/paymentRepository');

const create = async (Valor, DataLimite, IdAluno, IdAula, IdMarcacao = null) => {
    return await paymentRepo.create({
        Valor,
        DataLimite,
        IdAluno,
        IdAula,
        IdMarcacao,
        estado: 'Pendente'
    });
};

const GerarPagamento = async (listaAlunos, preco, idAula) => {
    const pagamentos = [];

    for (const aluno of listaAlunos) {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() + 5);

        const pagamento = await create(preco, dataLimite, aluno.IdUtilizador, idAula);
        pagamentos.push(pagamento);
    }

    return {
        mensagem: `${pagamentos.length} pagamentos gerados para os alunos presentes.`,
        pagamentos
    };
};

module.exports = {
    create,
    GerarPagamento,
    gerarPagamentosParaAula: GerarPagamento
};
