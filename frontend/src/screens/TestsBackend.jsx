// frontend/src/screens/TestesBackend.jsx
import React, { useState } from 'react';
import { testarUtilizadores } from '../services/api';

const TestesBackend = () => {
    const [resultado, setResultado] = useState(null);
    const [erro, setErro] = useState(null);
    const [aCarregar, setACarregar] = useState(false);

    const executarTeste = async () => {
        setACarregar(true);
        setErro(null);
        setResultado(null);
        
        try {
            const dados = await testarUtilizadores();
            setResultado(dados);
        } catch (err) {
            setErro(err.message);
        } finally {
            setACarregar(false);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h2>Área de Testes do Backend</h2>
            
            <button 
                onClick={executarTeste} 
                disabled={aCarregar}
                style={{ padding: '10px 20px', cursor: 'pointer', marginBottom: '20px' }}
            >
                {aCarregar ? 'A testar...' : 'Testar Controladores de Utilizadores'}
            </button>

            <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
                <h3>Resposta do Servidor:</h3>
                
                {erro && (
                    <div style={{ color: 'red', fontWeight: 'bold' }}>
                        Erro: {erro}
                    </div>
                )}
                
                {resultado && (
                    <pre style={{ 
                        backgroundColor: '#f4f4f4', 
                        padding: '10px', 
                        overflowX: 'auto',
                        borderRadius: '4px'
                    }}>
                        {JSON.stringify(resultado, null, 2)}
                    </pre>
                )}
                
                {!resultado && !erro && !aCarregar && (
                    <p style={{ color: '#666' }}>Clica no botão para iniciar o teste.</p>
                )}
            </div>
        </div>
    );
};

export default TestesBackend;