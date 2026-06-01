# Deploy Vercel + Railway

## Frontend na Vercel

Projeto raiz:
- Root Directory: repositório raiz
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Variáveis de ambiente:
- `VITE_API_BASE_URL=https://SEU-BACKEND.up.railway.app/api`

## Backend no Railway

Projeto:
- Root Directory: `backend`
- Start Command: `npm start`

Variáveis de ambiente:
- `DATABASE_URL=sqlserver://...`
- `JWT_SECRET=...`
- `ALLOWED_ORIGINS=https://SEU-FRONTEND.vercel.app`
- `PORT=3000`

## Ordem recomendada

1. Publicar backend no Railway
2. Copiar URL pública do backend
3. Configurar `VITE_API_BASE_URL` na Vercel
4. Publicar frontend na Vercel
5. Atualizar `ALLOWED_ORIGINS` no Railway com o domínio final da Vercel
6. Fazer novo deploy do backend

## Notas

- O frontend já deixou de depender de `localhost`
- As imagens passam a usar o mesmo domínio base do backend definido em `VITE_API_BASE_URL`
- O backend continua preparado para SQL Server, não para Supabase/Postgres
