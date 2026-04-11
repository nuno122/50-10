const pagamentoRepository = require('../repositories/pagamentoRepository');

// 1. Listar toda a faturação
const getPagamentos = async (req, res) => {
    try {
        const pagamentos = await pagamentoRepository.buscarTodosPagamentos();
        res.json(pagamentos);
    } catch (erro) {
        console.error("Erro ao carregar pagamentos:", erro);
        res.status(500).json({ erro: "Não foi possível carregar o histórico financeiro." });
    }
};

// 2. O pesadelo dos devedores (Listar Atrasos)
const getAtrasados = async (req, res) => {
    try {
        const pagamentosAtrasados = await pagamentoRepository.buscarPagamentosEmAtraso();
        res.json(pagamentosAtrasados);
    } catch (erro) {
        console.error("Erro ao carregar dívidas:", erro);
        res.status(500).json({ erro: "Não foi possível calcular os pagamentos em atraso." });
    }
};

// 3. Dar baixa de uma fatura (O aluno pagou!)
const pagar = async (req, res) => {
    try {
        // Recebemos o ID do pagamento que vem no URL (ex: /api/pagamentos/123/pagar)
        const { id } = req.params;

        // Validar se o pagamento existe
        const pagamento = await pagamentoRepository.buscarPagamentoPorId(id);
        if (!pagamento) {
            return res.status(404).json({ erro: "Fatura não encontrada no sistema." });
        }

        // Regra de Negócio: Não deixar pagar duas vezes
        if (pagamento.EstadoPagamento === "Pago") {
            return res.status(400).json({ erro: "Este pagamento já se encontra liquidado!" });
        }

        // Registar o pagamento
        const pagamentoAtualizado = await pagamentoRepository.registarRecebimento(id);
        
        res.json({ 
            mensagem: "Pagamento registado com sucesso!", 
            pagamento: pagamentoAtualizado 
        });

    } catch (erro) {
        console.error("Erro ao registar pagamento:", erro);
        res.status(500).json({ erro: "Ocorreu um erro ao processar a liquidação." });
    }
};

module.exports = {
    getPagamentos,
    getAtrasados,
    pagar
};