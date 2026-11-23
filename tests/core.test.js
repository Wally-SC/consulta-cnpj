const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const k = require('./helpers');

const OPEN = {cnpj:"00000000000191",razao_social:"BANCO DO BRASIL SA",nome_fantasia:"DIRECAO GERAL",situacao_cadastral:"Ativa",data_situacao_cadastral:"2005-11-03",matriz_filial:"Matriz",data_inicio_atividade:"1966-08-01",cnae_principal:"6422100",cnaes:[{codigo:"6422100",descricao:"Bancos múltiplos, com carteira comercial",is_principal:true},{codigo:"6499999",descricao:"Outras atividades de serviços financeiros",is_principal:false}],natureza_juridica:"Sociedade de Economia Mista",tipo_logradouro:"QUADRA",logradouro:"SAUN QUADRA 5",numero:"SN",complemento:"",bairro:"ASA NORTE",cep:"70040912",uf:"DF",municipio:"BRASILIA",email:"SECEX@BB.COM.BR",telefones:[{ddd:"61",numero:"34939002",is_fax:false}],capital_social:"120000000000,00",porte_empresa:"Demais",opcao_simples:"N",opcao_mei:"N",QSA:[{nome_socio:"FULANO",cnpj_cpf_socio:"***345856**",qualificacao_socio:"Diretor",data_entrada_sociedade:"2020-07-10",identificador_socio:"Pessoa Física"}],updated_at:"2026-11-17"};
const CNPJA = {taxId:"00000000000191",alias:"Direcao Geral",founded:"1966-08-01",head:true,statusDate:"2005-11-03",status:{id:2,text:"Ativa"},company:{name:"BANCO DO BRASIL S.A.",equity:120000000000,nature:{id:2038,text:"Sociedade de Economia Mista"},size:{text:"Demais"},simples:{optant:false},members:[]},address:{street:"Quadra Saun Quadra 5",number:"SN",district:"Asa Norte",city:"Brasília",state:"DF",zip:"70040-912"},mainActivity:{id:6422100,text:"Bancos múltiplos, com carteira comercial"},sideActivities:[{id:6499999,text:"Outras"}],phones:[{area:"61",number:"34939002"}],emails:[{address:"secex@bb.com.br"}]};

test('valida dígitos verificadores do CNPJ', () => {
  assert.ok(k.validaCnpj('00.000.000/0001-91'));
  assert.ok(k.validaCnpj('33000167000101'));
  assert.ok(!k.validaCnpj('11.111.111/1111-11'));
  assert.ok(!k.validaCnpj('00000000000192'));
  assert.ok(!k.validaCnpj('123'));
});

test('extrai lista de CNPJs, sem duplicados e separando inválidos', () => {
  const r = k.extraiCnpjs('00000000000191\n00.000.000/0001-91, 123, 33000167000101');
  assert.deepEqual(r.validos, ['00000000000191', '33000167000101']);
  assert.deepEqual(r.invalidos, ['123']);
});

test('acha CNPJs em texto livre e ignora números longos demais', () => {
  assert.deepEqual(k.achaCnpjsEmTexto('a 33.000.167/0001-01, b 00000000000191; 123456789012345678'), ['33000167000101', '00000000000191']);
});

test('recupera zero à esquerda perdido pelo Excel', () => {
  assert.equal(k.cnpjDeCelula('0000000000191'), '00000000000191');   // 13 dígitos
  assert.equal(k.cnpjDeCelula(3982597000105), '03982597000105');     // número
  assert.equal(k.cnpjDeCelula('191'), null);
});

test('CSV: aspas, delimitador ; e cabeçalho', () => {
  const rows = k.parseCsv('Nome;CNPJ;Obs\r\n"Ana; ""X""";33000167000101;ok\r\nBob;0000000000191;\r\n');
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], 'Ana; "X"');
  const p = k.planoDeTabela(rows);
  assert.equal(p.colCnpj, 1);
  assert.deepEqual(p.cab, ['Nome', 'CNPJ', 'Obs']);
  assert.equal(p.linhas[1].cnpj, '00000000000191');
});

test('planilha sem cabeçalho e TXT livre', () => {
  const p = k.planoDeTabela(k.parseCsv('33000167000101\n00000000000191'));
  assert.equal(p.linhas.length, 2);
  assert.equal(p.cab[0], 'CNPJ informado');
  assert.equal(k.planoDeTexto('olá 33.000.167/0001-01 e 00.000.000/0001-91').linhas.length, 2);
  assert.ok(k.planoDeTexto('nada aqui').erro);
});

test('setor aproximado pelo CNAE', () => {
  assert.equal(k.setorCnae('4722901'), 'Comércio');
  assert.equal(k.setorCnae('0600001'), 'Indústrias extrativas');
  assert.equal(k.setorCnae('6422100'), 'Finanças e seguros');
  assert.equal(k.setorCnae('8610101'), 'Saúde e assistência social');
});

test('mescla: CNAE da CNPJá sem zero à esquerda não gera divergência falsa', () => {
  const op = {...OPEN, cnae_principal: '0600001', cnaes: [{codigo: '0600001', descricao: 'Extração de petróleo', is_principal: true}]};
  const cj = {...CNPJA, mainActivity: {id: 600001, text: 'Extração de petróleo'}, sideActivities: [], company: {...CNPJA.company, name: 'BANCO DO BRASIL SA'}};
  const m = k.mescla(k.normOpen(op), k.normCnpja(cj));
  // 600001 (número) vira 0600001; CEP 70040-912 == 70040912; "S.A." == "SA"
  assert.ok(!m.divergencias.some(d => /CEP|Município|Situação|CNAE principal/.test(d.campo)), JSON.stringify(m.divergencias));
  assert.equal(m.campos['cnae_principal.codigo'].valor, '0600001'); // OpenCNPJ tem prioridade
});

test('mescla: aponta divergência real e completa lacunas', () => {
  const diverge = k.mescla(k.normOpen(OPEN), k.normCnpja({...CNPJA, company: {...CNPJA.company, name: 'OUTRO NOME LTDA'}}));
  assert.ok(diverge.divergencias.some(d => d.campo === 'Razão social'));
  const solo = k.mescla(null, k.normCnpja(CNPJA));
  assert.equal(solo.campos.razao_social.fonte, 'CNPJá');
  assert.equal(solo.divergencias.length, 0);
});

test('XLSX: ida e volta preserva acentos, símbolos e números', async () => {
  const rows = [['Cliente', 'CNPJ'], ['Ação & "Cia" <1>', '33000167000101'], ['Ç ã', {n: 1234.5, dinheiro: true}]];
  const buf = k.geraXlsx([{nome: 'Resumo', rows, larguras: [20, 20]}]);
  const volta = await k.leXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  assert.equal(volta[1][0], 'Ação & "Cia" <1>');
  assert.equal(volta[1][1], '33000167000101');
  assert.equal(volta[2][1], 1234.5);
});

test('planilha de saída mantém colunas originais e acrescenta o resumo', () => {
  const plano = k.planoDeTabela(k.parseCsv('Cliente;CNPJ\r\nBB;00000000000191\r\nSem;\r\nNada;11222333000181\r\n'));
  const m = k.mescla(k.normOpen(OPEN), null); m.status = {open: 'ok', cnpja: 'não consultada'};
  const abas = k.montaAbasSaida(plano, new Map([['00000000000191', m]]));
  assert.equal(abas[0].nome, 'Resumo');
  assert.deepEqual(abas[0].rows[0].slice(0, 3), ['Cliente', 'CNPJ', 'CNPJ (formatado)']);
  assert.equal(abas[0].rows[1][3], 'BANCO DO BRASIL SA');
  assert.match(abas[0].rows[2].at(-1), /Sem CNPJ válido/);
  assert.match(abas[0].rows[3].at(-1), /Não consultado/);
  assert.equal(abas[1].nome, 'Dados completos');
});

test('CSV de exportação neutraliza fórmulas', () => {
  assert.equal(k.csvCell('=1+1'), "'=1+1");
  assert.equal(k.csvCell('a;b'), '"a;b"');
  assert.equal(k.csvCell('-5'), '-5');
});

test('arquivos de exemplo são lidos e todos os CNPJs são válidos', async () => {
  const dir = path.join(__dirname, '..', 'exemplos');
  for (const f of ['exemplo.txt', 'exemplo.csv', 'exemplo.xlsx']) {
    const b = fs.readFileSync(path.join(dir, f));
    const plano = await k.lerArquivoEnviado(f, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    assert.ok(!plano.erro, f + ': ' + plano.erro);
    assert.equal(k.unicosDoPlano(plano).length, 5, f);
  }
});
