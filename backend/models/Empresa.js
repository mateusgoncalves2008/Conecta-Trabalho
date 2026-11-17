const Usuario = require('./Usuario');

class Empresa extends Usuario {
  constructor(dados = {}) {
    super({ ...dados, tipo: 'empresa' });
  }

  getNomeExibicao() {
    return this.nomeEmpresa || this.nomeFantasia || this.razaoSocial || this.nome;
  }
}

module.exports = Empresa;
