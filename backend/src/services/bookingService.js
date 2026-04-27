const bookingRepo = require('../repositories/bookingRepository');
const classRepo = require('../repositories/classRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

// ─── Criar ───────────────────────────────────────────────────────────────────
const ConsultarVagas = async () => {
    return await classRepo.GetAulasDisponiveis();
};

const GetPreco = async (idAula) => {
    const aula = await bookingRepo.findAulaWithMarcacoes(idAula);
    if (!aula) throw criarErro('Aula nao encontrada.', 404);
    return aula.Preco;
};

const FazerMarcacao = async (idAula, idAluno) => {
    if (!idAluno || !idAula) {
        throw criarErro('IdAluno e IdAula sao obrigatorios.', 400);
    }

    const aluno = await bookingRepo.findAlunoById(idAluno);
    if (!aluno) throw criarErro('Aluno nao encontrado.', 404);

    const aula = await bookingRepo.findAulaWithMarcacoes(idAula);
    if (!aula) throw criarErro('Aula nao encontrada.', 404);

    if (!aula.EstaAtivo) throw criarErro('Esta aula foi cancelada.', 400);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (new Date(aula.Data) < hoje) {
        throw criarErro('Nao podes marcar aulas passadas.', 400);
    }

    const inscritosAtivos = aula.Marcacao.filter((marcacao) => marcacao.EstaAtivo).length;
    if (inscritosAtivos >= aula.CapacidadeMaxima) {
        throw criarErro('Aula lotada.', 400);
    }

    const jaInscrito = await bookingRepo.findExisting(idAluno, idAula);
    if (jaInscrito) throw criarErro('Ja estas inscrito nesta aula.', 400);

    const novaMarcacao = await bookingRepo.create(idAluno, idAula);
    const preco = await GetPreco(idAula);
    const prazoPagamento = new Date(aula.Data);
    prazoPagamento.setDate(prazoPagamento.getDate() - 2);

    await bookingRepo.criarPagamento(novaMarcacao.IdMarcacao, preco, prazoPagamento);

    return {
        mensagem: 'Lugar reservado!',
        marcacao: novaMarcacao
    };
};

// ─── Cancelar (Unificado com regra de 24h) ───────────────────────────────────

const isPrazoValido = (dataAulaCompleta) => {
    const agora = new Date();
    const diferencaMs = dataAulaCompleta - agora;
    const diferencaHoras = diferencaMs / (1000 * 60 * 60);
    return diferencaHoras >= 24;
};

const ProcessarCancelamento = async (idMarcacao, aprovado, motivo) => {
    if (aprovado) {
        await bookingRepo.cancelar(idMarcacao, motivo || 'Cancelamento antecipado (>= 24h)');
        return { sucesso: true, mensagem: 'Cancelamento aprovado automaticamente.' };
    }

    await bookingRepo.RegistarPedidoCancelamento(idMarcacao, false);
    return {
        sucesso: false,
        mensagem: 'Prazo de 24h expirou. O pedido foi enviado para aprovacao da Direcao.'
    };
};

const CancelarMarcacao = async (idMarcacao, idAluno, motivo) => {
    if (!idMarcacao || !idAluno) {
        throw criarErro('IdMarcacao e IdAluno sao obrigatorios.', 400);
    }

    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);

    if (!marcacao) throw criarErro('Marcacao nao encontrada.', 404);
    if (marcacao.IdAluno !== idAluno) throw criarErro('Nao tens permissao para cancelar esta marcacao.', 403);
    if (!marcacao.EstaAtivo) throw criarErro('Esta marcacao ja esta cancelada.', 400);

    const dataAulaCompleta = new Date(marcacao.Aula.Data);
    dataAulaCompleta.setHours(
        marcacao.Aula.HoraInicio.getHours(),
        marcacao.Aula.HoraInicio.getMinutes(),
        0,
        0
    );

    return await ProcessarCancelamento(idMarcacao, isPrazoValido(dataAulaCompleta), motivo);
};

// ─── Listar ──────────────────────────────────────────────────────────────────
const listarMarcacoes = async () => {
    return await bookingRepo.findAll();
};

const listarMarcacoesDoAluno = async (idAluno) => {
    if (!idAluno) throw criarErro('IdAluno e obrigatorio.', 400);
    return await bookingRepo.findByAluno(idAluno);
};

module.exports = {
    ConsultarVagas,
    GetPreco,
    FazerMarcacao,
    isPrazoValido,
    ProcessarCancelamento,
    CancelarMarcacao,
    criarMarcacao: FazerMarcacao,
    cancelarMarcacao: CancelarMarcacao,
    listarMarcacoes,
    listarMarcacoesDoAluno
};
