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

const hashPassword = (password) => crypto.createHash('sha256').update(password).digest('hex');

const permissoesDePortalAtivas = [
    PERMISSOES.PROFESSOR,
    PERMISSOES.ENCARREGADO,
    PERMISSOES.DIRECAO
];

const listarUtilizadores = async () => {
    const utilizadores = await userRepository.findAll();
    return utilizadores.map((utilizador) => {
        const { PalavraPasseHash: _, ...dadosSeguros } = utilizador;
        return dadosSeguros;
    });
};

const validarPermissaoGerivel = (permissao) => {
    if (!permissoesDePortalAtivas.includes(permissao)) {
        throw criarErro('So e permitido gerir Encarregados, Professores e Direcao.', 400);
    }
};

const validarCamposBase = (dados) => {
    if (!dados.NomeCompleto) {
        throw criarErro('NomeCompleto e obrigatorio.', 400);
    }

    if (!dados.Email) {
        throw criarErro('Email e obrigatorio.', 400);
    }

    if (!dados.NomeUtilizador) {
        throw criarErro('NomeUtilizador e obrigatorio.', 400);
    }

    if (!dados.CodigoPostal) {
        throw criarErro('CodigoPostal e obrigatorio.', 400);
    }

    if (!dados.Morada) {
        throw criarErro('Morada e obrigatoria.', 400);
    }

    if (!dados.Nif) {
        throw criarErro('NIF e obrigatorio.', 400);
    }
};

const normalizarIdsEstilo = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return [...new Set(
        value
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
    )];
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

    if (dados.Permissoes === undefined || dados.Permissoes === null || !permissoesDePortalAtivas.includes(dados.Permissoes)) {
        throw criarErro('So e permitido criar Encarregados, Professores e membros da Direcao.', 400);
    }

    if (dados.Permissoes === PERMISSOES.PROFESSOR && !dados.Iban) {
        throw criarErro('IBAN e obrigatorio para professores.', 400);
    }

    if (dados.Permissoes === PERMISSOES.PROFESSOR && normalizarIdsEstilo(dados.IdsEstiloDanca).length === 0) {
        throw criarErro('Define pelo menos um estilo para o professor.', 400);
    }

    const plainPassword = dados.PalavraPasse || dados.PalavraPasseHash || '';
    if (!plainPassword) {
        throw criarErro('PalavraPasse e obrigatoria.', 400);
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
        throw criarErro('IdUtilizador e obrigatorio.', 400);
    }

    validarCamposBase(dados);

    const utilizadorAtual = await userRepository.findById(idUtilizador);
    if (!utilizadorAtual) {
        throw criarErro('Utilizador nao encontrado.', 404);
    }

    validarPermissaoGerivel(utilizadorAtual.Permissoes);

    if (utilizadorAtual.Permissoes === PERMISSOES.PROFESSOR && !dados.Iban) {
        throw criarErro('IBAN e obrigatorio para professores.', 400);
    }

    if (utilizadorAtual.Permissoes === PERMISSOES.PROFESSOR && normalizarIdsEstilo(dados.IdsEstiloDanca).length === 0) {
        throw criarErro('Define pelo menos um estilo para o professor.', 400);
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
        throw criarErro('IdUtilizador e obrigatorio.', 400);
    }

    const utilizadorAtual = await userRepository.findById(idUtilizador);
    if (!utilizadorAtual) {
        throw criarErro('Utilizador nao encontrado.', 404);
    }

    validarPermissaoGerivel(utilizadorAtual.Permissoes);

    const utilizador = await userRepository.updateStatus(idUtilizador, Boolean(estaAtivo));
    const { PalavraPasseHash: _, ...dadosSeguros } = utilizador;
    return dadosSeguros;
};

const autenticarUtilizador = async (email, palavraPasse) => {
    if (!email || !palavraPasse) {
        throw criarErro('Email e palavra-passe sao obrigatorios.', 400);
    }

    const utilizador = await userRepository.findByEmail(email);

    if (!utilizador) {
        throw criarErro('Credenciais invalidas.', 401);
    }

    if (!utilizador.EstaAtivo) {
        throw criarErro('Conta desativada. Contacte a direcao.', 403);
    }

    if (!permissoesDePortalAtivas.includes(utilizador.Permissoes)) {
        throw criarErro('O perfil de Aluno ja nao esta disponivel no portal. Utilize a conta do Encarregado.', 403);
    }

    const hashDaEntrada = hashPassword(palavraPasse);

    if (hashDaEntrada !== utilizador.PalavraPasseHash) {
        throw criarErro('Credenciais invalidas.', 401);
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
