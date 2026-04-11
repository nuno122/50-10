const utilizadorRepo = require('../repositories/utilizadorRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const listarUtilizadores = async () => {
    return await utilizadorRepo.findAll();
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
        throw criarErro(`Campos obrigatorios em falta: ${emFalta.join(', ')}`, 400);
    }

    return await utilizadorRepo.create(dados);
};

const autenticarUtilizador = async (email, palavraPasseHash) => {
    if (!email || !palavraPasseHash) {
        throw criarErro('Email e PalavraPasseHash sao obrigatorios.', 400);
    }

    const utilizador = await utilizadorRepo.findByEmail(email);

    if (!utilizador) {
        throw criarErro('Utilizador nao encontrado.', 401);
    }

    if (utilizador.PalavraPasseHash !== palavraPasseHash) {
        throw criarErro('Palavra-passe incorreta.', 401);
    }

    const { PalavraPasseHash: _, ...dadosSeguros } = utilizador;

    return {
        mensagem: 'Login efetuado com sucesso!',
        utilizador: dadosSeguros
    };
};

module.exports = {
    listarUtilizadores,
    criarUtilizador,
    autenticarUtilizador
};
