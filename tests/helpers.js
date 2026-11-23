// Extrai o núcleo (lógica pura, sem DOM) do index.html entre os marcadores CORE_START/CORE_END.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const core = html.split('/*CORE_START*/')[1].split('/*CORE_END*/')[0];
const nomes = [
  'validaCnpj','formatCnpj','soDigitos','extraiCnpjs','achaCnpjsEmTexto','cnpjDeCelula','parseCsv',
  'planoDeLista','planoDeTabela','planoDeTexto','unicosDoPlano','normOpen','normCnpja','mescla',
  'geraXlsx','leXlsx','lerArquivoEnviado','setorCnae','resumoLinha','montaAbasSaida','linhaPlanilha','geraCsv','csvCell','CAB_RESUMO'
];
module.exports = new Function(core + `; return {${nomes.join(',')}};`)();
