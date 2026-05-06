const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const findAllEstudios = async () => {
    return await prisma.estudio.findMany({
        include: {
            EstudioEstilo: {
                include: {
                    EstiloDanca: true
                }
            }
        }
    });
};

const findAllEstilos = async () => {
    return await prisma.estiloDanca.findMany();
};

const findAllProfessores = async () => {
    return await prisma.professor.findMany({
        include: {
            Utilizador: {
                select: {
                    IdUtilizador: true,
                    NomeCompleto: true,
                    Email: true,
                    EstaAtivo: true
                }
            },
            EstiloProfessor: {
                include: {
                    EstiloDanca: true
                }
            }
        }
    });
};

const findAllPaises = async () => {
    return await prisma.pais.findMany();
};

const findAllDistritos = async () => {
    return await prisma.distrito.findMany({
        include: { Cidade: true } 
    });
};

module.exports = {
    findAllEstudios,
    findAllEstilos,
    findAllProfessores,
    findAllPaises,
    findAllDistritos
};
