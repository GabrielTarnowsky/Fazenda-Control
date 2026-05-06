import { supabase } from "./supabase";
import { toast } from "sonner";

// Helper to generate UUIDs locally if needed (though Supabase usually handles it)
// Standard UUID generator for Supabase compatibility
const v4 = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};


export interface Animal {
  id: string;
  tag: string;
  birth_date: string;
  sex: string;
  breed: string;
  weight: number;
  status: string;
  categoria: string;
  lote_id?: string;
  origem?: string;
  data_compra?: string;
  valor_compra?: number;
  preco_arroba?: number;
  peso_entrada?: number;
  peso_saida?: number;
  data_saida?: string;
  valor_venda?: number;
  matriz_id?: string;
  user_id?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  farm_name?: string;
  cpf?: string;
  password_hash?: string;
  salt?: string;
  createdAt: string;
}

export interface AnimalEvent {
  id: string;
  animal_id: string;
  type: string;
  date: string;
  description: string;
  value: number;
  weight: number;
  user_id?: string;
}

export interface Financial {
  id: string;
  type: string;
  description: string;
  value: number;
  date: string;
  animal_id?: string;
  category?: string;
  payment_method?: string;
  user_id?: string;
}

export interface Insemination {
  id: string;
  animal_id: string;
  date: string;
  bull: string;
  status: "prenha" | "vazia" | "aguardando" | "aborto";
  technician?: string;
  observation?: string;
  estimated_birth?: string;
  type?: string; // Preserved from original
  next_date?: string; // Preserved from original
  user_id?: string; // Preserved from original
  lot?: string;
  lote_id?: string;
  lote?: string;
  data_compra?: string;
  valor_compra?: number;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  user_id?: string; // Added for consistency with other interfaces
  updated_at?: string; // Added for consistency with upsert
}

export interface Health {
  id: string;
  animal_id: string;
  type: string;
  date: string;
  next_date: string;
  user_id?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  type: string;
  cost_per_kg: number;
  unit: string;
  stock?: number;
  pb?: number;  // Proteína Bruta (%)
  ndt?: number; // Nutrientes Digestíveis Totais (%)
  fdn?: number; // Fibra Detergente Neutro (%)
  user_id?: string;
}

export interface RationProduct {
  ingredient_id: string;
  percentage: number;
}

export interface Ration {
  id: string;
  name: string;
  products: RationProduct[];
  cost_per_kg: number;
  user_id?: string;
}

export interface IngredientPurchase {
  id: string;
  ingredient_id: string;
  date: string;
  unit_price: number;
  total_qty_kg: number;
  total_value: number;
  lote_id?: string;
  user_id?: string;
  payment_method?: string;
  cost_per_kg?: number;
}

export interface FeedingLog {
  id: string;
  ration_id: string;
  qty_per_day_kg: number;
  num_animals: number;
  days: number;
  total_consumption_kg: number;
  total_cost: number;
  date: string;
  lote_id: string;
}

export interface Rainfall {
  id: string;
  date: string;
  mm: number;
  user_id?: string;
}

export interface Rainfall {
  id: string;
  date: string;
  mm: number;
  user_id?: string;
}

// --- HELPERS ---

export const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "—";
  if (dateStr.includes("T")) dateStr = dateStr.split("T")[0];
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

export const parseDateSafe = (dateStr: string | null | undefined) => {
  if (!dateStr || dateStr.trim() === "") return new Date();
  try {
    if (dateStr.includes("T")) dateStr = dateStr.split("T")[0];
    const parts = dateStr.split("-");
    if (parts.length !== 3) return new Date();
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d);
  } catch {
    return new Date();
  }
};

// --- SECURITY: Hashing with SHA-256 + Salt ---
async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const usedSalt = salt || crypto.randomUUID();
  const encoder = new TextEncoder();
  const data = encoder.encode(usedSalt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash: hashHex, salt: usedSalt };
}

// Sanitização básica contra XSS
export function sanitizeString(str: string): string {
  if (!str) return str;
  return str.replace(/[<>]/g, '').trim(); // Remove < e > para evitar tags maliciosas
}

// Validação de senha forte
export function validatePasswordStrength(pass: string): string | null {
  if (pass.length < 6) return "A senha deve ter no mínimo 6 caracteres";
  return null; // Senha válida
}

// --- SESSION: Com expiração persistente ---
const SESSION_KEY = "bovi_session";
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

interface SessionData {
  userId: string;
  expiresAt: number;
}

function saveSession(userId: string) {
  const session: SessionData = {
    userId,
    expiresAt: Date.now() + SESSION_EXPIRY_MS
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: SessionData = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null; // Sessão expirada
    }
    return session.userId;
  } catch {
    return null;
  }
}

// Cache de perfil do usuário (SEM password_hash)
function loadUserProfile(): Omit<User, 'password_hash' | 'salt'> | null {
  try {
    const raw = localStorage.getItem("bovi_user_profile");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUserProfile(user: any) {
  // NUNCA salvar password_hash ou salt no cache local
  const { password_hash, salt, ...safeProfile } = user;
  localStorage.setItem("bovi_user_profile", JSON.stringify(safeProfile));
}

function clearUserProfile() {
  localStorage.removeItem("bovi_user_profile");
  // Limpar cache legado se existir
  localStorage.removeItem("bovi_users");
}

// --- DATA CACHE: Persistence for offline usage ---
const CACHE_PREFIX = "bovi_cache_";

function saveDataCache(key: string, data: any) {
  try {
    const user = auth.getCurrentUser();
    if (!user) return;
    localStorage.setItem(`${CACHE_PREFIX}${user.id}_${key}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    localStorage.setItem("bovi_last_sync", new Date().toISOString());
  } catch (e) {
    console.error("Cache save error:", e);
  }
}

function getDataCache(key: string): any[] {
  try {
    const rawUserProfile = localStorage.getItem("bovi_user_profile");
    if (!rawUserProfile) return [];
    const user = JSON.parse(rawUserProfile);
    const raw = localStorage.getItem(`${CACHE_PREFIX}${user.id}_${key}`);
    if (!raw) return [];
    return JSON.parse(raw).data || [];
  } catch {
    return [];
  }
}

// --- SYNC QUEUE: Persistent actions for offline writes ---
const PENDING_ACTIONS_KEY = "bovi_pending_actions";

function addPendingAction(action: { method: string, args: any[] }) {
  try {
    const rawUserProfile = localStorage.getItem("bovi_user_profile");
    if (!rawUserProfile) return;
    const user = JSON.parse(rawUserProfile);
    const key = `${PENDING_ACTIONS_KEY}_${user.id}`;
    const queue = JSON.parse(localStorage.getItem(key) || "[]");
    queue.push({ ...action, timestamp: Date.now(), id: v4() });
    localStorage.setItem(key, JSON.stringify(queue));
    toast.info("Ação salva localmente. Sincronizando quando houver sinal...");
  } catch (e) {
    console.error("Error adding to sync queue:", e);
  }
}

function getPendingActions(): any[] {
  const user = store.auth.getCurrentUser();
  if (!user) return [];
  return JSON.parse(localStorage.getItem(`${PENDING_ACTIONS_KEY}_${user.id}`) || "[]");
}

function clearPendingActions() {
  const user = store.auth.getCurrentUser();
  if (!user) return;
  localStorage.setItem(`${PENDING_ACTIONS_KEY}_${user.id}`, "[]");
}

// --- CLOUD-ONLY STORE ---

// Auth functions first to be used by others
const auth = {
  signup: async (name: string, email: string, pass: string, farmName?: string) => {
    const passError = validatePasswordStrength(pass);
    if (passError) throw new Error(passError);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: pass,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          name,
          farm_name: farmName ? sanitizeString(farmName) : null
        }
      }
    });

    if (authError) {
      if (authError.message?.includes('already registered')) {
        throw new Error("Este email já está cadastrado");
      }
      throw authError;
    }

    if (!authData.user) throw new Error("Erro ao criar usuário");

    const { data, error } = await supabase.from('users').insert([{
      id: authData.user.id,
      name,
      email: email.trim().toLowerCase(),
      farm_name: farmName ? sanitizeString(farmName) : null
    }]).select().single();

    if (error) {
      const profile = { id: authData.user.id, name, email: email.trim().toLowerCase(), farm_name: farmName };
      saveUserProfile(profile);
      saveSession(authData.user.id);
      return profile;
    }

    saveUserProfile(data);
    saveSession(data.id);
    return data;
  },
  checkSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return null;

      const userId = session.user.id;
      saveSession(userId);

      // Refresh profile from DB or Metadata
      const { data: profileData } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();

      const profile = profileData || {
        id: userId,
        name: session.user.user_metadata?.name || "Usuário",
        email: session.user.email || "",
        farm_name: session.user.user_metadata?.farm_name,
        cpf: session.user.user_metadata?.cpf
      };

      saveUserProfile(profile);

      // AUTO-RECOVERY: Se o usuário entrar e estiver logado, tentamos vincular dados antigos em silêncio
      // Isso resolve o problema de "conta zerada" após migração/login
      auth.recoverLegacyDataSilent(profile).catch(() => { });

      return profile;
    } catch (e) {
      console.error("Silent session check failed", e);
      return auth.getCurrentUser(); // Fallback para o que temos no cache
    }
  },
  recoverLegacyDataSilent: async (user: User) => {
    if (!user || !user.email) return;

    // Buscar outros IDs com o mesmo email
    const { data: legacyUsers } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email.trim().toLowerCase());

    const oldIds = (legacyUsers || [])
      .map(u => u.id)
      .filter(id => id !== user.id);

    if (oldIds.length === 0) return;

    const tables = ['animals', 'financials', 'events', 'rainfall', 'health', 'settings'];
    for (const oldId of oldIds) {
      for (const table of tables) {
        await supabase.from(table).update({ user_id: user.id }).eq('user_id', oldId).catch(() => { });
      }
    }
  },
  getCurrentUser: () => {
    const userId = getSession();
    if (!userId) return null;
    const profile = loadUserProfile();
    if (profile && profile.id === userId) return profile as User;
    // Se não houver profile mas houver ID, tentamos retornar algo mínimo para não quebrar a UI
    return { id: userId, name: "Usuário", email: "", createdAt: "" } as User;
  },
  login: async (identifier: string, pass: string) => {
    let email = identifier.trim().toLowerCase();

    // Se parecer um CPF (11 dígitos numéricos)
    const onlyNums = identifier.replace(/\D/g, '');
    if (onlyNums.length === 11) {
      try {
        const { data: userData, error: cpfError } = await supabase
          .from('users')
          .select('email')
          .eq('cpf', onlyNums)
          .maybeSingle();

        if (!cpfError && userData) {
          email = userData.email;
        }
      } catch (e) {
        console.error("CPF lookup failed:", e);
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        throw new Error("E-mail/CPF ou senha incorretos. Verifique seus dados.");
      }
      throw new Error(authError.message);
    }

    if (!authData.user) throw new Error("Erro no login");

    const { data, error } = await supabase.from('users').select('*').eq('id', authData.user.id).maybeSingle();

    const profile = data || {
      id: authData.user.id,
      name: authData.user.user_metadata?.name || "Usuário",
      email: authData.user.email || email,
      farm_name: authData.user.user_metadata?.farm_name,
      cpf: authData.user.user_metadata?.cpf
    };

    saveSession(authData.user.id);
    saveUserProfile(profile);
    return profile;
  },
  updateProfile: async (updates: Partial<User>) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");

    // 1. Atualizar no Supabase Auth Metadata (Mais garantido que funcione sempre)
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        name: updates.name || user.name,
        cpf: updates.cpf || user.cpf,
        farm_name: updates.farm_name || user.farm_name
      }
    });

    if (authError) console.warn("Erro ao atualizar Auth Metadata:", authError.message);

    // 2. Tentar atualizar na tabela pública 'users' (Pode falhar se a coluna CPF não existir)
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (!error && data) {
        saveUserProfile(data);
        return data;
      }
    } catch (e) {
      console.error("Erro na tabela users, usando fallback:", e);
    }

    // Fallback: Se a tabela users falhar, atualizar apenas o cache local com os novos dados
    const updatedProfile = { ...user, ...updates };
    saveUserProfile(updatedProfile);
    return updatedProfile;
  },
  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    clearUserProfile();
  },
  getCurrentUser: () => {
    const userId = getSession();
    if (!userId) return null;
    const profile = loadUserProfile();
    if (profile && profile.id === userId) return profile as User;
    return { id: userId, name: "Usuário", email: "", createdAt: "" } as User;
  },
  resetPassword: async (email: string, newPassword?: string) => {
    // Só validamos a força da senha se ela for realmente fornecida (passo final)
    if (newPassword && newPassword.length > 0) {
      const passError = validatePasswordStrength(newPassword);
      if (passError) throw new Error(passError);
    }

    const user = auth.getCurrentUser();
    // Se o usuário já está logado (tentando mudar a senha por dentro do app)
    if (user && user.id && newPassword) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return true;
    }

    // Se não houver senha, estamos apenas pedindo o e-mail de recuperação
    if (!newPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/forgot-password`,
      });
      if (error) throw error;
      return true;
    }

    // Se chegamos aqui com uma nova senha mas sem estar logado (passo final da recuperação)
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return true;
  }
};

export const store = {
  auth,

  // Animals
  getAnimals: async () => {
    const user = auth.getCurrentUser();
    if (!user) return [];

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return getDataCache('animals');
    }

    try {
      const { data, error } = await supabase.from('animals').select('*').eq('user_id', user.id);
      if (error) throw error;

      const mapped = (data || []).map(a => ({ ...a, lote_id: a.lot }));
      // Use fallback for tag in localeCompare to prevent JS crashes
      const sorted = mapped.sort((a, b) => (b.tag || "").localeCompare(a.tag || ""));

      saveDataCache('animals', sorted);
      return sorted;
    } catch (error) {
      return getDataCache('animals');
    }
  },
  addAnimal: async (a: Omit<Animal, "id">) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item: any = {
      id: (a as any).id || v4(),
      tag: sanitizeString(a.tag),
      user_id: user.id,
    };
    const optionalFields: (keyof typeof a)[] = [
      'birth_date', 'sex', 'breed', 'weight', 'status',
      'categoria', 'origem', 'data_compra', 'valor_compra',
      'preco_arroba', 'peso_entrada', 'peso_saida', 'data_saida',
      'valor_venda', 'matriz_id'
    ];
    optionalFields.forEach(f => {
      let val = (a as any)[f];
      if (val != null && val !== '') {
        if (typeof val === 'string' && ['breed', 'categoria', 'origem', 'status', 'lot'].includes(f)) {
          val = sanitizeString(val);
        }
        item[f] = val;
      }
    });
    if (a.lote_id) item.lot = a.lote_id;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addPendingAction({ method: 'addAnimal', args: [item] }); // Pass the full item to keep the ID
      const currentCache = getDataCache('animals');
      saveDataCache('animals', [item, ...currentCache]);
      return item;
    }

    try {
      const { data, error } = await supabase.from('animals').insert([item]).select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      addPendingAction({ method: 'addAnimal', args: [item] });
      const currentCache = getDataCache('animals');
      saveDataCache('animals', [item, ...currentCache]);
      return item;
    }
  },
  updateAnimal: async (id: string, data: Partial<Animal>) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    const sanitized: any = {};
    const allowed = ['tag', 'birth_date', 'sex', 'breed', 'weight', 'status', 'categoria', 'origem', 'data_compra', 'valor_compra', 'preco_arroba', 'peso_entrada', 'peso_saida', 'data_saida', 'valor_venda', 'matriz_id', 'lot'];
    allowed.forEach(col => {
      const val = col === 'lot' ? (data as any).lote_id : (data as any)[col];
      if (val != null && val !== '') sanitized[col] = val;
    });

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addPendingAction({ method: 'updateAnimal', args: [id, data] });
      return;
    }

    try {
      const { error } = await supabase.from('animals').update(sanitized).eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    } catch {
      addPendingAction({ method: 'updateAnimal', args: [id, data] });
    }
  },
  deleteAnimal: async (id: string) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    const { error } = await supabase.from('animals').delete().eq('id', id).eq('user_id', user.id);
    if (error) toast.error("Erro ao deletar animal");
  },
  getAnimal: async (id: string) => {
    const user = auth.getCurrentUser();
    if (!user) return null;
    const { data } = await supabase.from('animals').select('*').eq('id', id).eq('user_id', user.id).single();
    return data;
  },

  // Events
  getEvents: async () => {
    const user = auth.getCurrentUser();
    if (!user) return [];

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return getDataCache('events');
    }

    try {
      const { data, error } = await supabase.from('events').select('*').eq('user_id', user.id).order('date', { ascending: false });
      if (error) throw error;
      saveDataCache('events', data || []);
      return data || [];
    } catch {
      return getDataCache('events');
    }
  },
  getEvent: async (id: string) => {
    const user = auth.getCurrentUser();
    if (!user) return null;
    const { data } = await supabase.from('events').select('*').eq('id', id).eq('user_id', user.id).single();
    return data;
  },
  updateEvent: async (id: string, data: Partial<AnimalEvent>) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    await supabase.from('events').update(data).eq('id', id).eq('user_id', user.id);
  },
  deleteEvent: async (id: string) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    const event = await store.getEvent(id);
    if (event && (event.type === 'venda' || event.type === 'morte')) {
      // Retorna o animal para o rebanho ativo
      await store.updateAnimal(event.animal_id, { status: 'ativo', peso_saida: 0 });

      // Se for venda, apaga as notas financeiras vinculadas (Receita e Frete)
      if (event.type === 'venda') {
        await supabase.from('financial').delete()
          .eq('animal_id', event.animal_id)
          .in('category', ['Venda de Animais', 'Frete de Venda'])
          .eq('user_id', user.id);
      }
    }
    await supabase.from('events').delete().eq('id', id).eq('user_id', user.id);
  },
  getEventsByAnimal: async (animalId: string) => {
    const user = auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('events').select('*').eq('animal_id', animalId).eq('user_id', user.id).order('date', { ascending: false });
    return data || [];
  },
  getFeedingLogs: async (): Promise<FeedingLog[]> => {
    const user = auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('financial').select('*').eq('user_id', user.id).eq('type', 'metadata').eq('category', 'feeding_log');
    if (!data) return [];
    return data.map(d => { try { return JSON.parse(d.description); } catch { return null; } }).filter(Boolean);
  },
  addFeedingLog: async (log: Omit<FeedingLog, "id">) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = { ...log, id: v4(), user_id: user.id };

    const finMeta = {
      id: item.id,
      type: 'metadata',
      category: 'feeding_log',
      value: item.total_cost || 0,
      date: item.date || new Date().toISOString(),
      description: JSON.stringify(item),
      user_id: user.id
    };

    const finExpense = {
      id: v4(),
      type: 'despesa',
      category: 'Alimentação',
      value: item.total_cost || 0,
      date: item.date || new Date().toISOString(),
      description: `Trato Lote ${item.lote_id || "Geral"} - ${item.days} dias`,
      user_id: user.id
    };

    const { error } = await supabase.from('financial').insert([finMeta, finExpense]);
    if (error) throw error;
    return item;
  },
  addEvent: async (e: Omit<AnimalEvent, "id">) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = {
      id: (e as any).id || v4(),
      animal_id: e.animal_id,
      type: e.type,
      date: e.date,
      description: e.description,
      value: e.type === "pesagem" ? e.weight : e.value,
      user_id: user.id
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addPendingAction({ method: 'addEvent', args: [item] });

      const currentCache = getDataCache('events');
      saveDataCache('events', [item, ...currentCache]);

      if (e.type === "pesagem" && e.weight) store.updateAnimal(e.animal_id, { weight: e.weight });
      if (e.type === "venda") store.updateAnimal(e.animal_id, { status: "vendido", peso_saida: e.weight });
      if (e.type === "morte") store.updateAnimal(e.animal_id, { status: "morto", peso_saida: e.weight });
      return item;
    }

    try {
      const { data, error } = await supabase.from('events').insert([item]).select().single();
      if (error) throw error;

      if (e.type === "pesagem" && e.weight) await store.updateAnimal(e.animal_id, { weight: e.weight });
      if (e.type === "venda") await store.updateAnimal(e.animal_id, { status: "vendido", peso_saida: e.weight });
      if (e.type === "morte") await store.updateAnimal(e.animal_id, { status: "morto", peso_saida: e.weight });

      return data;
    } catch {
      addPendingAction({ method: 'addEvent', args: [item] });
      const currentCache = getDataCache('events');
      saveDataCache('events', [item, ...currentCache]);

      if (e.type === "pesagem" && e.weight) store.updateAnimal(e.animal_id, { weight: e.weight });
      if (e.type === "venda") store.updateAnimal(e.animal_id, { status: "vendido", peso_saida: e.weight });
      if (e.type === "morte") store.updateAnimal(e.animal_id, { status: "morto", peso_saida: e.weight });
      return item;
    }
  },

  // Financial
  getFinancials: async () => {
    const user = auth.getCurrentUser();
    if (!user) return [];

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return getDataCache('financials');
    }

    try {
      const { data, error } = await supabase.from('financial').select('*').eq('user_id', user.id).neq('type', 'metadata').order('date', { ascending: false });
      if (error) throw error;
      saveDataCache('financials', data || []);
      return data || [];
    } catch {
      return getDataCache('financials');
    }
  },
  addFinancial: async (f: Omit<Financial, "id">, installments: number = 1) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const items: any[] = [];
    if (installments > 1) {
      const valuePerInstallment = f.value / installments;
      const baseDate = parseDateSafe(f.date);
      for (let i = 0; i < installments; i++) {
        const instDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
        items.push({
          ...f,
          id: v4(),
          user_id: user.id,
          value: valuePerInstallment,
          date: instDate.toISOString().split("T")[0],
          description: `${f.description} (${i + 1}/${installments})`
        });
      }
    } else {
      items.push({
        ...f,
        id: v4(),
        user_id: user.id,
        description: sanitizeString(f.description),
        category: sanitizeString(f.category)
      });
    }
    const sanitizeItem = (item: any) => {
      const { id, type, category, description, value, date, payment_method, user_id, animal_id } = item;
      const base: any = { id, type, category, description, value, date, payment_method, user_id };
      // CRITICAL: A tabela 'financial' original não possui a coluna 'animal_id'. 
      // Por isso, omitimos essa coluna do insert para evitar erro PGRST204 e travamento da tela.
      return base;
    };

    const sanitizedItems = items.map(sanitizeItem);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addPendingAction({ method: 'addFinancial', args: [f, installments] });
      const currentCache = getDataCache('financials');
      saveDataCache('financials', [...sanitizedItems, ...currentCache]);
      return sanitizedItems[0];
    }

    try {
      const { data, error } = await supabase.from('financial').insert(sanitizedItems).select();
      if (error) throw error;
      return data[0];
    } catch {
      addPendingAction({ method: 'addFinancial', args: [f, installments] });
      const currentCache = getDataCache('financials');
      saveDataCache('financials', [...sanitizedItems, ...currentCache]);
      return sanitizedItems[0];
    }
  },
  updateFinancial: async (id: string, data: Partial<Financial>) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').update(data).eq('id', id).eq('user_id', user.id);
  },
  deleteFinancial: async (id: string) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').delete().eq('id', id).eq('user_id', user.id);
  },
  clearFinancials: async () => {
    const user = auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').delete().eq('user_id', user.id);
  },

  // Insemination / Health
  getInseminations: async () => {
    const user = auth.getCurrentUser();
    if (!user) return [];

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return getDataCache('inseminations');
    }

    try {
      const { data, error } = await supabase.from('insemination').select('*').eq('user_id', user.id).order('date', { ascending: false });
      if (error) throw error;
      saveDataCache('inseminations', data || []);
      return data || [];
    } catch {
      return getDataCache('inseminations');
    }
  },
  addInsemination: async (ins: Omit<Insemination, "id">) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = {
      id: v4(),
      animal_id: ins.animal_id,
      date: ins.date,
      bull: ins.bull,
      status: ins.status,
      technician: ins.technician,
      observation: ins.observation,
      estimated_birth: ins.estimated_birth,
      type: ins.type,
      next_date: ins.next_date,
      user_id: user.id
    };
    const { data, error } = await supabase.from('insemination').insert([item]).select().single();
    if (error) throw error;
    return data;
  },
  addHealth: async (h: Omit<Health, "id">) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    // Using insemination table for health as per mapping
    const item = {
      id: v4(),
      animal_id: h.animal_id,
      date: h.date,
      type: h.type,
      next_date: h.next_date,
      user_id: user.id
    };
    const { data, error } = await supabase.from('insemination').insert([item]).select().single();
    if (error) throw error;
    return data;
  },
  updateInsemination: async (id: string, data: Partial<Insemination>) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    await supabase.from('insemination').update(data).eq('id', id).eq('user_id', user.id);
  },

  // --- RATIONS & INGREDIENTS METADATA OVER FINANCIAL ---
  getIngredients: async (): Promise<Ingredient[]> => {
    const user = auth.getCurrentUser();
    if (!user) return [];
    try {
      const { data, error } = await supabase.from('financial').select('*').eq('user_id', user.id).eq('type', 'metadata').eq('category', 'ingredient');
      if (error) throw error;
      const mapped = (data || []).map(d => { try { return JSON.parse(d.description); } catch { return null; } }).filter(Boolean);
      saveDataCache('ingredients', mapped);
      return mapped;
    } catch {
      return getDataCache('ingredients');
    }
  },
  addIngredient: async (ing: Omit<Ingredient, "id">) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = { ...ing, id: v4(), user_id: user.id };
    const fin = { id: item.id, type: 'metadata', category: 'ingredient', value: 0, date: new Date().toISOString(), description: JSON.stringify(item), user_id: user.id };
    const { error } = await supabase.from('financial').insert([fin]);
    if (error) throw error;
    return item;
  },
  updateIngredient: async (id: string, data: Partial<Ingredient>) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    const all = await store.getIngredients();
    const existing = all.find(i => i.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    const finParams = { description: JSON.stringify(updated) };
    await supabase.from('financial').update(finParams).eq('id', id).eq('user_id', user.id);
  },
  deleteIngredient: async (id: string) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').delete().eq('id', id).eq('user_id', user.id);
  },

  getRations: async (): Promise<Ration[]> => {
    const user = auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('financial').select('*').eq('user_id', user.id).eq('type', 'metadata').eq('category', 'ration');
    if (!data) return [];
    return data.map(d => { try { return JSON.parse(d.description); } catch { return null; } }).filter(Boolean);
  },
  addRation: async (rat: Omit<Ration, "id">) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = { ...rat, id: v4(), user_id: user.id };
    const fin = { id: item.id, type: 'metadata', category: 'ration', value: 0, date: new Date().toISOString(), description: JSON.stringify(item), user_id: user.id };
    const { error } = await supabase.from('financial').insert([fin]);
    if (error) throw error;
    return item;
  },
  updateRation: async (id: string, data: Partial<Ration>) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    const all = await store.getRations();
    const existing = all.find(r => r.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    await supabase.from('financial').update({ description: JSON.stringify(updated) }).eq('id', id).eq('user_id', user.id);
  },
  deleteRation: async (id: string) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').delete().eq('id', id).eq('user_id', user.id);
  },

  getIngredientPurchases: async (): Promise<IngredientPurchase[]> => {
    const user = auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('financial').select('*').eq('user_id', user.id).eq('type', 'metadata').eq('category', 'purchase');
    if (!data) return [];
    return data.map(d => { try { return JSON.parse(d.description); } catch { return null; } }).filter(Boolean);
  },
  addIngredientPurchase: async (pur: Omit<IngredientPurchase, "id">) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = { ...pur, id: v4(), user_id: user.id };
    const finMeta = { id: item.id, type: 'metadata', category: 'purchase', value: item.total_value || 0, date: item.date || new Date().toISOString(), description: JSON.stringify(item), user_id: user.id };

    let ingName = "Insumo";
    try {
      const { data } = await supabase.from('financial').select('*').eq('id', item.ingredient_id).eq('user_id', user.id).single();
      if (data && data.description) {
        const decoded = JSON.parse(data.description);
        if (decoded.name) ingName = decoded.name;
      }
    } catch (e) { }

    const finExpense = {
      id: v4(),
      type: 'despesa',
      category: 'Compra de Insumos',
      value: item.total_value || 0,
      date: item.date || new Date().toISOString(),
      payment_method: item.payment_method || 'Pix',
      description: `Compra de ${item.total_qty_kg}kg de ${ingName}`,
      user_id: user.id
    };

    const { error } = await supabase.from('financial').insert([finMeta, finExpense]);
    if (error) throw error;

    // Atualiza o custo por kg do insumo com a compra mais recente
    if (item.ingredient_id && item.cost_per_kg) {
      try {
        await store.updateIngredient(item.ingredient_id, { cost_per_kg: item.cost_per_kg });
      } catch (e) {
        console.error("Erro ao atualizar custo do insumo:", e);
      }
    }

    return item;
  },
  updateIngredientPurchase: async (id: string, data: Partial<IngredientPurchase>) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    const all = await store.getIngredientPurchases();
    const existing = all.find(p => p.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };

    // Atualiza a metadata nativa
    await supabase.from('financial').update({ description: JSON.stringify(updated), value: updated.total_value, date: updated.date }).eq('id', id).eq('user_id', user.id);

    // Tenta encontrar e atualizar a despesa real vinculada a essa compra
    const { data: expenses } = await supabase.from('financial')
      .select('id')
      .eq('category', 'Compra de Insumos')
      .eq('value', existing.total_value)
      .eq('date', existing.date)
      .eq('user_id', user.id);

    if (expenses && expenses.length > 0) {
      let ingName = "Insumo";
      try {
        const ingData = await supabase.from('financial').select('description').eq('id', updated.ingredient_id).single();
        if (ingData.data?.description) {
          const dec = JSON.parse(ingData.data.description);
          if (dec.name) ingName = dec.name;
        }
      } catch (e) { }

      await supabase.from('financial').update({
        value: updated.total_value,
        date: updated.date,
        payment_method: updated.payment_method || 'Pix',
        description: `Compra de ${updated.total_qty_kg}kg de ${ingName}`
      }).eq('id', expenses[0].id).eq('user_id', user.id);
    }
  },
  deleteIngredientPurchase: async (id: string) => {
    const user = auth.getCurrentUser();
    if (!user) return;

    // Tenta encontrar a despesa associada antes de deletar
    const all = await store.getIngredientPurchases();
    const existing = all.find(p => p.id === id);
    if (existing) {
      await supabase.from('financial')
        .delete()
        .eq('category', 'Compra de Insumos')
        .eq('value', existing.total_value)
        .eq('date', existing.date)
        .eq('user_id', user.id);
    }

    // Deleta a metadata da compra
    await supabase.from('financial').delete().eq('id', id).eq('user_id', user.id);
  },

  // Settings Methods
  getSettings: async (): Promise<Setting[]> => {
    const user = auth.getCurrentUser();
    if (!user) return [];

    // Tenta carregar do Supabase
    const { data } = await supabase.from('settings').select('*').eq('user_id', user.id);
    if (data) return data;

    // Fallback local caso precise (opcional)
    return [];
  },

  updateSetting: async (key: string, value: string) => {
    const user = auth.getCurrentUser();
    if (!user) return;

    const { error } = await supabase.from('settings').upsert({
      user_id: user.id,
      key,
      value,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,key' });

    if (error) console.error("Error saving setting:", error);
  },

  // Rainfall Methods
  getRainfall: async (): Promise<Rainfall[]> => {
    const user = auth.getCurrentUser();
    if (!user) return [];
    try {
      const { data, error } = await supabase.from('financial').select('*').eq('user_id', user.id).eq('type', 'metadata').eq('category', 'rainfall');
      if (error) throw error;
      const mapped = (data || []).map(d => { try { return JSON.parse(d.description); } catch { return null; } }).filter(Boolean);
      return mapped.sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      return [];
    }
  },

  addRainfall: async (mm: number, date: string) => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item: Rainfall = { id: v4(), date, mm, user_id: user.id };
    const fin = {
      id: item.id,
      type: 'metadata',
      category: 'rainfall',
      value: mm,
      date: date,
      description: JSON.stringify(item),
      user_id: user.id
    };
    const { error } = await supabase.from('financial').insert([fin]);
    if (error) throw error;
    return item;
  },

  deleteRainfall: async (id: string) => {
    const user = auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').delete().eq('id', id).eq('user_id', user.id);
  },

  // Market Price Robot (Scraper)
  fetchMarketPrice: async (): Promise<number | null> => {
    try {
      // Usando allorigins para evitar CORS
      const targetUrl = encodeURIComponent("https://www.scotconsultoria.com.br/cotacoes/boi-gordo/");
      const proxyUrl = `https://api.allorigins.win/get?url=${targetUrl}`;

      const response = await fetch(proxyUrl);
      const data = await response.json();
      const html = data.contents;

      // Na Scot, o valor geralmente está em tabelas. 
      const match = html.match(/(?:Teresina|Piauí).*?(\d{3}(?:,\d{2})?)/i);

      if (match && match[1]) {
        return parseFloat(match[1].replace(',', '.'));
      }
      return null;
    } catch (err) {
      console.error("Market fetch failed:", err);
      return null;
    }
  },

  fetchRainfallAuto: async (lat: number, lng: number, startDate: string, endDate: string): Promise<any[]> => {
    try {
      // O Open-Meteo Historical API é gratuito e não requer chave
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum&timezone=auto`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.daily && data.daily.time) {
        return data.daily.time.map((time: string, index: number) => ({
          date: time,
          mm: data.daily.precipitation_sum[index] || 0
        }));
      }
      return [];
    } catch (err) {
      console.error("Auto rainfall fetch failed:", err);
      return [];
    }
  },

  // System
  recoverLegacyData: async () => {
    const user = auth.getCurrentUser();
    if (!user) throw new Error("Usuário não identificado");

    toast.loading("Iniciando Clonagem Forense...");

    // 1. BUSCA TOTAL DE ANIMAIS (QUALQUER DONO)
    const { data: allAnimals, error } = await supabase.from('animals').select('*');
    
    if (error || !allAnimals || allAnimals.length === 0) {
      toast.error("Nenhum animal encontrado no banco.");
      return;
    }

    const otherAnimals = allAnimals.filter(a => a.user_id !== user.id);

    if (otherAnimals.length === 0) {
      toast.info(`O banco tem ${allAnimals.length} animais e todos já são seus.`);
      return;
    }

    // 2. MODO CLONE: Pegar tudo das outras tabelas e re-inserir para o Gabriel
    let totalCloned = 0;
    let lastError = "";
    const tables = ['animals', 'events', 'financial', 'insemination', 'settings', 'rainfall'];
    const oldIds = Array.from(new Set(otherAnimals.map(a => a.user_id)));

    for (const oldId of oldIds) {
      if (!oldId) continue;
      for (const table of tables) {
        try {
          const { data: sourceData } = await supabase.from(table).select('*').eq('user_id', oldId);
          
          if (sourceData && sourceData.length > 0) {
            // Removendo IDs originais para evitar conflitos de chave primária
            const copies = sourceData.map(item => {
              const clone = { ...item, user_id: user.id };
              delete (clone as any).id; // Deixar o banco gerar novo ID
              return clone;
            });
            
            const { error: insertError } = await supabase.from(table).insert(copies);
            
            if (!insertError) {
              totalCloned += copies.length;
            } else {
              lastError = insertError.message;
              console.error(`Erro na tabela ${table}:`, insertError);
            }
          }
        } catch (e: any) {
          lastError = e.message;
        }
      }
    }

    if (totalCloned > 0) {
      toast.success(`${totalCloned} registros clonados com sucesso!`);
      setTimeout(() => window.location.reload(), 2000);
    } else {
      toast.error(`Falha na clonagem: ${lastError || "Erro desconhecido"}`);
    }

    return totalCloned;
  },
  sync: async () => {
    const queue = getPendingActions();
    if (queue.length === 0) return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

    let success = true;
    for (const action of queue) {
      try {
        const method = (store as any)[action.method];
        if (method) {
          // Excluir a ação atual da fila para evitar duplicidade em caso de reload durante o loop
          const remaining = getPendingActions().filter(a => a.id !== action.id);
          const user = auth.getCurrentUser();
          if (user) {
            localStorage.setItem(`${PENDING_ACTIONS_KEY}_${user.id}`, JSON.stringify(remaining));
          }
          await method(...action.args);
        }
      } catch (e) {
        success = false;
        console.error("Failed to sync action", action, e);
      }
    }

    if (success) {
      clearPendingActions();
      toast.success("Dados sincronizados com a nuvem!");
    }
    return success;
  },
  pushToCloud: async () => true
};
