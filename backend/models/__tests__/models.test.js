const test = require('node:test');
const assert = require('node:assert/strict');

const Usuario = require('../Usuario');
const Candidato = require('../Candidato');
const Empresa = require('../Empresa');
const Vaga = require('../Vaga');
const Candidatura = require('../Candidatura');

test('Usuario cria a classe especializada correta conforme o tipo', () => {
  const candidato = Usuario.fromDatabase({ id: 1, nome: 'Ana', tipo: 'candidato' });
  const empresa = Usuario.fromDatabase({ id: 2, nome: 'Carlos', tipo: 'empresa' });

  assert.ok(candidato instanceof Candidato);
  assert.ok(empresa instanceof Empresa);
  assert.ok(candidato instanceof Usuario);
  assert.ok(empresa instanceof Usuario);
});

test('Candidato mantém seus dados e fornece nome de exibição', () => {
  const candidato = new Candidato({ id: 3, nome: 'Ana Silva', email: 'ana@example.com' });

  assert.equal(candidato.tipo, 'candidato');
  assert.equal(candidato.getNomeExibicao(), 'Ana Silva');
});

test('Empresa escolhe o melhor nome disponível para exibição', () => {
  const empresa = new Empresa({ nomeEmpresa: '', nomeFantasia: 'Empresa Exemplo', nome: 'Responsável' });

  assert.equal(empresa.tipo, 'empresa');
  assert.equal(empresa.getNomeExibicao(), 'Empresa Exemplo');
});

test('Usuario mantém o formato de dados utilizado pela sessão atual', () => {
  const usuario = Usuario.fromDatabase({
    id: 7, nome: 'Ana', email: 'ana@example.com', tipo: 'candidato',
    telefone: '3333-0000', cidade: 'Capelinha', email_verificado: true
  });

  assert.deepEqual(usuario.toSessionUser(), {
    id: 7, nome: 'Ana', email: 'ana@example.com', tipo: 'candidato',
    telefone: '3333-0000', cidade: 'Capelinha', nomeEmpresa: null,
    fotoPerfil: null, emailVerificado: true
  });
});

test('Vaga normaliza os campos e aceita um cadastro válido', () => {
  const vaga = Vaga.fromRequest({
    titulo: '  Assistente  ',
    descricao: 'Descrição completa para a oportunidade.',
    requisitos: 'Organização',
    tipoContrato: 'CLT',
    modalidade: 'Presencial',
    cidade: ' Capelinha ',
    salario: ''
  });

  assert.equal(vaga.validarCadastro(), null);
  assert.deepEqual(vaga.paraInsercao(12), [
    12, 'Assistente', 'Descrição completa para a oportunidade.',
    'Organização', 'CLT', 'Presencial', 'Capelinha', null
  ]);
});

test('Vaga rejeita título curto e status desconhecido', () => {
  const vaga = Vaga.fromRequest({ titulo: 'ABC', descricao: 'Descrição suficientemente longa.', tipoContrato: 'CLT', modalidade: 'Remoto', cidade: 'Capelinha' });

  assert.equal(vaga.validarCadastro(), 'O título deve ter pelo menos 4 caracteres.');
  assert.equal(Vaga.statusValido('aberta'), true);
  assert.equal(Vaga.statusValido('publicada'), false);
  assert.equal(Vaga.idValido(10), true);
  assert.equal(Vaga.idValido(0), false);
});

test('Candidatura valida vaga e estados permitidos', () => {
  const candidatura = Candidatura.fromRequest('25', ' Tenho interesse na oportunidade. ');

  assert.equal(candidatura.validarNova(), null);
  assert.equal(candidatura.vagaId, 25);
  assert.equal(candidatura.mensagem, 'Tenho interesse na oportunidade.');
  assert.equal(Candidatura.statusValido('entrevista'), true);
  assert.equal(Candidatura.statusValido('cancelada'), false);
  assert.equal(Candidatura.fromRequest('abc', '').validarNova(), 'Vaga inválida.');
});


test('Candidatura rejeita identificadores em notação científica ou hexadecimal', () => {
  assert.equal(Candidatura.fromRequest('1e2', '').validarNova(), 'Vaga inválida.');
  assert.equal(Candidatura.fromRequest('0x10', '').validarNova(), 'Vaga inválida.');
});
