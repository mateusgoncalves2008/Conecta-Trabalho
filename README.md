# ConectaTrabalho

Plataforma para aproximar candidatos e empresas de Capelinha e cidades próximas.

## Funcionalidades

- Cadastro e login de candidatos e empresas.
- Senhas armazenadas com hash bcrypt.
- Sessões seguras armazenadas no PostgreSQL.
- Busca de vagas por palavra-chave e cidade.
- Publicação, pausa e encerramento de vagas.
- Candidatura de usuários e acompanhamento de status.
- Painel separado para candidato e empresa.
- Validação de dados no navegador e na API.
- Limite de tentativas de login/cadastro e cabeçalhos de segurança.
- GitHub Actions para verificar a sintaxe JavaScript a cada atualização.

## Requisitos

- Node.js 20 ou superior.
- PostgreSQL (Neon ou outra hospedagem compatível).

## Configuração local

1. Clone o repositório e entre na pasta:
   ```bash
   git clone https://github.com/mateusgoncalves2008/Conecta-Trabalho.git
   cd Conecta-Trabalho
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie um banco PostgreSQL e execute todo o conteúdo de `database/schema.sql` nele.
4. Copie `.env.example` para um arquivo chamado `.env`.
5. Preencha `DATABASE_URL` com a conexão do PostgreSQL e defina `SESSION_SECRET` com uma chave aleatória longa (mínimo 32 caracteres).
6. Para habilitar cadastro empresarial, configure `GMAIL_USER` com o endereço Gmail remetente e `GMAIL_APP_PASSWORD` com a senha de app de 16 caracteres. Nunca compartilhe essa senha nem a envie ao GitHub.
7. Se o banco já existia, execute `database/migration_empresa_verificacao.sql` nele antes de iniciar a nova versão.
8. Inicie:
   ```bash
   npm start
   ```
9. Acesse http://localhost:3000.

### Teste local do cadastro empresarial sem CNPJ

No `.env` local, mantenha `NODE_ENV=development` e defina `COMPANY_CNPJ_TEST_MODE=true`. Reinicie o servidor. A tela de cadastro empresarial dispensará o CNPJ e usará dados fictícios, mas continuará enviando o código para o e-mail informado. Esse modo só funciona em desenvolvimento; em produção ele fica desativado mesmo que a variável esteja configurada. Antes de publicar, mantenha `COMPANY_CNPJ_TEST_MODE=false`.

## Variáveis de ambiente

- `PORT`: porta HTTP (padrão 3000).
- `NODE_ENV`: use `production` no ambiente publicado.
- `DATABASE_URL`: string de conexão PostgreSQL.
- `SESSION_SECRET`: segredo usado para assinar a sessão.
- `GMAIL_USER`: endereço Gmail usado para enviar os códigos de confirmação.
- `GMAIL_APP_PASSWORD`: senha de app do Google usada pelo Nodemailer. Mantenha-a somente no `.env` local ou nas variáveis protegidas da hospedagem.
- `COMPANY_CNPJ_TEST_MODE`: use `true` somente no `.env` local, junto de `NODE_ENV=development`, para testar o cadastro empresarial sem consultar um CNPJ real. O modo é automaticamente desativado quando `NODE_ENV=production`.

## Publicação

Configure no serviço de hospedagem:
- Build command: `npm install`
- Start command: `npm start`
- Variáveis `DATABASE_URL`, `SESSION_SECRET` e `NODE_ENV=production`.

Antes de abrir o site, execute `database/schema.sql` no banco de produção. Nunca envie o arquivo `.env` ao GitHub.

## Verificação

Execute `npm run check` para verificar a sintaxe dos arquivos JavaScript. O GitHub Actions executa a verificação automaticamente em commits e pull requests para a branch `main`.

## Observação

Este é o primeiro MVP funcional. Antes de usar com dados reais, configure domínio e HTTPS na hospedagem, faça testes completos e publique uma política de privacidade e termos de uso.
