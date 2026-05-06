const masterRepo = require('../repositories/masterRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const listarEstudios = async () => {
    const estudios = await masterRepo.findAllEstudios();
    if (!estudios) {
        throw criarErro('Nao foi possivel aceder aos estudios.', 404);
    }
    return estudios;
};

const listarEstilos = async () => {
    const estilos = await masterRepo.findAllEstilos();
    if (!estilos) {
        throw criarErro('Nao foi possivel aceder aos estilos de danca.', 404);
    }
    return estilos;
};

const listarProfessores = async () => {
    const professores = await masterRepo.findAllProfessores();
    if (!professores) {
        throw criarErro('Nao foi possivel aceder aos professores.', 404);
    }
    return professores;
};

const listarGeografia = async () => {
    const paises = await masterRepo.findAllPaises();
    const distritos = await masterRepo.findAllDistritos();

    if (!paises || !distritos) {
        throw criarErro('Nao foi possivel carregar os dados geograficos.', 404);
    }

    return {
        paises,
        distritos
    };
};

module.exports = {
    listarEstudios,
    listarEstilos,
    listarProfessores,
    listarGeografia
};
