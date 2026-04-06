1. ⚙️ backend/ 
Esta é a "cozinha" da tua escola de dança. Não tem gráficos, apenas processa regras e fala com o SQL Server.

prisma/schema.prisma: O mapa da base de dados. É aqui que estão definidas as tuas tabelas de Professores, Alunos, Aulas, etc.

src/controllers/: Os gestores. Recebem um pedido (ex: "Quero ver as vagas"), processam a resposta e enviam os dados de volta.

src/middlewares/: Os seguranças. Ficheiros aqui vão verificar coisas como "Este utilizador tem o login feito?" antes de o deixarem ver os dados.

src/repositories/: Os especialistas do Prisma. É aqui que colocas o código que vai diretamente ler e escrever no SQL Server.

src/routes/: As portas de entrada. Definem os URLs da tua API (ex: /api/inventario).

src/services/: A lógica de negócio pesada. É aqui que vais colocar as regras complexas (ex: verificar se faltam menos de 24h para cancelar a aula).

database.js: O ficheiro que liga o Prisma para ser usado no resto do backend.

index.js: O interruptor principal que liga o teu servidor Express.



2. 🎨 frontend/ 
Esta é a "montra" (o que a Direção, Professores e Alunos vão ver e clicar).

src/components/: Peças de Lego reutilizáveis. Se desenhaste um botão bonito ou um cartão de um figurino no Figma que vais usar em várias páginas, crias o código dele aqui.

src/hooks/: Ferramentas lógicas do React. Servem para criar funções complexas que controlam o estado dos teus ecrãs (ex: um gancho para gerir o modo claro/escuro).

src/screens/ (ou Pages): Os ecrãs inteiros da tua aplicação. Vai ser aqui que vais ter os ficheiros Login.jsx, Dashboard.jsx, ConsultarVagas.jsx, etc.

src/services/: Os mensageiros. É aqui que vais escrever as funções que fazem os pedidos HTTP ao teu backend (ao teu Express) para ir buscar os dados.

src/utils/: Ferramentas auxiliares. Ficheiros com funções úteis, como formatar uma data para "DD/MM/AAAA" ou formatar um número para Euros (€).



3. 🖥️ electron/ 
main.js: O único trabalho deste ficheiro é abrir uma janela nativa do Windows/macOS e carregar o teu frontend lá para dentro, fazendo com que o teu site React funcione como um programa de computador instalável (.exe).



