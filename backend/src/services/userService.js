const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');
const PERMISSOES = require('../config/permissoes');

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
    return await userRepo.findAll();
};


const criarUtilizador = async (dados) => {
    const obrigatorios = [
        'NomeCompleto',
        'NomeUtilizador',
        'Email',
        'PalavraPasseHash',
        'Permissoes',
        'Morada',
        'CodigoPostal'
    ];

    const emFalta = obrigatorios.filter((campo) => {
        const valor = dados[campo];
        return valor === undefined || valor === null || valor === '';
    });

    if (emFalta.length > 0) {
        throw criarErro(`Campos obrigatórios em falta: ${emFalta.join(', ')}`, 400);
    }

    const permissoesValidas = Object.values(PERMISSOES);
    if (!permissoesValidas.includes(dados.Permissoes)) {
        throw criarErro(`Permissão inválida. Valores aceites: ${permissoesValidas.join(', ')}`, 400);
    }

    if (dados.Permissoes === PERMISSOES.ALUNO && !dados.DataNascimento) {
        throw criarErro('DataNascimento é obrigatória para Alunos.', 400);
    }

    if (dados.Permissoes === PERMISSOES.PROFESSOR && !dados.Iban) {
        throw criarErro('IBAN é obrigatório para Professores.', 400);
    }

    const hash = hashPassword(dados.PalavraPasseHash);

    return await userRepo.create({ ...dados, PalavraPasseHash: hash });
};


const autenticarUtilizador = async (email, palavraPasse) => {
    if (!email || !palavraPasse) {
        throw criarErro('Email e palavra-passe são obrigatórios.', 400);
    }

    const utilizador = await userRepo.findByEmail(email);

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
    autenticarUtilizador
};