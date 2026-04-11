const masterRepo = require('../repositories/masterRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const listarEstudios = async () => {
    const estudios = await masterRepo.findAllEstudios();
    if (!estudios) {
        throw criarErro('Não foi possível aceder aos estúdios.', 404);
    }
    return estudios;
};

const listarEstilos = async () => {
    const estilos = await masterRepo.findAllEstilos();
    if (!estilos) {
        throw criarErro('Não foi possível aceder aos estilos de dança.', 404);
    }
    return estilos;
};

const listarGeografia = async () => {
    const paises = await masterRepo.findAllPaises();
    const distritos = await masterRepo.findAllDistritos();
    
    if (!paises || !distritos) {
        throw criarErro('Não foi possível carregar os dados geográficos.', 404);
    }
    
    return {
        paises: paises,
        distritos: distritos
    };
};

module.exports = {
    listarEstudios,
    listarEstilos,
    listarGeografia
};