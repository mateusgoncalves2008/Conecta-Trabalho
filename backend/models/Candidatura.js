const STATUS = ['recebida', 'em_analise', 'entrevista', 'aprovada', 'rejeitada'];

class Candidatura {
  constructor({ vagaId, mensagem = '' } = {}) {
    this.vagaId = vagaId;
    this.mensagem = mensagem;
  }

  static fromRequest(vagaId, mensagem) {
    const id = Number(vagaId);
    const texto = typeof mensagem === 'string' ? mensagem.trim().slice(0, 1000) : '';
    return new Candidatura({ vagaId: id, mensagem: texto });
  }

  validarNova() {
    if (!Candidatura.idValido(this.vagaId)) return 'Vaga inválida.';
    return null;
  }

  static idValido(id) {
    return Number.isSafeInteger(id) && id > 0;
  }

  static statusValido(status) {
    return STATUS.includes(status);
  }
}

module.exports = Candidatura;
