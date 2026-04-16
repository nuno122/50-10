const disponibilidadeRepo = require('../repositories/disponibilidadeRepository');
const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const criarDisponibilidade = async (idProfessor, data, horaInicio, horaFim) => {
    if (!idProfessor || !data || !horaInicio || !horaFim) {
        throw criarErro('Todos os campos são obrigatórios', 400);
    }

    return await disponibilidadeRepo.criar({
        IdProfessor: idProfessor,
        Data: data,
        HoraInicio: horaInicio,
        HoraFim: horaFim
    });
};

const listarMinhas = async (idProfessor) => {
    return await disponibilidadeRepo.listarPorProfessor(idProfessor);
};

module.exports = {
    criarDisponibilidade,
    listarMinhas
};

