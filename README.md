# Ironman Command Center

App de preparação para o IRONMAN 70.3 Curitiba-Paraná — banco de dados no
Supabase, hospedagem na Vercel, código no GitHub. Feito para você e seu
namorado acessarem com login (mais ninguém consegue entrar).

## O que você vai precisar (todos gratuitos)

- Conta no [Supabase](https://supabase.com)
- Conta no [GitHub](https://github.com)
- Conta na [Vercel](https://vercel.com)
- Uma chave de API da Anthropic em [console.anthropic.com](https://console.anthropic.com/settings/keys) (só necessária se quiser usar o AI Training Lab)

Tempo estimado: 15–20 minutos, uma única vez.

---

## Passo 1 — Criar o projeto no Supabase

1. Acesse supabase.com → **New project**. Escolha uma senha de banco (guarde-a) e a região mais próxima (South America).
2. Espere o projeto terminar de criar (~2 min).
3. Vá em **SQL Editor** → **New query**, cole todo o conteúdo do arquivo `supabase/schema.sql` deste projeto e clique em **Run**.
4. Vá em **Storage** → **New bucket** → nome exatamente `photos` → marque **Public bucket** → **Create bucket**.
5. Vá em **Project Settings → API**. Anote:
   - **Project URL** → vai virar `VITE_SUPABASE_URL`
   - **anon public key** → vai virar `VITE_SUPABASE_ANON_KEY`

## Passo 2 — Criar as duas contas de login

1. Ainda no Supabase, vá em **Authentication → Users → Add user** e crie um usuário para você (e-mail + senha) e outro para seu namorado. (Alternativa: deixe o cadastro aberto no app, cada um cria a própria conta pela tela de login na primeira vez.)
2. Depois que os dois já tiverem conta, vá em **Authentication → Providers → Email** e desative **"Allow new users to sign up"**. Isso impede que qualquer pessoa que ache o link do site consiga criar uma conta sozinha.

## Passo 3 — Colocar o código no GitHub

No terminal, dentro desta pasta do projeto:

```bash
git init
git add .
git commit -m "Ironman Command Center"
```

Crie um repositório novo (vazio, sem README) em github.com/new, depois:

```bash
git remote add origin https://github.com/SEU-USUARIO/ironman-command-center.git
git branch -M main
git push -u origin main
```

## Passo 4 — Publicar na Vercel

1. Em vercel.com → **Add New → Project** → importe o repositório que você acabou de criar.
2. A Vercel detecta automaticamente que é um projeto Vite. Antes de clicar em Deploy, abra **Environment Variables** e adicione:

   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | (do Passo 1) |
   | `VITE_SUPABASE_ANON_KEY` | (do Passo 1) |
   | `ANTHROPIC_API_KEY` | sua chave do console.anthropic.com |

3. Clique em **Deploy**. Em ~1 minuto você recebe uma URL tipo `ironman-command-center.vercel.app` — esse é o link para você e seu namorado usarem.

## Rodando localmente (opcional, antes de publicar)

```bash
npm install
cp .env.example .env   # preencha com seus valores
npm run dev
```

## Como os dados funcionam

- `sessions` e `recovery_logs`: uma linha por treino / por dia, sincronizadas com o Supabase a cada alteração — os dois acessam o mesmo plano, em tempo quase real (basta recarregar a página para ver o que o outro registrou).
- `photos`: os arquivos ficam no Supabase Storage (bucket `photos`); a tabela `photos` só guarda a URL e a categoria.
- Na primeira vez que alguém abre o app com o banco vazio, ele semeia automaticamente os dados de demonstração (marcados como `DEMO` na interface) — depois disso, os registros reais vão substituindo naturalmente conforme vocês treinam.
- O AI Training Lab chama sua própria função serverless (`api/claude.js`) em vez da API da Anthropic direto do navegador — isso é obrigatório fora do claude.ai, porque a chave de API não pode ficar exposta no código do navegador.

## Se algo não funcionar

- Tela de login não aparece / erro de conexão → confira se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão certos nas variáveis de ambiente da Vercel (e que você clicou em **Redeploy** depois de adicioná-las).
- Fotos não sobem → confira se o bucket `photos` existe e está **Public**.
- "Analisar com IA" não responde → confira se `ANTHROPIC_API_KEY` foi adicionada nas variáveis de ambiente da Vercel.
