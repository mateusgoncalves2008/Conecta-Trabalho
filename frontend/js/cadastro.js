document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  if (!form) return;

  const type = document.getElementById('account-type');
  const registrationFields = document.getElementById('registration-fields');
  const companyFields = document.getElementById('company-fields');
  const codeStep = document.getElementById('company-code-step');
  const codeInput = document.getElementById('company-code');
  const codeDestination = document.getElementById('company-email-destination');
  const cnpjInput = document.getElementById('cnpj-input');
  const cnpjFeedback = document.getElementById('cnpj-feedback');
  const razaoSocialInput = document.getElementById('razao-social');
  const nomeFantasiaInput = document.getElementById('nome-fantasia');
  const cityInput = document.getElementById('city-input');
  const phoneInput = document.getElementById('phone-input');
  const nameLabel = document.getElementById('name-label');
  const phoneLabel = document.getElementById('phone-label');
  const emailLabel = document.getElementById('email-label');
  const feedback = document.getElementById('form-feedback');
  const registerButton = document.getElementById('register-submit');
  const confirmButton = document.getElementById('company-confirm-submit');
  const backButton = document.getElementById('company-back-button');

  let cnpjValidated = false;
  let companyCodeSent = false;
  let cnpjRequestRunning = false;
  let cnpjTestMode = false;

  const cnpjField = cnpjInput.closest('.field');
  const companyTestNotice = document.getElementById('company-test-notice');
  const configPromise = Conecta.api('/api/config').then(config => {
    cnpjTestMode = config.modoTesteCnpj === true;
    if (cnpjTestMode) {
      cnpjField.classList.add('hidden');
      cnpjInput.disabled = true;
      cnpjInput.required = false;
      razaoSocialInput.value = 'Empresa de Teste';
      nomeFantasiaInput.value = 'Empresa de Teste';
      cnpjFeedback.textContent = 'CNPJ dispensado no modo de teste local.';
      companyTestNotice.classList.remove('hidden');
    }
    updateType();
    return config;
  }).catch(() => ({ modoTesteCnpj: false }));

  const normalizeEmail = value => {
    const email = value.trim().toLowerCase();
    return email.includes('@') ? email : email + '@gmail.com';
  };
  const normalizeCnpj = value => value.replace(/[^0-9a-z]/gi, '').toUpperCase();
  const formatCnpj = value => {
    const raw = normalizeCnpj(value).slice(0, 14);
    let formatted = raw.slice(0, 2);
    if (raw.length > 2) formatted += '.' + raw.slice(2, 5);
    if (raw.length > 5) formatted += '.' + raw.slice(5, 8);
    if (raw.length > 8) formatted += '/' + raw.slice(8, 12);
    if (raw.length > 12) formatted += '-' + raw.slice(12, 14);
    return formatted;
  };

  const clearCompanyData = () => {
    cnpjValidated = false;
    razaoSocialInput.value = cnpjTestMode ? 'Empresa de Teste' : '';
    nomeFantasiaInput.value = cnpjTestMode ? 'Empresa de Teste' : '';
    cnpjFeedback.textContent = cnpjTestMode
      ? 'CNPJ dispensado no modo de teste local.'
      : 'Informe o CNPJ para consultar os dados oficiais da empresa.';
  };

  const updateType = () => {
    const isCompany = type.value === 'empresa';
    companyFields.classList.toggle('hidden', !isCompany);
    companyFields.querySelectorAll('input').forEach(input => {
      const isDisabledTestCnpj = cnpjTestMode && input === cnpjInput;
      input.disabled = !isCompany || isDisabledTestCnpj;
      input.required = isCompany && !isDisabledTestCnpj;
    });
    phoneInput.required = isCompany;
    phoneLabel.textContent = isCompany ? 'Telefone de contato (obrigatório)' : 'Telefone (opcional)';
    emailLabel.textContent = isCompany ? 'E-mail de contato (receberá um código)' : 'E-mail';
    nameLabel.textContent = isCompany ? 'Nome completo do responsável' : 'Nome completo';
    registerButton.textContent = isCompany ? 'Enviar código de confirmação' : 'Criar conta';
    codeStep.classList.add('hidden');
    registrationFields.classList.remove('hidden');
    codeInput.disabled = true;
    codeInput.required = false;
    companyCodeSent = false;
    codeInput.value = '';
    feedback.textContent = '';
    feedback.classList.remove('success');
    if (!isCompany) clearCompanyData();
  };

  type.addEventListener('change', updateType);
  updateType();

  cnpjInput.addEventListener('input', () => {
    const cursor = cnpjInput.selectionStart;
    const previousLength = cnpjInput.value.length;
    cnpjInput.value = formatCnpj(cnpjInput.value);
    const difference = cnpjInput.value.length - previousLength;
    cnpjInput.setSelectionRange(Math.max(0, (cursor || 0) + difference), Math.max(0, (cursor || 0) + difference));
    clearCompanyData();
  });

  cnpjInput.addEventListener('blur', async () => {
    if (cnpjTestMode) return;
    const cnpj = normalizeCnpj(cnpjInput.value);
    if (cnpj.length !== 14 || cnpjRequestRunning) return;
    cnpjRequestRunning = true;
    cnpjFeedback.textContent = 'Consultando CNPJ na base cadastral...';
    try {
      const result = await Conecta.api('/api/empresa/consultar-cnpj/' + encodeURIComponent(cnpj));
      razaoSocialInput.value = result.razaoSocial || '';
      nomeFantasiaInput.value = result.nomeFantasia || result.razaoSocial || '';
      if (result.municipio) cityInput.value = result.uf ? result.municipio + ' - ' + result.uf : result.municipio;
      cnpjValidated = true;
      cnpjFeedback.textContent = 'CNPJ encontrado e com situação ativa.';
    } catch (error) {
      clearCompanyData();
      cnpjFeedback.textContent = error.message;
    } finally {
      cnpjRequestRunning = false;
    }
  });

  backButton.addEventListener('click', () => {
    companyCodeSent = false;
    codeStep.classList.add('hidden');
    registrationFields.classList.remove('hidden');
    codeInput.disabled = true;
    codeInput.required = false;
    codeInput.value = '';
    feedback.textContent = '';
    registerButton.focus();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    feedback.textContent = '';
    feedback.classList.remove('success');

    await configPromise;
    const isCompany = type.value === 'empresa';
    if (!companyCodeSent && !form.reportValidity()) return;

    const submitButton = companyCodeSent ? confirmButton : registerButton;
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = companyCodeSent ? 'Verificando...' : (isCompany ? 'Enviando código...' : 'Criando conta...');

    try {
      if (isCompany && !companyCodeSent) {
        if (!cnpjTestMode && !cnpjValidated) throw new Error('Consulte e valide o CNPJ antes de continuar.');
        const values = Object.fromEntries(new FormData(form));
        values.email = normalizeEmail(values.email);
        if (values.senha !== values.confirmarSenha) throw new Error('As senhas não são iguais.');
        if (values.senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        delete values.confirmarSenha;
        delete values.tipo;
        delete values.codigo;
        const result = await Conecta.api('/api/cadastro/empresa/solicitar-codigo', {
          method: 'POST',
          body: JSON.stringify(values)
        });
        companyCodeSent = true;
        codeDestination.textContent = values.email;
        registrationFields.classList.add('hidden');
        codeStep.classList.remove('hidden');
        codeInput.disabled = false;
        codeInput.required = true;
        codeInput.focus();
        feedback.textContent = result.mensagem || 'Código enviado. Confira seu e-mail.';
        feedback.classList.add('success');
        return;
      }

      if (isCompany && companyCodeSent) {
        const email = normalizeEmail(form.elements.email.value);
        const result = await Conecta.api('/api/cadastro/empresa/confirmar-codigo', {
          method: 'POST',
          body: JSON.stringify({ email, codigo: codeInput.value.trim() })
        });
        feedback.textContent = 'Empresa cadastrada. Redirecionando...';
        feedback.classList.add('success');
        Conecta.redirectByUser(result.usuario);
        return;
      }

      const values = Object.fromEntries(new FormData(form));
      values.email = normalizeEmail(values.email);
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
      const result = await Conecta.api('/api/cadastro', { method: 'POST', body: JSON.stringify(values) });
      feedback.textContent = 'Conta criada. Redirecionando...';
      feedback.classList.add('success');
      Conecta.redirectByUser(result.usuario);
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
});