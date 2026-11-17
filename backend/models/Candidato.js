const Usuario = require('./Usuario');

class Candidato extends Usuario {
  constructor(dados = {}) {
    super({ ...dados, tipo: 'candidato' });
  }

  getNomeExibicao() {
    return this.nome;
  }
}

module.exports = Candidato;
