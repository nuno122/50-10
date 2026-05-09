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

const ConsultarVagas = async () => {
    return await classRepo.GetAulasDisponiveis();
};

const GetPreco = async (idAula) => {
    const aula = await bookingRepo.findAulaWithMarcacoes(idAula);
    if (!aula) throw criarErro('Aula não encontrada.', 404);
    return aula.Preco;
};

const listarAlunosDoEncarregado = async (idEncarregado) => {
    if (!idEncarregado) throw criarErro('IdEncarregado é obrigatório.', 400);

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
        throw criarErro('O aluno selecionado não está associado a este encarregado.', 403);
    }

    return aluno;
};

const FazerMarcacao = async (idAula, idAluno) => {
    if (!idAluno || !idAula) {
        throw criarErro('IdAluno e IdAula são obrigatórios.', 400);
    }

    const aluno = await bookingRepo.findAlunoById(idAluno);
    if (!aluno) throw criarErro('Aluno não encontrado.', 404);

    const aula = await bookingRepo.findAulaWithMarcacoes(idAula);
    if (!aula) throw criarErro('Aula não encontrada.', 404);

    if (!aula.EstaAtivo) throw criarErro('Esta aula foi cancelada.', 400);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (new Date(aula.Data) < hoje) {
        throw criarErro('Não pode marcar aulas passadas.', 400);
    }

    const inscritosAtivos = aula.Marcacao.filter((marcacao) => marcacao.EstaAtivo).length;
    if (inscritosAtivos >= aula.CapacidadeMaxima) {
        throw criarErro('Aula lotada.', 400);
    }

    const jaInscrito = await bookingRepo.findExisting(idAluno, idAula);
    if (jaInscrito) throw criarErro('Já estás inscrito nesta aula.', 400);

    const novaMarcacao = await bookingRepo.create(idAluno, idAula);

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
        mensagem: 'O prazo de 24 horas expirou. O pedido foi enviado para aprovação da Direção.',
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
        throw criarErro('IdMarcacao e IdAluno são obrigatórios.', 400);
    }

    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);

    if (!marcacao) throw criarErro('Marcação não encontrada.', 404);
    if (marcacao.IdAluno !== idAluno) throw criarErro('Não tem permissão para cancelar esta marcação.', 403);
    if (!marcacao.EstaAtivo) throw criarErro('Esta marcação já está cancelada.', 400);
    if (marcacao.EstadoCancelamento === ESTADOS_CANCELAMENTO.PENDENTE) {
        throw criarErro('Já existe um pedido de cancelamento pendente para esta marcação.', 400);
    }

    const dataAulaCompleta = construirDataAulaCompleta(marcacao);
    return await ProcessarCancelamento(idMarcacao, isPrazoValido(dataAulaCompleta), motivo);
};

const CancelarMarcacaoComoEncarregado = async (idMarcacao, idEncarregado, motivo) => {
    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);
    if (!marcacao) throw criarErro('Marcação não encontrada.', 404);

    await validarAlunoDoEncarregado(idEncarregado, marcacao.IdAluno);
    return await CancelarMarcacao(idMarcacao, marcacao.IdAluno, motivo);
};

const aprovarPedidoCancelamento = async (idMarcacao, idDiretor, observacao) => {
    if (!idMarcacao || !idDiretor) {
        throw criarErro('IdMarcacao e IdDiretor são obrigatórios.', 400);
    }

    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);

    if (!marcacao) throw criarErro('Marcação não encontrada.', 404);
    if (marcacao.EstadoCancelamento !== ESTADOS_CANCELAMENTO.PENDENTE) {
        throw criarErro('Esta marcação não tem um pedido de cancelamento pendente.', 400);
    }

    const marcacaoAtualizada = await bookingRepo.aprovarPedidoCancelamento(idMarcacao, idDiretor, observacao);

    return {
        mensagem: 'Pedido de cancelamento aprovado pela Direção.',
        marcacao: marcacaoAtualizada
    };
};

const rejeitarPedidoCancelamento = async (idMarcacao, idDiretor, observacao) => {
    if (!idMarcacao || !idDiretor) {
        throw criarErro('IdMarcacao e IdDiretor são obrigatórios.', 400);
    }

    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);

    if (!marcacao) throw criarErro('Marcação não encontrada.', 404);
    if (marcacao.EstadoCancelamento !== ESTADOS_CANCELAMENTO.PENDENTE) {
        throw criarErro('Esta marcação não tem um pedido de cancelamento pendente.', 400);
    }

    const marcacaoAtualizada = await bookingRepo.rejeitarPedidoCancelamento(idMarcacao, idDiretor, observacao);

    return {
        mensagem: 'Pedido de cancelamento rejeitado pela Direção.',
        marcacao: marcacaoAtualizada
    };
};

const listarMarcacoes = async () => {
    return await bookingRepo.findAll();
};

const listarMarcacoesDoAluno = async (idAluno) => {
    if (!idAluno) throw criarErro('IdAluno é obrigatório.', 400);
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
    listarMarcacoes,
    listarMarcacoesDoAluno,
    listarMarcacoesDoEncarregado,
    listarAlunosDoEncarregado,
    listarPedidosCancelamentoPendentes,
    criarMarcacao: FazerMarcacao,
    criarMarcacaoEncarregado: FazerMarcacaoComoEncarregado,
    cancelarMarcacao: CancelarMarcacao,
    cancelarMarcacaoEncarregado: CancelarMarcacaoComoEncarregado
};
