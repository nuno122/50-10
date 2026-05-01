const paymentRepository = require('../repositories/paymentRepository');
const bookingRepository = require('../repositories/bookingRepository');

const getPagamentos = async (req, res) => {
    try {
        const pagamentos = await paymentRepository.buscarTodosPagamentos();
        res.json(pagamentos);
    } catch (erro) {
        console.error('Erro ao carregar pagamentos:', erro);
        res.status(500).json({ erro: 'Nao foi possivel carregar o historico financeiro.' });
    }
};

const getPagamentosEncarregado = async (req, res) => {
    try {
        const idEncarregado = req.utilizador ? req.utilizador.IdUtilizador : null;
        const relations = await bookingRepository.findStudentsByGuardian(idEncarregado);
        const alunosIds = relations.map((relation) => relation.IdAluno);

        if (alunosIds.length === 0) {
            return res.json([]);
        }

        const pagamentos = await paymentRepository.buscarPagamentosPorAlunos(alunosIds);
        res.json(pagamentos);
    } catch (erro) {
        console.error('Erro ao carregar pagamentos do encarregado:', erro);
        res.status(500).json({ erro: 'Nao foi possivel carregar os pagamentos do encarregado.' });
    }
};

const getAtrasados = async (req, res) => {
    try {
        const pagamentosAtrasados = await paymentRepository.buscarPagamentosEmAtraso();
        res.json(pagamentosAtrasados);
    } catch (erro) {
        console.error('Erro ao carregar dividas:', erro);
        res.status(500).json({ erro: 'Nao foi possivel calcular os pagamentos em atraso.' });
    }
};

const pagar = async (req, res) => {
    try {
        const { id } = req.params;

        const pagamento = await paymentRepository.buscarPagamentoPorId(id);
        if (!pagamento) {
            return res.status(404).json({ erro: 'Fatura nao encontrada no sistema.' });
        }

        if (pagamento.EstadoPagamento === 'Pago') {
            return res.status(400).json({ erro: 'Este pagamento ja se encontra liquidado.' });
        }

        const pagamentoAtualizado = await paymentRepository.registarRecebimento(id);

        res.json({
            mensagem: 'Pagamento registado com sucesso!',
            pagamento: pagamentoAtualizado
        });
    } catch (erro) {
        console.error('Erro ao registar pagamento:', erro);
        res.status(500).json({ erro: 'Ocorreu um erro ao processar a liquidacao.' });
    }
};

module.exports = {
    getPagamentos,
    getPagamentosEncarregado,
    getAtrasados,
    pagar
};
