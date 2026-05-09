/** @type {import('jest').Config} */
const config = {
    roots: ['<rootDir>/tests/integration'],
    modulePaths: ['<rootDir>/node_modules'],
    testEnvironment: 'node',
    verbose: true,
    testTimeout: 15000
};

module.exports = config;
