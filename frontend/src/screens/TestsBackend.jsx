import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    criarAluguer,
    criarArtigo,
    criarAula,
    criarMarcacao,
    getAlugueres,
    getAulas,
    getInventario,
    getMarcacoes,
    getUtilizadores,
    getEstudios,
    getEstilos,
    getGeografia
} from '../services/api';

const panelStyle = {
    border: '1px solid #e6d6bf',
    backgroundColor: '#fffdf8',
    padding: '20px',
    borderRadius: '20px'
};

const codeStyle = {
    margin: 0,
    backgroundColor: '#f5efe5',
    color: '#35291d',
    padding: '16px',
    overflowX: 'auto',
    borderRadius: '14px',
    fontSize: '14px',
    lineHeight: 1.5,
    maxHeight: '280px'
};

const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #d8c3a5',
    backgroundColor: '#fffaf3'
};

const buttonStyle = {
    padding: '12px 18px',
    borderRadius: '999px',
    border: 'none',
    background: 'linear-gradient(135deg, #6f4e2c 0%, #b98543 100%)',
    color: '#fffaf2',
    fontWeight: 700,
    cursor: 'pointer'
};

const secondaryButtonStyle = {
    ...buttonStyle,
    background: '#efe2d0',
    color: '#4f3720'
};

const initialData = {
    utilizadores: null,
    inventario: null,
    criarArtigo: null,
    aulas: null,
    criarAula: null,
    marcacoes: null,
    criarMarcacao: null,
    alugueres: null,
    criarAluguer: null,
    estudios: null,
    estilos: null,
    geografia: null
};

const initialLoading = {
    utilizadores: false,
    inventario: false,
    criarArtigo: false,
    aulas: false,
    criarAula: false,
    marcacoes: false,
    criarMarcacao: false,
    alugueres: false,
    criarAluguer: false,
    estudios: false,
    estilos: false,
    geografia: false
};

const TestesBackend = () => {
    const [results, setResults] = useState(initialData);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(initialLoading);
    const [artigoForm, setArtigoForm] = useState({
        Nome: 'Saia de teste',
        CustoPorDia: '12.50'
    });
    const [aulaForm, setAulaForm] = useState({
        Data: '2026-12-31',
        HoraInicio: '2026-12-31T18:00:00.000Z',
        HoraFim: '2026-12-31T19:00:00.000Z',
        CapacidadeMaxima: '20',
        Preco: '15.00',
        IdProfessor: '',
        IdEstudio: '',
        IdEstiloDanca: ''
    });
    const [marcacaoForm, setMarcacaoForm] = useState({
        IdAluno: '48bd28c1-6030-f111-9a32-010101010000',
        IdAula: 'f116e3e6-4e31-f111-9a32-010101010000'
    });
    const [aluguerForm, setAluguerForm] = useState({
        IdUtilizador: '48bd28c1-6030-f111-9a32-010101010000',
        DataLevantamento: '2026-12-20',
        DataEntrega: '2026-12-22',
        ListaArtigosJson: '[\n  {\n    "IdTamanhoArtigo": "",\n    "Quantidade": 1\n  }\n]'
    });

    const runAction = async (key, action) => {
        setLoading((current) => ({ ...current, [key]: true }));
        setErrors((current) => ({ ...current, [key]: null }));

        try {
            const result = await action();
            setResults((current) => ({ ...current, [key]: result }));
        } catch (error) {
            setErrors((current) => ({ ...current, [key]: error.message }));
        } finally {
            setLoading((current) => ({ ...current, [key]: false }));
        }
    };

    const renderResult = (key, emptyMessage) => {
        if (errors[key]) {
            return (
                <div style={{ color: '#9f2d2d', fontWeight: 'bold' }}>
                    Erro: {errors[key]}
                </div>
            );
        }

        if (results[key]) {
            return <pre style={codeStyle}>{JSON.stringify(results[key], null, 2)}</pre>;
        }

        return <p style={{ color: '#736554', marginBottom: 0 }}>{emptyMessage}</p>;
    };

    return (
        <main
            style={{
                minHeight: '100vh',
                padding: '40px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <section
                style={{
                    width: '100%',
                    maxWidth: '1280px',
                    backgroundColor: 'rgba(255, 252, 246, 0.92)',
                    border: '1px solid rgba(123, 92, 48, 0.16)',
                    borderRadius: '28px',
                    boxShadow: '0 24px 60px rgba(89, 61, 25, 0.12)',
                    padding: '36px'
                }}
            >
                <div style={{ marginBottom: '24px' }}>
                    <p style={{
                        margin: '0 0 10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.18em',
                        fontSize: '12px',
                        color: '#8a6a42',
                        fontWeight: 700
                    }}>
                        Ent'Artes Desktop
                    </p>

                    <h1 style={{
                        margin: '0 0 12px',
                        fontSize: '40px',
                        lineHeight: 1.05,
                        color: '#2f2419'
                    }}>
                        Painel de testes da REST API
                    </h1>

                    <p style={{
                        margin: 0,
                        fontSize: '17px',
                        lineHeight: 1.6,
                        color: '#5f5447'
                    }}>
                        ✅ Autenticado! Backend separado em MVC. Testa endpoints protegidos (utilizadores, inventario, aulas, etc.).
                    </p>
                    <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#e8f5e8', borderRadius: '8px', borderLeft: '4px solid #4caf50' }}>
                        <strong>Token ativo:</strong> {localStorage.getItem('authToken')?.substring(0, 40)}...
                    </div>
                    <button
                        onClick={() => {
                            localStorage.removeItem('authToken');
                            localStorage.removeItem('authUser');
                            window.location.reload();
                        }}
                        style={{
                            ...secondaryButtonStyle,
                            background: '#fee',
                            color: '#9f2d2d',
                            border: '1px solid #fcc',
                            padding: '8px 16px',
                            fontSize: '14px',
                            marginBottom: '16px'
                        }}
                    >
                        🚪 Logout
                    </button>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '20px'
                }}>
                    <div style={panelStyle}>
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Utilizadores</h2>
                        <button
                            onClick={() => runAction('utilizadores', getUtilizadores)}
                            disabled={loading.utilizadores}
                            style={{ ...secondaryButtonStyle, marginBottom: '16px' }}
                        >
                            {loading.utilizadores ? 'A carregar...' : 'GET /api/utilizadores'}
                        </button>
                        {renderResult('utilizadores', 'Ainda nao carregaste a lista de utilizadores.')}
                    </div>

                    <div style={panelStyle}>
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Inventario</h2>
                        <button
                            onClick={() => runAction('inventario', getInventario)}
                            disabled={loading.inventario}
                            style={{ ...secondaryButtonStyle, marginBottom: '16px' }}
                        >
                            {loading.inventario ? 'A carregar...' : 'GET /api/inventario'}
                        </button>
                        {renderResult('inventario', 'Ainda nao carregaste o inventario.')}
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            runAction('criarArtigo', () => criarArtigo(artigoForm));
                        }}
                        style={panelStyle}
                    >
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Criar artigo</h2>
                        <label style={{ display: 'block', marginBottom: '12px' }}>
                            <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Nome</span>
                            <input
                                type="text"
                                value={artigoForm.Nome}
                                onChange={(event) => setArtigoForm({ ...artigoForm, Nome: event.target.value })}
                                style={inputStyle}
                            />
                        </label>
                        <label style={{ display: 'block', marginBottom: '16px' }}>
                            <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>CustoPorDia</span>
                            <input
                                type="text"
                                value={artigoForm.CustoPorDia}
                                onChange={(event) => setArtigoForm({ ...artigoForm, CustoPorDia: event.target.value })}
                                style={inputStyle}
                            />
                        </label>
                        <button type="submit" disabled={loading.criarArtigo} style={{ ...buttonStyle, marginBottom: '16px' }}>
                            {loading.criarArtigo ? 'A criar...' : 'POST /api/inventario'}
                        </button>
                        {renderResult('criarArtigo', 'Cria um artigo de teste a partir deste formulario.')}
                    </form>

                    <div style={panelStyle}>
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Aulas</h2>
                        <button
                            onClick={() => runAction('aulas', getAulas)}
                            disabled={loading.aulas}
                            style={{ ...secondaryButtonStyle, marginBottom: '16px' }}
                        >
                            {loading.aulas ? 'A carregar...' : 'GET /api/aulas'}
                        </button>
                        {renderResult('aulas', 'Ainda nao carregaste as aulas.')}
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            runAction('criarAula', () => criarAula({
                                ...aulaForm,
                                CapacidadeMaxima: Number(aulaForm.CapacidadeMaxima),
                                Preco: Number(aulaForm.Preco)
                            }));
                        }}
                        style={panelStyle}
                    >
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Criar aula</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Data</span>
                                <input type="date" value={aulaForm.Data} onChange={(event) => setAulaForm({ ...aulaForm, Data: event.target.value })} style={inputStyle} />
                            </label>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Capacidade</span>
                                <input type="number" value={aulaForm.CapacidadeMaxima} onChange={(event) => setAulaForm({ ...aulaForm, CapacidadeMaxima: event.target.value })} style={inputStyle} />
                            </label>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>HoraInicio ISO</span>
                                <input type="text" value={aulaForm.HoraInicio} onChange={(event) => setAulaForm({ ...aulaForm, HoraInicio: event.target.value })} style={inputStyle} />
                            </label>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>HoraFim ISO</span>
                                <input type="text" value={aulaForm.HoraFim} onChange={(event) => setAulaForm({ ...aulaForm, HoraFim: event.target.value })} style={inputStyle} />
                            </label>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Preco</span>
                                <input type="text" value={aulaForm.Preco} onChange={(event) => setAulaForm({ ...aulaForm, Preco: event.target.value })} style={inputStyle} />
                            </label>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>IdProfessor</span>
                                <input type="text" value={aulaForm.IdProfessor} onChange={(event) => setAulaForm({ ...aulaForm, IdProfessor: event.target.value })} style={inputStyle} />
                            </label>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>IdEstudio</span>
                                <input type="text" value={aulaForm.IdEstudio} onChange={(event) => setAulaForm({ ...aulaForm, IdEstudio: event.target.value })} style={inputStyle} />
                            </label>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>IdEstiloDanca</span>
                                <input type="text" value={aulaForm.IdEstiloDanca} onChange={(event) => setAulaForm({ ...aulaForm, IdEstiloDanca: event.target.value })} style={inputStyle} />
                            </label>
                        </div>
                        <button type="submit" disabled={loading.criarAula} style={{ ...buttonStyle, marginTop: '16px', marginBottom: '16px' }}>
                            {loading.criarAula ? 'A criar...' : 'POST /api/aulas'}
                        </button>
                        {renderResult('criarAula', 'Usa IDs validos para testar o agendamento de aulas.')}
                    </form>

                    <div style={panelStyle}>
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Marcacoes</h2>
                        <button
                            onClick={() => runAction('marcacoes', getMarcacoes)}
                            disabled={loading.marcacoes}
                            style={{ ...secondaryButtonStyle, marginBottom: '16px' }}
                        >
                            {loading.marcacoes ? 'A carregar...' : 'GET /api/marcacoes'}
                        </button>
                        {renderResult('marcacoes', 'Ainda nao carregaste as marcacoes.')}
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            runAction('criarMarcacao', () => criarMarcacao(marcacaoForm));
                        }}
                        style={panelStyle}
                    >
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Criar marcacao</h2>
                        <label style={{ display: 'block', marginBottom: '12px' }}>
                            <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>IdAluno</span>
                            <input
                                type="text"
                                value={marcacaoForm.IdAluno}
                                onChange={(event) => setMarcacaoForm({ ...marcacaoForm, IdAluno: event.target.value })}
                                style={inputStyle}
                            />
                        </label>
                        <label style={{ display: 'block', marginBottom: '16px' }}>
                            <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>IdAula</span>
                            <input
                                type="text"
                                value={marcacaoForm.IdAula}
                                onChange={(event) => setMarcacaoForm({ ...marcacaoForm, IdAula: event.target.value })}
                                style={inputStyle}
                            />
                        </label>
                        <button type="submit" disabled={loading.criarMarcacao} style={{ ...buttonStyle, marginBottom: '16px' }}>
                            {loading.criarMarcacao ? 'A criar...' : 'POST /api/marcacoes'}
                        </button>
                        {renderResult('criarMarcacao', 'Submete para testar a criacao de marcacoes.')}
                    </form>

                    <div style={panelStyle}>
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Alugueres</h2>
                        <button
                            onClick={() => runAction('alugueres', getAlugueres)}
                            disabled={loading.alugueres}
                            style={{ ...secondaryButtonStyle, marginBottom: '16px' }}
                        >
                            {loading.alugueres ? 'A carregar...' : 'GET /api/alugueres'}
                        </button>
                        {renderResult('alugueres', 'Ainda nao carregaste os alugueres.')}
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            runAction('criarAluguer', () => {
                                const ListaArtigos = JSON.parse(aluguerForm.ListaArtigosJson);
                                return criarAluguer({
                                    IdUtilizador: aluguerForm.IdUtilizador,
                                    DataLevantamento: aluguerForm.DataLevantamento,
                                    DataEntrega: aluguerForm.DataEntrega,
                                    ListaArtigos
                                });
                            });
                        }}
                        style={panelStyle}
                    >
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Criar aluguer</h2>
                        <label style={{ display: 'block', marginBottom: '12px' }}>
                            <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>IdUtilizador</span>
                            <input
                                type="text"
                                value={aluguerForm.IdUtilizador}
                                onChange={(event) => setAluguerForm({ ...aluguerForm, IdUtilizador: event.target.value })}
                                style={inputStyle}
                            />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>DataLevantamento</span>
                                <input
                                    type="date"
                                    value={aluguerForm.DataLevantamento}
                                    onChange={(event) => setAluguerForm({ ...aluguerForm, DataLevantamento: event.target.value })}
                                    style={inputStyle}
                                />
                            </label>
                            <label>
                                <span style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>DataEntrega</span>
                                <input
                                    type="date"
                                    value={aluguerForm.DataEntrega}
                                    onChange={(event) => setAluguerForm({ ...aluguerForm, DataEntrega: event.target.value })}
                                    style={inputStyle}
                                />
                            </label>
                        </div>
                        <label style={{ display: 'block', marginTop: '12px', marginBottom: '16px' }}>
                            <span style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>ListaArtigos JSON</span>
                            <textarea
                                value={aluguerForm.ListaArtigosJson}
                                onChange={(event) => setAluguerForm({ ...aluguerForm, ListaArtigosJson: event.target.value })}
                                style={{ ...inputStyle, minHeight: '140px', resize: 'vertical' }}
                            />
                        </label>
                        <button type="submit" disabled={loading.criarAluguer} style={{ ...buttonStyle, marginBottom: '16px' }}>
                            {loading.criarAluguer ? 'A criar...' : 'POST /api/alugueres'}
                        </button>
                        {renderResult('criarAluguer', 'Indica um IdTamanhoArtigo valido e a quantidade para testar o aluguer.')}
                    </form>

                    <div style={panelStyle}>
                        <h2 style={{ marginTop: 0, color: '#3c2d1b' }}>Master Data</h2>
                        <button
                            onClick={() => runAction('estudios', getEstudios)}
                            disabled={loading.estudios}
                            style={{ ...secondaryButtonStyle, marginBottom: '16px', marginRight: '8px' }}
                        >
                            {loading.estudios ? 'A carregar...' : 'GET /api/master/estudios'}
                        </button>
                        <button
                            onClick={() => runAction('estilos', getEstilos)}
                            disabled={loading.estilos}
                            style={{ ...secondaryButtonStyle, marginBottom: '16px', marginRight: '8px' }}
                        >
                            {loading.estilos ? 'A carregar...' : 'GET /api/master/estilos'}
                        </button>
                        <button
                            onClick={() => runAction('geografia', getGeografia)}
                            disabled={loading.geografia}
                            style={{ ...secondaryButtonStyle, marginBottom: '16px' }}
                        >
                            {loading.geografia ? 'A carregar...' : 'GET /api/master/geografia'}
                        </button>
                        {renderResult('estudios', 'Carrega os estudios.')}
                        {renderResult('estilos', 'Carrega os estilos.')}
                        {renderResult('geografia', 'Carrega a geografia.')}
                    </div>
                </div>
            </section>
        </main>
    );
};

export default TestesBackend;
