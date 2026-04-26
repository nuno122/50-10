/** @type {import('jest').Config} */
const config = {
    // Run tests from the saved Tests folder (relative to this config file in backend/)
    roots: ['<rootDir>/../Tests/Unit Testing'],

    // Tell Jest to resolve node_modules from the backend directory
    // This fixes "Cannot find module 'jsonwebtoken'" when tests live outside backend/
    modulePaths: ['<rootDir>/node_modules'],

    // Module name mapper: redirect @prisma/client to our manual mock
    // so repositories can be imported without a live Prisma client.
    // Also redirect sqlServer to prevent real connection attempts.
    moduleNameMapper: {
        '^@prisma/client$': '<rootDir>/__mocks__/@prisma/client.js',
        '^.*[/\\\\]database[/\\\\]sqlServer(\\.js)?$': '<rootDir>/__mocks__/sqlServer.js'
    },

    // Test environment
    testEnvironment: 'node',

    // Verbose output
    verbose: true
};

module.exports = config;
