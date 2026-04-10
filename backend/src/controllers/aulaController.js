const aulaRepo = require('../repositories/aulaRepository');

const getAulas = async (req, res) => {
    try {
        const aulas = await aulaRepo.findAll();
        res.json(aulas);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao carregar as aulas." });
    }
};

const criarAula = async (req, res) => {
    try {
        const dados = req.body;

        // 1. Validar sobreposição usando o Repository
        const aulasNoDia = await aulaRepo.findOverlapping(dados.IdEstudio, dados.Data);

        const novaHoraInicio = new Date(dados.HoraInicio).getTime();
        const novaHoraFim = new Date(dados.HoraFim).getTime();

        const aulaSobreposta = aulasNoDia.find(aulaExistente => {
            const existenteInicio = new Date(aulaExistente.HoraInicio).getTime();
            const existenteFim = new Date(aulaExistente.HoraFim).getTime();
            return (novaHoraInicio < existenteFim && novaHoraFim > existenteInicio);
        });

        if (aulaSobreposta) {
            return res.status(400).json({ erro: "Conflito de horário! Estúdio ocupado." });
        }

        // 2. Mandar criar
        const novaAula = await aulaRepo.create(dados);
        res.status(201).json({ mensagem: "Aula agendada!", aula: novaAula });

    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Não foi possível agendar a aula." });
    }
};

module.exports = { getAulas, criarAula };