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
};

const criarUtilizador = async (dados) => {
    // Validate each mandatory field individually with exact messages the tests expect
    if (!dados.NomeCompleto) {
        throw criarErro('NomeCompleto \u00e9 obrigat\u00f3rio.', 400);
    }

    if (!dados.Email) {
        throw criarErro('Email \u00e9 obrigat\u00f3rio.', 400);
    }

    const permissoesValidas = Object.values(PERMISSOES);
    if (dados.Permissoes === undefined || dados.Permissoes === null || !permissoesValidas.includes(dados.Permissoes)) {
        throw criarErro('N\u00edvel de permiss\u00e3o inv\u00e1lido.', 400);
    }

    if (dados.Permissoes === PERMISSOES.ALUNO && !dados.DataNascimento) {
        throw criarErro('Data de Nascimento \u00e9 obrigat\u00f3ria para alunos.', 400);
    }

    if (dados.Permissoes === PERMISSOES.PROFESSOR && !dados.Iban) {
        throw criarErro('IBAN \u00e9 obrigat\u00f3rio para professores.', 400);
    }

    // Hash the plain-text password (PalavraPasse field) if provided
    const plainPassword = dados.PalavraPasse || dados.PalavraPasseHash || '';
    if (!plainPassword) {
        throw criarErro('PalavraPasse é obrigatória.', 400);
    }
    const hash = hashPassword(plainPassword);

    const utilizador = await userRepository.create({ ...dados, PalavraPasseHash: hash });
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

    const utilizador = await userRepository.update(idUtilizador, {
        ...dados,
        Permissoes: utilizadorAtual.Permissoes,
        PalavraPasseHash: hash
    });

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
        throw criarErro('Email e palavra-passe s\u00e3o obrigat\u00f3rios.', 400);
    }

    const utilizador = await userRepository.findByEmail(email);

    if (!utilizador) {
        throw criarErro('Credenciais inv\u00e1lidas.', 401);
    }

    if (!utilizador.EstaAtivo) {
        throw criarErro('Conta desativada. Contacte a dire\u00e7\u00e3o.', 403);
    }

    const hashDaEntrada = hashPassword(palavraPasse);

    if (hashDaEntrada !== utilizador.PalavraPasseHash) {
        throw criarErro('Credenciais inv\u00e1lidas.', 401);
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
