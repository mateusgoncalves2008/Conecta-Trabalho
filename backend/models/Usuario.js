class Usuario {
  constructor({
    id = null,
    nome = '',
    email = '',
    tipo = 'usuario',
    telefone = null,
    cidade = null,
    estado = null,
    nomeEmpresa = null,
    nomeFantasia = null,
    razaoSocial = null,
    fotoPerfil = null,
    emailVerificado = false
  } = {}) {
    this.id = id;
    this.nome = nome;
    this.email = email;
    this.tipo = tipo;
    this.telefone = telefone;
    this.cidade = cidade;
    this.estado = estado;
    this.nomeEmpresa = nomeEmpresa;
    this.nomeFantasia = nomeFantasia;
    this.razaoSocial = razaoSocial;
    this.fotoPerfil = fotoPerfil;
    this.emailVerificado = emailVerificado === true;
  }

  static fromDatabase(row) {
    if (!row || typeof row !== 'object') {
      throw new TypeError('Os dados do usuário são inválidos.');
    }

    const dados = {
      id: row.id,
      nome: row.nome,
      email: row.email,
      tipo: row.tipo,
      telefone: row.telefone,
      cidade: row.cidade,
      estado: row.estado,
      nomeEmpresa: row.nome_empresa,
      nomeFantasia: row.nome_fantasia,
      razaoSocial: row.razao_social,
      fotoPerfil: row.foto_perfil,
      emailVerificado: row.email_verificado
    };

    if (row.tipo === 'candidato') {
      const Candidato = require('./Candidato');
      return new Candidato(dados);
    }

    if (row.tipo === 'empresa') {
      const Empresa = require('./Empresa');
      return new Empresa(dados);
    }

    return new Usuario(dados);
  }

  toSessionUser({ fotoPerfil = this.fotoPerfil } = {}) {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      tipo: this.tipo,
      telefone: this.telefone,
      cidade: this.cidade,
      estado: this.estado,
      nomeEmpresa: this.nomeEmpresa,
      fotoPerfil,
      emailVerificado: this.emailVerificado
    };
  }
}

module.exports = Usuario;
