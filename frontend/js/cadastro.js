document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  if (!form) return;
  const type = document.getElementById('account-type');
  const companyField = document.getElementById('company-field');
  const companyInput = form.elements.nomeEmpresa;
  const feedback = document.getElementById('form-feedback');

  const updateType = () => {
    const isCompany = type.value === 'empresa';
    companyField.classList.toggle('hidden', !isCompany);
    companyInput.required = isCompany;
    companyInput.disabled = !isCompany;
  };
  type.addEventListener('change', updateType);
  updateType();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    feedback.textContent = '';
    feedback.classList.remove('success');
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    if (values.senha !== values.confirmarSenha) {
      feedback.textContent = 'As senhas não são iguais.';
      form.elements.confirmarSenha.focus();
      return;
    }
    if (values.senha.length < 8) {
      feedback.textContent = 'A senha precisa ter pelo menos 8 caracteres.';
      return;
    }
    delete values.confirmarSenha;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Criando conta...';
    try {
      const result = await Conecta.api('/api/cadastro', { method: 'POST', body: JSON.stringify(values) });
      feedback.textContent = 'Conta criada. Redirecionando...';
      feedback.classList.add('success');
      Conecta.redirectByUser(result.usuario);
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Criar conta';
    }
  });
});