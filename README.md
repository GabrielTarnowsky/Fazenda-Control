# FazendaControl

Sistema de gestão pecuária inteligente. Controle de animais, lotes, financeiro, rações, inseminações e pluviometria.

## Tecnologias

- React 18 + TypeScript + Vite
- Supabase (auth + banco de dados)
- Tailwind CSS + shadcn/ui
- PWA (instalável em dispositivos móveis)

## Como rodar localmente

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### Configuração

1. Clone o repositório:
   ```bash
   git clone https://github.com/GabrielTarnowsky/Fazenda-Control.git
   cd Fazenda-Control
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie o arquivo `.env` na raiz do projeto:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
   ```

4. Rode em modo desenvolvimento:
   ```bash
   npm run dev
   ```

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm test` | Roda os testes |
| `npm run lint` | Verifica o código com ESLint |

## Deploy

O projeto está configurado para deploy na Vercel (`vercel.json` incluso).
