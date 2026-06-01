const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const prisma = globalForPrisma.__entartesPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__entartesPrisma = prisma;
}

module.exports = prisma;
