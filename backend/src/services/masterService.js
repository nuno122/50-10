const masterRepo = require('../repositories/masterRepository');
const ExcelJS = require('exceljs');
const path = require('path');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const listarEstudios = async () => {
    const estudios = await masterRepo.findAllEstudios();
    if (!estudios) throw criarErro('Não foi possível aceder aos estúdios.', 404);
    return estudios;
};

const listarEstilos = async () => {
    const estilos = await masterRepo.findAllEstilos();
    if (!estilos) throw criarErro('Não foi possível aceder aos estilos de dança.', 404);
    return estilos;
};

const listarGeografia = async () => {
    const paises = await masterRepo.findAllPaises();
    const distritos = await masterRepo.findAllDistritos();
    if (!paises || !distritos) throw criarErro('Não foi possível carregar os dados geográficos.', 404);
    return { paises, distritos };
};

const exportarDadosFinanceiros = async (DataInicio, DataFim) => {
    if (!DataInicio || !DataFim) {
        throw criarErro('DataInicio e DataFim são obrigatórios.', 400);
    }

    const inicio = new Date(DataInicio);
    const fim = new Date(DataFim);

    if (isNaN(inicio) || isNaN(fim)) throw criarErro('Datas inválidas.', 400);
    if (fim < inicio) throw criarErro('DataFim não pode ser anterior a DataInicio.', 400);

    const pagamentos = await masterRepo.findPagamentosEntreDatas(inicio, fim);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Dados Financeiros');

    sheet.columns = [
        { header: 'ID Pagamento',   key: 'IdPagamento',     width: 38 },
        { header: 'Data Pagamento', key: 'DataPagamento',    width: 15 },
        { header: 'Prazo',          key: 'PrazoPagamento',   width: 15 },
        { header: 'Custo (€)',      key: 'Custo',            width: 12 },
        { header: 'Estado',         key: 'EstadoPagamento',  width: 15 },
        { header: 'Tipo',           key: 'Tipo',             width: 12 }
    ];

    // Cabeçalho a negrito
    sheet.getRow(1).font = { bold: true };

    pagamentos.forEach(p => {
        sheet.addRow({
            IdPagamento:    p.IdPagamento,
            DataPagamento:  p.DataPagamento ? new Date(p.DataPagamento).toLocaleDateString('pt-PT') : '-',
            PrazoPagamento: new Date(p.PrazoPagamento).toLocaleDateString('pt-PT'),
            Custo:          Number(p.Custo),
            EstadoPagamento: p.EstadoPagamento,
            Tipo:           p.IdMarcacao ? 'Marcação' : 'Aluguer'
        });
    });

    const total = pagamentos.reduce((acc, p) => acc + Number(p.Custo), 0);
    sheet.addRow({});
    const totalRow = sheet.addRow({ Custo: total, EstadoPagamento: 'TOTAL' });
    totalRow.font = { bold: true };

    return workbook;
};

const exportarMensal = async () => {
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    return await exportarDadosFinanceiros(inicio, fim);
};

const download = async (res, workbook, nomeFile = 'relatorio.xlsx') => {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeFile}"`);
    await workbook.xlsx.write(res);
    res.end();
};

module.exports = {
    listarEstudios,
    listarEstilos,
    listarGeografia,
    exportarDadosFinanceiros,
    exportarMensal,
    download
};