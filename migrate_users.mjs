import { createClient } from '@supabase/supabase-js';

// SUBSTITUA PELAS SUAS CHAVES (Encontradas no Painel do Supabase -> Project Settings -> API)
const SUPABASE_URL = 'https://qlmlwiwccpoqyzpbgrup.supabase.co'; 
const SUPABASE_SERVICE_ROLE_KEY = 'SUA_CHAVE_SERVICE_ROLE_AQUI'; // IMPORTANTE: Use a service_role (secret), NÃO a anon (public).

if (SUPABASE_SERVICE_ROLE_KEY === 'SUA_CHAVE_SERVICE_ROLE_AQUI') {
  console.error('ERRO: Você precisa colar sua SUPABASE_SERVICE_ROLE_KEY no arquivo migrate_users.mjs antes de rodar.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrateUsers() {
  console.log('Iniciando migração de usuários...');
  
  // 1. Busca todos os usuários da tabela customizada antiga
  const { data: oldUsers, error: fetchError } = await supabase.from('users').select('*');
  
  if (fetchError) {
    console.error('Erro ao buscar usuários antigos:', fetchError);
    return;
  }

  if (!oldUsers || oldUsers.length === 0) {
     console.log('Nenhum usuário encontrado na tabela "users".');
     return;
  }

  console.log(`Encontrados ${oldUsers.length} usuários para migrar.`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of oldUsers) {
    console.log(`Migrando usuário: ${user.email} (ID: ${user.id})...`);
    
    // 2. Cria o usuário no Supabase Auth usando a Admin API
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      id: user.id, // MANTENDO O MESMO ID PARA NÃO PERDER NENHUM DADO DO SISTEMA
      email: user.email,
      password: 'Fazenda@2026', // Senha padrão para todos os antigos
      email_confirm: true, // Já confirma o email para evitar bloqueios
      user_metadata: {
        name: user.name,
        farm_name: user.farm_name
      }
    });

    if (createError) {
      if (createError.message.includes('already exists') || createError.message.includes('already registered')) {
        console.log(` -> Usuário ${user.email} já existe no Auth (provavelmente já foi migrado antes).`);
        successCount++;
      } else {
        console.error(` -> Erro ao migrar ${user.email}:`, createError.message);
        errorCount++;
      }
    } else {
      console.log(` -> Sucesso!`);
      successCount++;
    }
  }

  console.log('\n=== Resumo da Migração ===');
  console.log(`Total concluídos: ${successCount}`);
  console.log(`Erros: ${errorCount}`);
  console.log('\n*** INSTRUÇÃO IMPORTANTE ***');
  console.log('Avise os usuários: "O sistema foi atualizado para corrigir uma falha de segurança. A sua nova senha temporária é Fazenda@2026 e deve ser usada no seu próximo login."');
}

migrateUsers();
