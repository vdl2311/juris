# Checklist: por que exclusões/criações "só aparecem na tela"

## 1. O que eu já corrigi no código (`App.tsx`)

O problema principal era um padrão repetido no frontend: a tela era atualizada
como se a operação tivesse dado certo **antes** de confirmar que o backend
(Firestore) realmente gravou/apagou o registro. Quando a gravação real falhava,
o erro só ia pro console do navegador — você nunca via aviso nenhum, e ao
recarregar a página os dados reais (do servidor) voltavam como se nada tivesse
mudado.

Funções corrigidas para só considerar "sucesso" depois de confirmação real,
e reverter a tela + mostrar um toast de erro quando a gravação falha de verdade:

- `deleteTarefa` — não revertia nem avisava em caso de falha dupla (backend E Firestore).
- `deleteHonorario` — idem.
- `deleteDespesa` — idem.
- `deleteDocumento` — idem.
- `criar` (novo usuário) — antes gerava um ID local (`Date.now()`) e tentava
  gravar em dois lugares em paralelo (Firestore direto do navegador + backend),
  escondendo qualquer erro. Agora só o backend (que usa o Firebase Admin SDK e
  o contador de ID sequencial correto) cria o registro; se falhar, nada é
  adicionado na tela e você vê o motivo do erro.
- `excluir` (usuário) — mesma lógica: agora tenta o backend primeiro, cai para
  Firestore direto só como contingência, e se as duas vias falharem, mostra erro
  e não remove nada da tela.

`deleteCliente`, `deleteProcesso` e `deleteEvento` já tinham a lógica de reverter
+ avisar em caso de falha; não precisaram de mudança.

**Arquivo corrigido:** `App.tsx` (anexado). Substitua o arquivo `src/App.tsx`
do seu repositório por este e faça o commit/push normalmente.

## 2. O que só você consegue verificar: variáveis de ambiente no Vercel

O backend (`server.ts`) depende destas variáveis de ambiente. Se alguma estiver
faltando ou errada, toda escrita no Firestore falha silenciosamente (o backend
até responde erro 500, mas — antes da correção — o frontend escondia isso):

| Variável | Para que serve | Onde conferir |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Credencial do Firebase Admin SDK (JSON completo da service account). **Sem ela, o Admin SDK sobe sem credenciais válidas e toda escrita no Firestore falha.** | Vercel → Project → Settings → Environment Variables |
| `GEMINI_API_KEY` | Usada pelas rotas `/api/ia/*` (resumo, geração de documento, chat, etc.) | idem |
| `NODE_ENV` | O Vercel já define isso como `production` automaticamente — não precisa configurar. | — |
| `VERCEL` | Também definida automaticamente pelo Vercel. | — |

### Como conferir se o `FIREBASE_SERVICE_ACCOUNT` está correto

1. No Vercel, vá em **Settings → Environment Variables** e confira se `FIREBASE_SERVICE_ACCOUNT` existe para o ambiente **Production** (e Preview, se usar).
2. O valor deve ser o **JSON inteiro** da service account (baixado do Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada), colado como uma única linha/string.
3. Depois de configurar ou alterar uma env var no Vercel, é preciso fazer um **novo deploy** (redeploy) — só salvar a variável não atualiza os deployments já existentes.
4. O sistema tem uma rota de diagnóstico própria: acesse `/api/firebase-status` no seu domínio do Vercel (ex: `https://seu-app.vercel.app/api/firebase-status`). Ela retorna se o Admin SDK foi inicializado com credenciais (`hasServiceAccount`) e outros detalhes do estado da conexão.
5. Veja os logs da função no painel do Vercel (aba **Logs** do projeto, ou `vercel logs`) procurando por linhas que comecem com `[FIREBASE]` — elas indicam claramente se a inicialização falhou ou se uma gravação específica deu erro.

## 3. Resumo do que fazer agora

1. Substitua `src/App.tsx` pelo arquivo corrigido, commit e push (o Vercel faz redeploy automático).
2. Confirme no painel do Vercel que `FIREBASE_SERVICE_ACCOUNT` está configurada corretamente para Production.
3. Force um redeploy depois de qualquer mudança de env var.
4. Teste excluir um cliente/usuário — agora, se falhar de verdade, vai aparecer um toast vermelho de erro em vez de sumir silenciosamente.
5. Se aparecer o erro, confira `/api/firebase-status` e os logs do Vercel para ver a mensagem exata do Firebase.
