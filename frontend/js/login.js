document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (!form) return;
  const feedback = document.getElementById('form-feedback');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    feedback.textContent = '';
    feedback.classList.remove('success');
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Entrando...';
    const values = Object.fromEntries(new FormData(form));
    try {
      const result = await Conecta.api('/api/login', { method: 'POST', body: JSON.stringify(values) });
      feedback.textContent = 'Login realizado. Redirecionando...';
      feedback.classList.add('success');
      Conecta.redirectByUser(result.usuario);
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Entrar';
    }
  });
});