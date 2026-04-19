const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Criar artigo
  const artigo = await prisma.artigo.create({
    data: {
      Nome: 'Saia de Dança Teste',
      CustoPorDia: 15.00
    }
  });
  console.log('Artigo criado:', artigo.IdArtigo);

  // Aguardar 1s (artigo precisa ID para tamanho)
  await new Promise(r => setTimeout(r, 1000));

  // Criar tamanho artigo
  const tamanho = await prisma.tamanhoArtigo.create({
    data: {
      IdArtigo: artigo.IdArtigo,
      Tamanho: 'M',
      Quantidade: 5
    }
  });
  console.log('Tamanho criado:', tamanho.IdTamanhoArtigo);

  console.log('✅ Seed concluído! GET /api/inventario para ver.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

