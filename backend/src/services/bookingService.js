const bookingRepo = require('../repositories/bookingRepository');
const classRepo = require('../repositories/classRepository');

const ESTADOS_CANCELAMENTO = bookingRepo.ESTADOS_CANCELAMENTO || {
    SEM_PEDIDO: 'SemPedido',
    PENDENTE: 'Pendente',
    APROVADO_AUTOMATICO: 'AprovadoAutomatico',
    APROVADO_DIRECAO: 'AprovadoDirecao',
    REJEITADO_DIRECAO: 'RejeitadoDirecao'
};

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const aulaCabeNaDisponibilidadeProfessor = (aula, disponibilidades = []) => {
    const inicioAula = new Date(aula.HoraInicio).getTime();
    const fimAula = new Date(aula.HoraFim).getTime();

    return disponibilidades.some((disponibilidade) => {
        const inicioDisponivel = new Date(disponibilidade.HoraInicio).getTime();
        const fimDisponivel = new Date(disponibilidade.HoraFim).getTime();
        return inicioAula >= inicioDisponivel && fimAula <= fimDisponivel;
    });
};

const ConsultarVagas = async () => {
    return await classRepo.GetAulasDisponiveis();
};

const GetPreco = async (idAula) => {
    const aula = await bookingRepo.findAulaWithMarcacoes(idAula);
    if (!aula) throw criarErro('Aula nao encontrada.', 404);
    return aula.Preco;
};

const listarAlunosDoEncarregado = async (idEncarregado) => {
    if (!idEncarregado) throw criarErro('IdEncarregado e obrigatorio.', 400);

    const relations = await bookingRepo.findStudentsByGuardian(idEncarregado);

    return relations.map((relation) => ({
        IdAluno: relation.IdAluno,
        Nome: relation.Aluno?.Utilizador?.NomeCompleto || 'Aluno',
        RelacaoParental: relation.RelacaoParental
    }));
};

const validarAlunoDoEncarregado = async (idEncarregado, idAluno) => {
    const alunos = await listarAlunosDoEncarregado(idEncarregado);
    const aluno = alunos.find((item) => item.IdAluno === idAluno);

    if (!aluno) {
        throw criarErro('O aluno selecionado nao esta associado a este encarregado.', 403);
    }

    return aluno;
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

    const disponibilidadesProfessor = await classRepo.findProfessorAvailabilityByDate(aula.IdProfessor, aula.Data);

    if (!aulaCabeNaDisponibilidadeProfessor(aula, disponibilidadesProfessor)) {
        throw criarErro('O professor nao tem disponibilidade registada para este horario.', 400);
    }

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

const FazerMarcacaoComoEncarregado = async (idAula, idAluno, idEncarregado) => {
    await validarAlunoDoEncarregado(idEncarregado, idAluno);
    return await FazerMarcacao(idAula, idAluno);
};

const isPrazoValido = (dataAulaCompleta) => {
    const agora = new Date();
    const diferencaMs = dataAulaCompleta - agora;
    const diferencaHoras = diferencaMs / (1000 * 60 * 60);
    return diferencaHoras >= 24;
};

const ProcessarCancelamento = async (idMarcacao, aprovadoAutomaticamente, motivo) => {
    if (aprovadoAutomaticamente) {
        const marcacao = await bookingRepo.cancelar(idMarcacao, motivo || 'Cancelamento antecipado (>= 24h)');
        return {
            sucesso: true,
            mensagem: 'Cancelamento aprovado automaticamente.',
            marcacao
        };
    }

    const marcacao = await bookingRepo.RegistarPedidoCancelamento(idMarcacao, motivo || 'Pedido de cancelamento com menos de 24h.');
    return {
        sucesso: false,
        mensagem: 'Prazo de 24h expirou. O pedido foi enviado para aprovacao da Direcao.',
        marcacao
    };
};

const construirDataAulaCompleta = (marcacao) => {
    const dataAulaCompleta = new Date(marcacao.Aula.Data);
    dataAulaCompleta.setHours(
        marcacao.Aula.HoraInicio.getHours(),
        marcacao.Aula.HoraInicio.getMinutes(),
        0,
        0
    );
    return dataAulaCompleta;
};

const CancelarMarcacao = async (idMarcacao, idAluno, motivo) => {
    if (!idMarcacao || !idAluno) {
        throw criarErro('IdMarcacao e IdAluno sao obrigatorios.', 400);
    }

    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);

    if (!marcacao) throw criarErro('Marcacao nao encontrada.', 404);
    if (marcacao.IdAluno !== idAluno) throw criarErro('Nao tens permissao para cancelar esta marcacao.', 403);
    if (!marcacao.EstaAtivo) throw criarErro('Esta marcacao ja esta cancelada.', 400);
    if (marcacao.EstadoCancelamento === ESTADOS_CANCELAMENTO.PENDENTE) {
        throw criarErro('Ja existe um pedido de cancelamento pendente para esta marcacao.', 400);
    }

    const dataAulaCompleta = construirDataAulaCompleta(marcacao);
    return await ProcessarCancelamento(idMarcacao, isPrazoValido(dataAulaCompleta), motivo);
};

const CancelarMarcacaoComoEncarregado = async (idMarcacao, idEncarregado, motivo) => {
    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);
    if (!marcacao) throw criarErro('Marcacao nao encontrada.', 404);

    await validarAlunoDoEncarregado(idEncarregado, marcacao.IdAluno);
    return await CancelarMarcacao(idMarcacao, marcacao.IdAluno, motivo);
};

const aprovarPedidoCancelamento = async (idMarcacao, idDiretor, observacao) => {
    if (!idMarcacao || !idDiretor) {
        throw criarErro('IdMarcacao e IdDiretor sao obrigatorios.', 400);
    }

    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);

    if (!marcacao) throw criarErro('Marcacao nao encontrada.', 404);
    if (marcacao.EstadoCancelamento !== ESTADOS_CANCELAMENTO.PENDENTE) {
        throw criarErro('Esta marcacao nao tem um pedido de cancelamento pendente.', 400);
    }

    const marcacaoAtualizada = await bookingRepo.aprovarPedidoCancelamento(idMarcacao, idDiretor, observacao);

    return {
        mensagem: 'Pedido de cancelamento aprovado pela Direcao.',
        marcacao: marcacaoAtualizada
    };
};

const rejeitarPedidoCancelamento = async (idMarcacao, idDiretor, observacao) => {
    if (!idMarcacao || !idDiretor) {
        throw criarErro('IdMarcacao e IdDiretor sao obrigatorios.', 400);
    }

    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);

    if (!marcacao) throw criarErro('Marcacao nao encontrada.', 404);
    if (marcacao.EstadoCancelamento !== ESTADOS_CANCELAMENTO.PENDENTE) {
        throw criarErro('Esta marcacao nao tem um pedido de cancelamento pendente.', 400);
    }

    const marcacaoAtualizada = await bookingRepo.rejeitarPedidoCancelamento(idMarcacao, idDiretor, observacao);

    return {
        mensagem: 'Pedido de cancelamento rejeitado pela Direcao.',
        marcacao: marcacaoAtualizada
    };
};

const listarMarcacoes = async () => {
    return await bookingRepo.findAll();
};

const listarMarcacoesDoAluno = async (idAluno) => {
    if (!idAluno) throw criarErro('IdAluno e obrigatorio.', 400);
    return await bookingRepo.findByAluno(idAluno);
};

const listarMarcacoesDoEncarregado = async (idEncarregado, idAluno) => {
    await validarAlunoDoEncarregado(idEncarregado, idAluno);
    return await listarMarcacoesDoAluno(idAluno);
};

const listarPedidosCancelamentoPendentes = async () => {
    return await bookingRepo.findPendingCancellationRequests();
};

module.exports = {
    ESTADOS_CANCELAMENTO,
    ConsultarVagas,
    GetPreco,
    FazerMarcacao,
    FazerMarcacaoComoEncarregado,
    isPrazoValido,
    ProcessarCancelamento,
    CancelarMarcacao,
    CancelarMarcacaoComoEncarregado,
    aprovarPedidoCancelamento,
    rejeitarPedidoCancelamento,
    criarMarcacao: FazerMarcacao,
    cancelarMarcacao: CancelarMarcacao,
    listarMarcacoes,
    listarMarcacoesDoAluno,
    listarMarcacoesDoEncarregado,
    listarAlunosDoEncarregado,
    listarPedidosCancelamentoPendentes
};
