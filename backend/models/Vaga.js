const TIPOS_CONTRATO = ['CLT', 'Estágio', 'Temporário', 'Jovem Aprendiz', 'Freelancer', 'Autônomo'];
const MODALIDADES = ['Presencial', 'Híbrido', 'Remoto'];
const STATUS = ['aberta', 'pausada', 'encerrada'];

const limpar = (valor, limite) => typeof valor === 'string' ? valor.trim().slice(0, limite) : '';

class Vaga {
  constructor({ titulo = '', descricao = '', requisitos = '', tipoContrato = '', modalidade = '', cidade = '', salario = '' } = {}) {
    this.titulo = titulo;
    this.descricao = descricao;
    this.requisitos = requisitos;
    this.tipoContrato = tipoContrato;
    this.modalidade = modalidade;
    this.cidade = cidade;
    this.salario = salario;
  }

  static fromRequest(body = {}) {
    return new Vaga({
      titulo: limpar(body.titulo, 120),
      descricao: limpar(body.descricao, 5000),
      requisitos: limpar(body.requisitos, 3000),
      tipoContrato: limpar(body.tipoContrato, 40),
      modalidade: limpar(body.modalidade, 30),
      cidade: limpar(body.cidade, 100),
      salario: limpar(body.salario, 80)
    });
  }

  validarCadastro() {
    if (this.titulo.length < 4) return 'O título deve ter pelo menos 4 caracteres.';
    if (this.descricao.length < 20) return 'A descrição deve ter pelo menos 20 caracteres.';
    if (!TIPOS_CONTRATO.includes(this.tipoContrato)) return 'Selecione um contrato válido.';
    if (!MODALIDADES.includes(this.modalidade)) return 'Selecione uma modalidade válida.';
    if (this.cidade.length < 2) return 'Informe a cidade da vaga.';
    return null;
  }

  paraInsercao(empresaId) {
    return [
      empresaId,
      this.titulo,
      this.descricao,
      this.requisitos || null,
      this.tipoContrato,
      this.modalidade,
      this.cidade,
      this.salario || null
    ];
  }

  static idValido(id) {
    return Number.isSafeInteger(id) && id > 0;
  }

  static statusValido(status) {
    return STATUS.includes(status);
  }
}

module.exports = Vaga;
