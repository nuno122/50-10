const paymentRepo = require('../repositories/paymentRepository');

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

module.exports = { gerarPagamentosParaAula };
