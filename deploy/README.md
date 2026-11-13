# Gerador de Propostas Victory — versão Netlify

App de uma página para montar propostas comerciais da Victory Hotéis e baixar
em **PDF**. As fotos (por tipo de quarto/refeição), a logomarca e as propostas
salvas ficam guardadas no próprio Netlify (recurso **Netlify Blobs**) e
aparecem para qualquer pessoa que acessar o site.

## O que tem na pasta

```
public/index.html                -> a página (abas de perguntas + prévia)
public/app.js                    -> toda a lógica (cálculos, prévia, geração do PDF)
public/assets/victory-logo.png   -> logomarca oficial (usada quando não há upload)
public/fonts/InstrumentSans.ttf  -> tipografia da marca, servida localmente
netlify/functions/photos.mjs     -> guarda/lista/apaga fotos
netlify/functions/logo.mjs       -> guarda a logomarca
netlify/functions/proposals.mjs  -> salva/abre/apaga propostas
netlify/functions/_lib.mjs       -> funções auxiliares
netlify.toml, package.json       -> configuração do Netlify
```

Como ele usa **Netlify Functions**, não dá para arrastar a pasta no
netlify.com/drop — isso publica só os arquivos estáticos, sem as funções. O
caminho que funciona com tudo é pelo GitHub, abaixo.

## Passo a passo

### 1. Colocar os arquivos no GitHub

1. Crie uma conta gratuita em [github.com](https://github.com) se ainda não tiver.
2. Clique em **New repository**, dê um nome (ex.: `victory-propostas`), deixe
   como **Private** se preferir, e crie.
3. Na página do repositório, use **Add file → Upload files** e arraste todo o
   conteúdo desta pasta, mantendo a estrutura (`public/...`,
   `netlify/functions/...`). Confirme o commit.

> Ao arrastar pastas, confira que `public/assets/victory-logo.png` e
> `public/fonts/InstrumentSans.ttf` subiram — sem eles o logo e a tipografia
> da marca não aparecem.

### 2. Conectar ao Netlify

1. Crie uma conta gratuita em [netlify.com](https://netlify.com).
2. No painel, **Add new site → Import an existing project**.
3. Escolha **GitHub**, autorize o acesso e selecione o repositório.
4. O `netlify.toml` já define pasta publicada = `public` e funções =
   `netlify/functions`. Não precisa mexer em nada — clique em **Deploy**.
5. Em 1–2 minutos o site estará no ar, num endereço como
   `https://nome-aleatorio.netlify.app`. Renomeie em **Site configuration →
   Domain management → Options → Edit site name**.

Netlify Blobs funciona automaticamente depois do primeiro deploy.

### 3. (Recomendado) Proteger o site com senha

Sem isso, qualquer pessoa com o link pode usar o app e ver, editar ou apagar
as fotos e propostas salvas.

1. **Site configuration → Environment variables → Add a variable**.
2. Nome: `APP_PASSWORD` — Valor: a senha que você quiser.
3. Salve e vá em **Deploys → Trigger deploy → Deploy site**.
4. Ao abrir o site, ele pede a senha uma vez (fica guardada no navegador).

### 4. Usar o app

Abas: **Dados**, **Hospedagem**, **Alimentação & Eventos**, **Condições**,
**Fotos** e **Minhas propostas**. A prévia atualiza à direita enquanto você
preenche. **Baixar PDF** gera o arquivo; **Salvar** guarda a proposta.

Na aba **Fotos** dá para subir a logomarca e fotos por categoria. Cada linha
de hospedagem ou alimentação escolhe uma foto de referência, que aparece numa
faixa logo abaixo da seção correspondente — na prévia e no PDF — com nome e
categoria na legenda.

## Testar no computador antes de publicar (opcional)

```bash
npm install -g netlify-cli   # só na primeira vez
cd deploy                     # esta pasta
npm install
netlify dev                   # abre em http://localhost:8888
```

Para publicar direto do terminal, sem GitHub:

```bash
netlify login
netlify init
netlify deploy --prod
```

## Identidade visual

O app segue o sistema Victory Hotéis: preto `#0A0A0A` sobre bone `#F4F1EC`,
navy `#1B2F66` (Victory Business) nos títulos de seção, tabelas e no botão
principal, e sky `#0099D9` (Victory Suítes) nos marcadores. Tipografia
Instrument Sans, servida da própria pasta — sem depender do Google Fonts.

## Observações

- O PDF é gerado no próprio navegador (jsPDF/autoTable).
- Desconto aplicado sobre a tarifa de tabela, depois a regra de imposto
  escolhida (ISS 5%, já incluso, "+ impostos" sem percentual, ou isento).
- O upload de fotos ainda envia o arquivo no tamanho original. Fotos de
  celular (5–8 MB) deixam o PDF pesado — vale reduzir antes de enviar.
- Domínio próprio (ex.: propostas.victoryhoteis.com): **Site configuration →
  Domain management → Add a domain**.
