# ConectaTrabalho

**Conectando talentos a oportunidades.**

O **ConectaTrabalho** é uma plataforma digital de empregabilidade criada para aproximar pessoas que procuram trabalho de empresas que precisam divulgar oportunidades e encontrar profissionais.

O projeto começou com foco em **Capelinha, Minas Gerais, e cidades próximas**, considerando a realidade de quem procura uma oportunidade na região e de empresas que precisam divulgar suas vagas. A proposta também foi pensada para permitir uma expansão futura para outras regiões.

> Este projeto foi desenvolvido como trabalho do **Curso Técnico em Informática**, com o objetivo de aplicar conhecimentos de desenvolvimento web, programação, banco de dados, segurança da informação e organização de sistemas em uma solução para um problema social.

---

## 1. O problema que motivou o projeto

Encontrar uma oportunidade de trabalho nem sempre é simples. Candidatos podem ter dificuldade para descobrir quais empresas estão contratando, onde estão as vagas, quais são os requisitos e como demonstrar interesse. Ao mesmo tempo, empresas podem ter dificuldade para divulgar oportunidades e alcançar pessoas que tenham interesse e qualificação para elas.

Em cidades do interior e regiões próximas, essas informações podem ficar espalhadas em diferentes canais, como redes sociais, indicações, grupos de mensagens e anúncios. Isso pode fazer com que uma oportunidade não chegue a todos os candidatos que poderiam se interessar por ela.

O ConectaTrabalho nasceu da percepção desse problema: **faltava uma forma centralizada e acessível de aproximar candidatos e empresas, facilitando a divulgação e a busca por oportunidades de emprego.**

### Delimitação do problema

A situação descrita representa a motivação e a hipótese que orientaram o desenvolvimento do projeto. Ela não deve ser interpretada como resultado de uma pesquisa de campo formal ou de entrevistas com empresas e candidatos. Uma etapa futura importante é conversar com usuários e organizações da região para validar necessidades, identificar dificuldades adicionais e orientar novas funcionalidades.

---

## 2. Objetivo do ConectaTrabalho

Criar um ambiente digital no qual:

- Candidatos possam encontrar oportunidades de acordo com seus interesses e localização.
- Empresas possam divulgar vagas e acompanhar as candidaturas recebidas.
- As informações das oportunidades fiquem organizadas em um só lugar.
- O processo de aproximação entre quem oferece e quem procura trabalho seja mais simples e acessível.

### Objetivos específicos

1. Disponibilizar cadastro e autenticação para candidatos e empresas.
2. Permitir que empresas publiquem, pausem e encerrem vagas.
3. Permitir a pesquisa de vagas por palavras-chave e cidade.
4. Oferecer páginas de perfil para candidatos e empresas.
5. Permitir que candidatos enviem candidaturas e acompanhem seu andamento.
6. Permitir que candidatos salvem oportunidades para consultar depois.
7. Oferecer às empresas ferramentas para acompanhar candidaturas e atualizar seus status.
8. Aplicar práticas de segurança e organização no armazenamento dos dados.

---

## 3. Benefícios esperados

### Para candidatos

- **Mais facilidade para encontrar vagas:** pesquisa por termos e cidade.
- **Informações organizadas:** detalhes, requisitos, modalidade e tipo de contrato em cada oportunidade.
- **Acompanhamento:** consulta às candidaturas e aos seus status.
- **Organização pessoal:** possibilidade de salvar vagas para consultar posteriormente.
- **Apresentação profissional:** perfil com informações sobre experiências, formação, competências e objetivos.
- **Acesso digital:** possibilidade de consultar a plataforma por dispositivos com navegador e conexão à internet.

### Para empresas

- **Divulgação centralizada:** publicação de oportunidades em uma plataforma própria.
- **Organização:** gerenciamento de vagas abertas, pausadas e encerradas.
- **Acompanhamento:** visualização das candidaturas recebidas.
- **Comunicação mais clara:** apresentação de informações institucionais e do perfil da empresa.
- **Alcance regional:** possibilidade de divulgar oportunidades para candidatos de Capelinha e cidades próximas.

### Para a sociedade

- Facilitar a circulação de informações sobre oportunidades de trabalho.
- Aproximar pessoas e organizações que talvez não se encontrassem pelos canais tradicionais.
- Contribuir para tornar a busca por emprego mais organizada.
- Incentivar o acesso às oportunidades sem restringir a plataforma a uma única área profissional.

A plataforma busca ampliar o acesso à informação. Ela não garante contratação, não substitui processos seletivos das empresas e não elimina, sozinha, as desigualdades existentes no mercado de trabalho.

---

## 4. Público-alvo e abrangência

O público principal é formado por:

- Pessoas que procuram o primeiro emprego.
- Profissionais que desejam mudar de trabalho ou buscar novas oportunidades.
- Pessoas em busca de estágio, aprendizagem, trabalho temporário ou outras modalidades.
- Empresas e organizações que precisam divulgar vagas.

**Abrangência atual do projeto:** Capelinha/MG e cidades próximas.

**Visão de futuro:** ampliar gradualmente a cobertura para outras cidades, estados e, futuramente, outros países, mantendo a proposta de facilitar o encontro entre candidatos e oportunidades de diferentes setores e níveis profissionais.

---

## 5. Funcionalidades implementadas

### 5.1. Acesso e contas

- Cadastro de contas de candidato e empresa.
- Login e encerramento de sessão.
- Senhas armazenadas com hash bcrypt, em vez de texto puro.
- Sessões armazenadas no PostgreSQL.
- Controle de acesso conforme o tipo de conta.
- Limitação de tentativas em operações sensíveis.

### 5.2. Cadastro e verificação de empresas

- Formulário de cadastro empresarial.
- Consulta de CNPJ por serviço externo.
- Verificação da situação cadastral retornada pela consulta.
- Envio de código de confirmação por e-mail.
- Código de confirmação com prazo de validade e limite de tentativas.
- Modo de teste local para desenvolver o cadastro sem consultar um CNPJ real. Esse modo depende de ambiente de desenvolvimento e não deve ser utilizado em produção.

### 5.3. Vagas

- Listagem de oportunidades disponíveis.
- Pesquisa por palavra-chave e cidade.
- Página com detalhes da vaga.
- Exibição de descrição, requisitos, modalidade, tipo de contrato, cidade e remuneração informada.
- Publicação de vagas por empresas.
- Possibilidade de pausar e encerrar vagas.

### 5.4. Candidaturas

- Envio de candidatura por usuários do tipo candidato.
- Impedimento de candidatura por contas empresariais.
- Prevenção de candidaturas duplicadas para a mesma vaga.
- Acompanhamento do status da candidatura.
- Atualização do andamento pela empresa.

Os status previstos no sistema são: recebida, em análise, entrevista, aprovada e rejeitada.

### 5.5. Perfis

- Painel do candidato.
- Painel da empresa.
- Informações profissionais do candidato, como resumo, objetivo, experiências, formação e competências.
- Informações institucionais da empresa, como site, setor e porte.
- Foto de perfil e banner.
- Galeria de imagens para empresas.
- Configuração de visibilidade da foto de perfil do candidato.

### 5.6. Vagas salvas

- Salvar oportunidades de interesse.
- Consultar a lista de vagas salvas.
- Remover oportunidades salvas.

### 5.7. Experiência e acessibilidade

- Interface adaptável a diferentes tamanhos de tela.
- Recursos de acessibilidade e preferências de apresentação.
- Alternância entre temas visuais.
- Aplicação web progressiva (PWA), com estrutura de arquivos para instalação compatível e suporte básico a uma página offline.
- Elementos de navegação e páginas institucionais, como Sobre, Como funciona, Central de ajuda, Acessibilidade e Termos e privacidade.

---

## 6. Tecnologias utilizadas

| Tecnologia | Utilização |
|---|---|
| HTML5 | Estrutura das páginas |
| CSS3 | Aparência, responsividade e organização visual |
| JavaScript | Interações do navegador e comunicação com a API |
| Node.js | Ambiente de execução do servidor |
| Express | Servidor web e rotas da API |
| PostgreSQL | Banco de dados relacional |
| Neon | Hospedagem do PostgreSQL e serviço de armazenamento de objetos compatível com S3 |
| bcryptjs | Hash de senhas |
| express-session | Gerenciamento de sessões |
| connect-pg-simple | Armazenamento das sessões no PostgreSQL |
| Helmet | Cabeçalhos e proteções HTTP |
| express-rate-limit | Limitação de requisições |
| Nodemailer | Envio de códigos de confirmação por e-mail |
| AWS SDK for JavaScript (S3) | Integração com armazenamento de imagens compatível com S3 |
| BrasilAPI | Consulta de dados de CNPJ |
| Git e GitHub | Versionamento e hospedagem do código |
| GitHub Actions | Verificações automatizadas do projeto |
| Vercel e Render | Camadas de publicação da aplicação |

O projeto utiliza **JavaScript com CommonJS** no backend. O frontend é formado por arquivos HTML, CSS e JavaScript, sem depender de um framework de interface para renderizar as páginas.

---

## 7. Como o sistema funciona

De forma resumida, o fluxo da plataforma é:

1. O usuário acessa o site pelo navegador.
2. O frontend apresenta as páginas e formulários.
3. Quando necessário, o JavaScript envia uma requisição HTTP para a API.
4. O servidor Express valida os dados e verifica a sessão e as permissões.
5. O backend consulta ou altera os registros no PostgreSQL.
6. Quando há imagens, o backend utiliza o armazenamento de objetos configurado.
7. O resultado retorna ao navegador em formato JSON, e a interface atualiza as informações.

### Arquitetura resumida

```text
Usuário
  |
  v
Navegador (HTML, CSS e JavaScript)
  |
  v
Frontend publicado na Vercel
  |
  | Requisições /api
  v
Backend Node.js + Express (Render)
  |
  +------> PostgreSQL (Neon)
  |
  +------> Object Storage compatível com S3 (imagens)
  |
  +------> Gmail / Nodemailer (confirmação de e-mail)
  |
  +------> BrasilAPI (consulta de CNPJ)
```

A configuração atual de rotas da Vercel encaminha as requisições iniciadas por `/api/` para o servidor backend configurado no Render. O frontend e a API são partes diferentes da aplicação, embora trabalhem em conjunto.

---

## 8. Estrutura do projeto

A organização do repositório separa o backend, o frontend, o banco de dados e os arquivos de automação.

```text
Conecta-Trabalho/
|
|-- .github/
|   |-- workflows/
|       |-- ci.yml
|
|-- backend/
|   |-- models/
|   |   |-- __tests__/
|   |   |   |-- models.test.js
|   |   |-- Candidato.js
|   |   |-- Candidatura.js
|   |   |-- Empresa.js
|   |   |-- Usuario.js
|   |   |-- Vaga.js
|   |
|   |-- server.js
|
|-- database/
|   |-- migration_empresa_verificacao.sql
|   |-- schema.sql
|
|-- frontend/
|   |-- css/
|   |   |-- acessibilidade.css
|   |   |-- aplicativo.css
|   |   |-- cadastro.css
|   |   |-- central-ajuda.css
|   |   |-- como-funciona.css
|   |   |-- footer-pages.css
|   |   |-- global.css
|   |   |-- home.css
|   |   |-- login.css
|   |   |-- offline.css
|   |   |-- paineis.css
|   |   |-- publicidade.css
|   |   |-- sobre.css
|   |   |-- solucoes-corporativas.css
|   |   |-- termos-privacidade.css
|   |
|   |-- img/
|   |   |-- como-funciona/
|   |   |-- inicio/
|   |   |-- institucional/
|   |   |-- login/
|   |   |-- logo-conectatrabalho.svg
|   |   |-- pwa-192.svg
|   |   |-- pwa-512.svg
|   |
|   |-- js/
|   |   |-- cadastro.js
|   |   |-- empresa-perfil.js
|   |   |-- empresa-vagas.js
|   |   |-- login.js
|   |   |-- main.js
|   |   |-- paineis.js
|   |   |-- vaga-detalhes.js
|   |   |-- vagas.js
|   |
|   |-- pages/
|   |   |-- acessibilidade.html
|   |   |-- aplicativo.html
|   |   |-- cadastro.html
|   |   |-- candidato.html
|   |   |-- central-ajuda.html
|   |   |-- como-funciona.html
|   |   |-- empresa-perfil.html
|   |   |-- empresa-vagas.html
|   |   |-- empresa.html
|   |   |-- login.html
|   |   |-- mais.html
|   |   |-- publicidade.html
|   |   |-- sobre.html
|   |   |-- solucoes-corporativas.html
|   |   |-- termos-privacidade.html
|   |   |-- vaga-detalhes.html
|   |   |-- vagas.html
|   |
|   |-- manifest.webmanifest
|   |-- offline.html
|   |-- service-worker.js
|
|-- index.html
|-- .env.example
|-- .gitignore
|-- package.json
|-- package-lock.json
|-- vercel.json
|-- README.md
```

### Responsabilidade das principais pastas e arquivos

- **`backend/`**: contém o servidor e as regras executadas no lado do servidor.
- **`backend/server.js`**: configura o Express, conexão com o banco, sessões, autenticação, rotas da API e integrações externas.
- **`backend/models/`**: organiza as classes e validações de usuário, candidato, empresa, vaga e candidatura.
- **`database/`**: contém o esquema SQL e a migração relacionada à verificação de empresas.
- **`frontend/pages/`**: reúne as páginas HTML internas do site.
- **`frontend/css/`**: reúne os estilos visuais.
- **`frontend/js/`**: contém os scripts responsáveis pelas interações e funcionalidades do frontend.
- **`frontend/img/`**: armazena logotipos, ilustrações e imagens utilizadas na interface.
- **`frontend/service-worker.js`**: controla o cache dos recursos básicos e o comportamento offline da PWA.
- **`frontend/manifest.webmanifest`**: define as informações de instalação da aplicação.
- **`index.html`**: página inicial servida na rota principal.
- **`vercel.json`**: define os redirecionamentos e rewrites utilizados na publicação pela Vercel.
- **`.env.example`**: exemplo das variáveis de ambiente necessárias para configuração local, sem credenciais reais.

---

## 9. Banco de dados

O banco de dados utilizado é o PostgreSQL. O esquema principal está em `database/schema.sql`.

As principais entidades são:

| Tabela | Finalidade |
|---|---|
| `usuarios` | Dados de acesso, identificação e perfil de candidatos e empresas |
| `vagas` | Oportunidades publicadas pelas empresas |
| `candidaturas` | Relação entre candidatos e vagas, incluindo o status do processo |
| `vagas_salvas` | Oportunidades que o candidato guardou para consultar depois |
| `cadastros_empresa_pendentes` | Cadastros empresariais que aguardam a confirmação do e-mail |
| `sessoes` | Sessões de acesso armazenadas pelo mecanismo de sessão do PostgreSQL |
| `fotos_empresa` | Referências às imagens da galeria de cada empresa |

O backend também possui rotinas para preparar campos complementares de perfil e índices necessários ao funcionamento das funcionalidades.

### Relacionamentos principais

- Uma empresa pode publicar várias vagas.
- Uma vaga pertence a uma empresa.
- Um candidato pode enviar candidaturas para várias vagas.
- Uma vaga pode receber candidaturas de diferentes candidatos.
- A combinação de candidato e vaga é única na tabela de candidaturas.
- Um candidato pode salvar várias vagas, sem salvar a mesma vaga duas vezes.

---

## 10. Segurança e proteção de dados

O projeto incorpora mecanismos técnicos de segurança, entre eles:

- Hash de senhas com bcryptjs.
- Segredo de sessão obrigatório, com tamanho mínimo validado pelo servidor.
- Cookies de sessão com configurações de segurança.
- Armazenamento das sessões no PostgreSQL.
- Controle de acesso a rotas conforme o tipo de usuário.
- Limitação de requisições em operações sensíveis.
- Cabeçalhos de segurança HTTP com Helmet.
- Limitação do tamanho de requisições.
- Validação e normalização de dados recebidos pela API.
- Validação do tipo e da estrutura de arquivos de imagem.
- Proteção das credenciais por variáveis de ambiente.

**Importante:** a presença desses mecanismos não significa que o sistema esteja livre de vulnerabilidades ou pronto para operar sem avaliação. Antes de utilizar dados reais, é necessário testar os fluxos completos, revisar as configurações de produção, proteger as credenciais, publicar política de privacidade e termos adequados e observar as obrigações legais aplicáveis, incluindo a LGPD.

---

## 11. Como executar o projeto localmente

### Requisitos

- Node.js 20 ou superior.
- npm.
- Banco de dados PostgreSQL acessível.
- Git (opcional, para clonar o repositório).

### Instalação

1. Clone o repositório:

   ```bash
   git clone https://github.com/mateusgoncalves2008/Conecta-Trabalho.git
   ```

2. Entre na pasta:

   ```bash
   cd Conecta-Trabalho
   ```

3. Instale as dependências:

   ```bash
   npm install
   ```

4. Crie um banco PostgreSQL e execute o arquivo `database/schema.sql` nele.

5. Copie `.env.example` para um arquivo chamado `.env`.

6. Configure as variáveis de ambiente descritas abaixo.

7. Inicie o servidor:

   ```bash
   npm start
   ```

8. Acesse no navegador:

   ```text
   http://localhost:3000
   ```

Para desenvolvimento com reinicialização automática do servidor, utilize:

```bash
npm run dev
```

### Migração de banco existente

Se o banco já tiver sido criado por uma versão anterior do projeto, verifique a estrutura atual antes de aplicar alterações. A migração de verificação empresarial está em:

```text
database/migration_empresa_verificacao.sql
```

Execute a migração no banco correspondente antes de utilizar a versão que depende dessas alterações. Faça backup antes de alterar um banco com dados importantes.

---

## 12. Variáveis de ambiente

As variáveis abaixo devem ser configuradas no arquivo `.env` local ou no painel seguro da hospedagem.

| Variável | Finalidade |
|---|---|
| `PORT` | Porta do servidor (padrão: 3000) |
| `NODE_ENV` | Ambiente de execução; use `production` na publicação |
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `SESSION_SECRET` | Chave aleatória longa usada para proteger as sessões; mínimo de 32 caracteres |
| `GMAIL_USER` | Conta Gmail usada como remetente dos códigos |
| `GMAIL_APP_PASSWORD` | Senha de aplicativo do Gmail usada pelo Nodemailer |
| `COMPANY_CNPJ_TEST_MODE` | Habilita o modo de teste de CNPJ somente em desenvolvimento |
| `AWS_ENDPOINT_URL_S3` | Endpoint do armazenamento de objetos compatível com S3 |
| `AWS_ACCESS_KEY_ID` | Identificador de acesso ao armazenamento |
| `AWS_SECRET_ACCESS_KEY` | Chave secreta do armazenamento |
| `AWS_REGION` | Região configurada para o armazenamento |

As quatro variáveis `AWS_*` são necessárias para habilitar os recursos de armazenamento de imagens. Sem essa configuração, os recursos que dependem do Object Storage não poderão concluir os envios.

### Modo de teste de CNPJ

Para testar localmente o cadastro empresarial sem consultar um CNPJ real:

- Defina `NODE_ENV=development`.
- Defina `COMPANY_CNPJ_TEST_MODE=true`.
- Reinicie o servidor.

Esse modo é restrito ao desenvolvimento. Em produção, a aplicação o desativa. Não utilize dados fictícios para cadastrar empresas reais.

### Cuidados com credenciais

- Nunca envie o arquivo `.env` ao GitHub.
- Nunca coloque senhas, tokens ou chaves secretas diretamente no código.
- Utilize variáveis protegidas no painel da hospedagem.
- Não compartilhe a senha de aplicativo do Gmail nem as credenciais do armazenamento.

---

## 13. Testes e verificações

O projeto utiliza os recursos nativos de teste do Node.js.

Executar os testes automatizados:

```bash
npm test
```

Verificar a sintaxe do backend e dos arquivos JavaScript do frontend:

```bash
npm run check
```

O comando `npm run check` utiliza ferramentas de linha de comando como `find` e `xargs`; em Windows, execute-o por um ambiente compatível, como Git Bash ou WSL, ou utilize a verificação automatizada do GitHub Actions.

O fluxo em `.github/workflows/ci.yml` instala as dependências e executa a verificação de sintaxe em ambiente Ubuntu quando há atualização ou pull request direcionado à branch `main`.

Os testes automatizados atualmente presentes em `backend/models/__tests__/models.test.js` verificam regras e comportamentos das classes de modelo. Eles não substituem testes completos de navegador, integração com serviços externos ou testes reais de publicação.

---

## 14. Publicação e hospedagem

A arquitetura de publicação prevista separa o frontend do backend:

- **Vercel:** entrega do frontend e encaminhamento das rotas da API.
- **Render:** execução do servidor Node.js/Express.
- **Neon:** banco PostgreSQL e armazenamento de objetos, quando configurado.

O arquivo `vercel.json` encaminha as requisições `/api/*` para o endereço do backend configurado e direciona os caminhos do frontend para a pasta `frontend/`.

No serviço que executa o backend, configure:

- Comando de instalação: `npm install`.
- Comando de inicialização: `npm start`.
- Versão do Node.js compatível com a exigência do projeto.
- Variáveis de ambiente de produção.
- Conexão com o banco de dados e armazenamento de imagens.

Antes de considerar a publicação pronta, confira se as variáveis estão configuradas, se o banco possui o esquema necessário, se o envio de e-mail funciona e se os fluxos de cadastro, login, publicação de vagas, candidaturas e imagens foram testados no ambiente publicado.

---

## 15. Limitações e próximos passos

O ConectaTrabalho é um projeto em evolução. Algumas etapas importantes para seu amadurecimento são:

1. Conversar com candidatos e empresas para validar as necessidades que motivaram a plataforma.
2. Realizar testes de usabilidade com pessoas de diferentes níveis de familiaridade com tecnologia.
3. Executar testes de integração e ponta a ponta em todos os fluxos principais.
4. Validar o envio de e-mails e o armazenamento de imagens no ambiente de produção.
5. Revisar continuamente a segurança, a privacidade e a acessibilidade.
6. Preparar políticas e procedimentos adequados para tratamento de dados pessoais.
7. Ampliar gradualmente a cobertura geográfica e avaliar novas funcionalidades com base no retorno dos usuários.

---

## 16. Considerações finais

O ConectaTrabalho foi idealizado como uma aplicação prática dos conhecimentos adquiridos no Curso Técnico em Informática. Mais do que desenvolver páginas e funcionalidades, a proposta é utilizar a tecnologia para enfrentar uma dificuldade presente na sociedade: a distância entre quem procura uma oportunidade de trabalho e quem precisa encontrar profissionais.

A plataforma pretende contribuir para que a informação sobre vagas seja mais fácil de encontrar, para que empresas tenham um canal organizado de divulgação e para que candidatos possam acompanhar suas oportunidades em um só ambiente.

**A visão do projeto é crescer de forma responsável, ampliar o acesso às oportunidades e conectar pessoas e empresas de diferentes setores e regiões.**

---

## Repositório

Código-fonte: [github.com/mateusgoncalves2008/Conecta-Trabalho](https://github.com/mateusgoncalves2008/Conecta-Trabalho)
