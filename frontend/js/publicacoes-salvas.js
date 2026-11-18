document.addEventListener('DOMContentLoaded', async () => {
  try {
    const session = await Conecta.api('/api/me');
    if (!session.usuario) return window.location.href = '/pages/login.html';
    if (session.usuario.tipo === 'empresa') {
      document.getElementById('saved-back-link').href = '/pages/empresa.html';
    }
  } catch (error) {
    Conecta.toast(error.message || 'Não foi possível carregar sua conta.');
  }
});
