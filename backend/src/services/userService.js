const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const PERMISSOES = require('../config/permissions');

const JWT_SECRET = process.env.JWT_SECRET || 'ChaveSuperSecretaDaEntArtes_2026';

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

const listarUtilizadores = async () => {
    const utilizadores = await userRepository.findAll();
    return utilizadores.map((utilizador) => {
        const { PalavraPasseHash: _, ...dadosSeguros } = utilizador;
        return dadosSeguros;
    });
};

const validarPermissaoGerivel = (permissao) => {
    const permissoesGeriveis = [
        PERMISSOES.PROFESSOR,
        PERMISSOES.ENCARREGADO,
        PERMISSOES.DIRECAO
    ];

    if (!permissoesGeriveis.includes(permissao)) {
        throw criarErro('So e permitido gerir Encarregados, Professores e Direcao.', 400);
    }
};

const validarCamposBase = (dados) => {
    if (!dados.NomeCompleto) {
        throw criarErro('NomeCompleto é obrigatório.', 400);
    }

    if (!dados.Email) {
        throw criarErro('Email é obrigatório.', 400);
    }

    if (!dados.NomeUtilizador) {
        throw criarErro('NomeUtilizador é obrigatório.', 400);
    }

    if (!dados.CodigoPostal) {
        throw criarErro('CodigoPostal é obrigatório.', 400);
    }

    if (!dados.Morada) {
        throw criarErro('Morada é obrigatória.', 400);
    }

    if (!dados.Nif) {
        throw criarErro('NIF é obrigatório.', 400);
    }
};

const extrairCampoUnico = (erro) => {
    const target = erro?.meta?.target;

    if (Array.isArray(target) && target.length > 0) {
        return String(target[0]);
    }

    const rawText = String(target || erro?.message || '');

    if (rawText.includes('NomeUtilizador')) return 'NomeUtilizador';
    if (rawText.includes('Email')) return 'Email';
    if (rawText.includes('Nif')) return 'Nif';

    return '';
};

const traduzirErroRepositorio = (erro) => {
    if (erro?.code === 'P2002' || String(erro?.message || '').includes('Unique constraint failed')) {
        const campo = extrairCampoUnico(erro);

        if (campo === 'NomeUtilizador') {
            throw criarErro('Ja existe um utilizador com esse nome de utilizador.', 400);
        }

        if (campo === 'Email') {
            throw criarErro('Ja existe um utilizador com esse email.', 400);
        }

        if (campo === 'Nif') {
            throw criarErro('Ja existe um utilizador com esse NIF.', 400);
        }

        throw criarErro('Ja existe um utilizador com um dos dados inseridos.', 400);
    }

    if (erro?.code === 'P2025') {
        throw criarErro('Codigo postal invalido.', 400);
    }

    throw erro;
};

const criarUtilizador = async (dados) => {
    validarCamposBase(dados);

    const permissoesValidas = Object.values(PERMISSOES);
    if (dados.Permissoes === undefined || dados.Permissoes === null || !permissoesValidas.includes(dados.Permissoes)) {
        throw criarErro('Nível de permissão inválido.', 400);
    }

    if (dados.Permissoes === PERMISSOES.ALUNO && !dados.DataNascimento) {
        throw criarErro('Data de Nascimento é obrigatória para alunos.', 400);
    }

    if (dados.Permissoes === PERMISSOES.PROFESSOR && !dados.Iban) {
        throw criarErro('IBAN é obrigatório para professores.', 400);
    }

    const plainPassword = dados.PalavraPasse || dados.PalavraPasseHash || '';
    if (!plainPassword) {
        throw criarErro('PalavraPasse é obrigatória.', 400);
    }

    const hash = hashPassword(plainPassword);
    let utilizador;

    try {
        utilizador = await userRepository.create({ ...dados, PalavraPasseHash: hash });
    } catch (erro) {
        traduzirErroRepositorio(erro);
    }

    const { PalavraPasseHash: _, ...dadosSeguros } = utilizador;
    return dadosSeguros;
};

const atualizarUtilizador = async (idUtilizador, dados) => {
    if (!idUtilizador) {
        throw criarErro('IdUtilizador é obrigatório.', 400);
    }

    validarCamposBase(dados);

    const utilizadorAtual = await userRepository.findById(idUtilizador);
    if (!utilizadorAtual) {
        throw criarErro('Utilizador não encontrado.', 404);
    }

    validarPermissaoGerivel(utilizadorAtual.Permissoes);

    if (utilizadorAtual.Permissoes === PERMISSOES.PROFESSOR && !dados.Iban) {
        throw criarErro('IBAN é obrigatório para professores.', 400);
    }

    const plainPassword = dados.PalavraPasse || '';
    const hash = plainPassword ? hashPassword(plainPassword) : undefined;

    let utilizador;

    try {
        utilizador = await userRepository.update(idUtilizador, {
            ...dados,
            Permissoes: utilizadorAtual.Permissoes,
            PalavraPasseHash: hash
        });
    } catch (erro) {
        traduzirErroRepositorio(erro);
    }

    const { PalavraPasseHash: _, ...dadosSeguros } = utilizador;
    return dadosSeguros;
};

const atualizarEstadoUtilizador = async (idUtilizador, estaAtivo) => {
    if (!idUtilizador) {
        throw criarErro('IdUtilizador é obrigatório.', 400);
    }

    const utilizadorAtual = await userRepository.findById(idUtilizador);
    if (!utilizadorAtual) {
        throw criarErro('Utilizador não encontrado.', 404);
    }

    validarPermissaoGerivel(utilizadorAtual.Permissoes);

    const utilizador = await userRepository.updateStatus(idUtilizador, Boolean(estaAtivo));
    const { PalavraPasseHash: _, ...dadosSeguros } = utilizador;
    return dadosSeguros;
};

const autenticarUtilizador = async (email, palavraPasse) => {
    if (!email || !palavraPasse) {
        throw criarErro('Email e palavra-passe são obrigatórios.', 400);
    }

    const utilizador = await userRepository.findByEmail(email);

    if (!utilizador) {
        throw criarErro('Credenciais inválidas.', 401);
    }

    if (!utilizador.EstaAtivo) {
        throw criarErro('Conta desativada. Contacte a direção.', 403);
    }

    const hashDaEntrada = hashPassword(palavraPasse);

    if (hashDaEntrada !== utilizador.PalavraPasseHash) {
        throw criarErro('Credenciais inválidas.', 401);
    }

    const token = jwt.sign(
        {
            IdUtilizador: utilizador.IdUtilizador,
            Permissoes: utilizador.Permissoes
        },
        JWT_SECRET,
        { expiresIn: '8h' }
    );

    const { PalavraPasseHash: _, ...dadosSeguros } = utilizador;

    return {
        mensagem: 'Login efetuado com sucesso!',
        token,
        utilizador: dadosSeguros
    };
};

module.exports = {
    listarUtilizadores,
    criarUtilizador,
    atualizarUtilizador,
    atualizarEstadoUtilizador,
    autenticarUtilizador
};
