const test = require('node:test');
const assert = require('node:assert/strict');

const Usuario = require('../models/Usuario');
const Vaga = require('../models/Vaga');
const Candidatura = require('../models/Candidatura');

// Cenário 1: candidato existente é reconstruído com os dados corretos da conta.
test('candidato acessa sua conta sem expor campos internos do banco', () => {
  const candidato = Usuario.fromDatabase({
    id: 21,
    nome: 'Ana Souza',
    email: 'ana@example.com',
    tipo: 'candidato',
    telefone: '33999990000',
    cidade: 'Capelinha',
    senha_hash: 'nao-deve-ir-para-a-sessao',
    email_verificado: true
  });

  const sessao = candidato.toSessionUser();

  assert.equal(sessao.tipo, 'candidato');
  assert.equal(sessao.nome, 'Ana Souza');
  assert.equal(sessao.cidade, 'Capelinha');
  assert.equal(Object.hasOwn(sessao, 'senha_hash'), false);
  assert.equal(Object.hasOwn(sessao, 'senha'), false);
});

// Cenário 2: empresa prepara uma vaga válida para publicação.
test('empresa cadastra vaga presencial CLT em Capelinha', () => {
  const vaga = Vaga.fromRequest({
    titulo: 'Auxiliar administrativo',
    descricao: 'Apoiar as rotinas administrativas, organizar documentos e atender clientes.',
    requisitos: 'Ensino médio completo e organização.',
    tipoContrato: 'CLT',
    modalidade: 'Presencial',
    cidade: ' Capelinha ',
    salario: 'A combinar'
  });

  assert.equal(vaga.validarCadastro(), null);
  assert.deepEqual(vaga.paraInsercao(8), [
    8,
    'Auxiliar administrativo',
    'Apoiar as rotinas administrativas, organizar documentos e atender clientes.',
    'Ensino médio completo e organização.',
    'CLT',
    'Presencial',
    'Capelinha',
    'A combinar'
  ]);
});

// Cenário 3: dados incompletos ou modalidade não permitida não passam na validação.
test('empresa não consegue cadastrar vaga com dados obrigatórios inválidos', () => {
  const vaga = Vaga.fromRequest({
    titulo: 'Dev',
    descricao: 'Vaga.',
    tipoContrato: 'Informal',
    modalidade: 'Presencialmente',
    cidade: ''
  });

  assert.notEqual(vaga.validarCadastro(), null);
});

// Cenário 4: candidato seleciona uma vaga existente e envia candidatura.
test('candidato prepara candidatura para uma vaga válida', () => {
  const candidatura = Candidatura.fromRequest(
    '42',
    'Tenho interesse na oportunidade e disponibilidade para entrevista.'
  );

  assert.equal(candidatura.validarNova(), null);
  assert.equal(candidatura.vagaId, 42);
  assert.equal(
    candidatura.mensagem,
    'Tenho interesse na oportunidade e disponibilidade para entrevista.'
  );
});

// Cenário 5: identificador inválido não pode ser usado para candidatar-se.
test('sistema rejeita candidatura com identificador de vaga inválido', () => {
  const candidatura = Candidatura.fromRequest('../42', 'Tenho interesse.');

  assert.equal(candidatura.validarNova(), 'Vaga inválida.');
});

// Cenário 6: empresa pode avançar candidatura apenas para estados reconhecidos.
test('empresa atualiza candidatura para entrevista e rejeita estado desconhecido', () => {
  assert.equal(Candidatura.statusValido('entrevista'), true);
  assert.equal(Candidatura.statusValido('aprovada'), true);
  assert.equal(Candidatura.statusValido('aguardando_pagamento'), false);
});

// Cenário 7: empresa controla o estado da própria vaga com opções permitidas.
test('empresa pode pausar vaga e não pode usar status arbitrário', () => {
  assert.equal(Vaga.statusValido('pausada'), true);
  assert.equal(Vaga.statusValido('encerrada'), true);
  assert.equal(Vaga.statusValido('excluida_permanentemente'), false);
});
