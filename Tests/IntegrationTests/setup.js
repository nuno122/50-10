const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3000/api';

const makeRequest = async (endpoint, method = 'GET', body = null, token = null) => {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const options = {
        method,
        headers,
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    
    if (response.status === 204) return { status: 204, data: null };
    
    let data;
    try {
        data = await response.json();
    } catch (e) {
        data = await response.text();
    }
    
    return { status: response.status, data };
};

const getAdminToken = () => {
    return jwt.sign(
        { IdUtilizador: 9999, Permissoes: 3, Email: 'admin@integration.test' },
        "ChaveSuperSecretaDaEntArtes_2026",
        { expiresIn: '1h' }
    );
};

module.exports = {
    makeRequest,
    getAdminToken,
    BASE_URL
};
