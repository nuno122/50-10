const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('Conexão OK:', result);
  } catch (err) {
    console.error('Erro de conexão:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();