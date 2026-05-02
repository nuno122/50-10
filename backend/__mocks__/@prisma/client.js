/**
 * Manual mock for @prisma/client
 * Prevents "PrismaClient did not initialize yet" errors during unit tests.
 * All repositories are mocked at the service level in individual test files,
 * so this just needs to export a no-op PrismaClient constructor.
 */

const mockTables = {
    utilizador:     { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    aluno:          { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    professor:      { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    aula:           { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    disponibilidade:{ findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    marcacao:       { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    pagamento:      { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    artigo:         { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    tamanhoArtigo:  { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    aluguer:        { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    pedidoExtensao: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    estudio:        { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    estiloDanca:    { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() }
};

const PrismaClient = jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(async (arg) => {
        if (typeof arg === 'function') {
            return arg(mockTables);
        }

        if (Array.isArray(arg)) {
            return Promise.all(arg);
        }

        return arg;
    }),
    ...mockTables
}));

module.exports = { PrismaClient };
