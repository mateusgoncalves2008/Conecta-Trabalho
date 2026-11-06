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
6. Para habilitar cadastro empresarial, configure `RESEND_API_KEY` e `EMAIL_FROM` com um remetente/domínio autorizado no Resend.
7. Se o banco já existia, execute `database/migration_empresa_verificacao.sql` nele antes de iniciar a nova versão.
8. Inicie:
   ```bash
   npm start
   ```
9. Acesse http://localhost:3000.

## Variáveis de ambiente

- `PORT`: porta HTTP (padrão 3000).
- `NODE_ENV`: use `production` no ambiente publicado.
- `DATABASE_URL`: string de conexão PostgreSQL.
- `SESSION_SECRET`: segredo usado para assinar a sessão.
- `RESEND_API_KEY`: chave da API Resend usada para enviar códigos de confirmação do cadastro empresarial.
- `EMAIL_FROM`: remetente autorizado no Resend, por exemplo `ConectaTrabalho <cadastro@seudominio.com.br>`.

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
