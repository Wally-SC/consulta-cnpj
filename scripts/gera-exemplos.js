// Gera os arquivos de exemplo em /exemplos usando o próprio núcleo do index.html.
// Uso: npm run exemplos
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const core = html.split('/*CORE_START*/')[1].split('/*CORE_END*/')[0];
const api = new Function(core + '; return {validaCnpj, geraXlsx, formatCnpj};')();

// Empresas de capital aberto (dados públicos). O CNPJ é validado antes de entrar no exemplo.
const EMPRESAS = [
  ['Banco do Brasil', '00000000000191'], ['Petrobras', '33000167000101'],
  ['Itaú Unibanco', '60701190000104'], ['Ambev', '07526557000100'], ['Magazine Luiza', '47960950000121'],
].filter(([, c]) => api.validaCnpj(c));

const dir = path.join(__dirname, '..', 'exemplos');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'exemplo.txt'), 'Lista de clientes para consulta\n' + EMPRESAS.map(([, c]) => api.formatCnpj(c)).join('\n') + '\n');
fs.writeFileSync(path.join(dir, 'exemplo.csv'), '﻿Cliente;CNPJ;Observação\r\n' + EMPRESAS.map(([n, c]) => `${n};${api.formatCnpj(c)};`).join('\r\n') + '\r\n');
const rows = [['Cliente', 'CNPJ', 'Observação'], ...EMPRESAS.map(([n, c]) => [n, api.formatCnpj(c), ''])];
fs.writeFileSync(path.join(dir, 'exemplo.xlsx'), api.geraXlsx([{ nome: 'Clientes', rows, larguras: [24, 22, 24] }]));
console.log(`Gerados ${EMPRESAS.length} CNPJs em ${dir}`);
