/**
 * Manual mock for backend/src/database/sqlServer
 * Prevents real SQL Server connections during unit tests.
 */
const query = jest.fn().mockResolvedValue([]);

module.exports = { query };
