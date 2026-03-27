import { supabase } from "./supabase";
import { toast } from "sonner";

// Helper to generate UUIDs locally if needed (though Supabase usually handles it)
// Standard UUID generator for Supabase compatibility
const v4 = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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
  password_hash: string;
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
  type?: string;
  next_date?: string;
  user_id?: string;
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

function loadUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem("bovi_users") || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem("bovi_users", JSON.stringify(users));
}

// --- CLOUD-ONLY STORE ---

export const store = {
  // Animals
  getAnimals: async () => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase.from('animals').select('*').eq('user_id', user.id);
    if (error) {
      console.error("Error fetching animals:", error.message);
      return [];
    }
    // Map DB 'lot' back to frontend 'lote_id'
    const mapped = (data || []).map(a => ({ ...a, lote_id: a.lot }));
    return mapped.sort((a, b) => b.tag.localeCompare(a.tag));
  },
  addAnimal: async (a: Omit<Animal, "id">) => {
    const user = store.auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    // Core fields that MUST exist in every schema
    const item: any = { 
      id: v4(),
      tag: a.tag,
      user_id: user.id,
    };
    // Optional fields - now safe to include all since DB is upgraded
    const optionalFields: (keyof typeof a)[] = [
      'birth_date', 'sex', 'breed', 'weight', 'status',
      'categoria', 'origem', 'data_compra', 'valor_compra',
      'preco_arroba', 'peso_entrada', 'peso_saida', 'data_saida',
      'valor_venda', 'matriz_id'
    ];
    optionalFields.forEach(f => {
      const val = (a as any)[f];
      if (val != null && val !== '') item[f] = val;
    });
    // Map lote_id -> lot (lot exists in DB schema)
    if (a.lote_id) item.lot = a.lote_id;

    const { data, error } = await supabase.from('animals').insert([item]).select().single();
    if (error) {
      toast.error("Erro ao salvar animal: " + error.message);
      throw error;
    }
    return data;
  },
  updateAnimal: async (id: string, data: Partial<Animal>) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    const sanitized: any = {};
    // Update all columns now that schema is fully supported
    const allowed = ['tag', 'birth_date', 'sex', 'breed', 'weight', 'status', 'categoria', 'origem', 'data_compra', 'valor_compra', 'preco_arroba', 'peso_entrada', 'peso_saida', 'data_saida', 'valor_venda', 'matriz_id', 'lot'];
    allowed.forEach(col => {
      const val = col === 'lot' ? (data as any).lote_id : (data as any)[col];
      if (val != null && val !== '') sanitized[col] = val;
    });
    const { error } = await supabase.from('animals').update(sanitized).eq('id', id).eq('user_id', user.id);
    if (error) toast.error("Erro ao atualizar animal");
  },
  deleteAnimal: async (id: string) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    const { error } = await supabase.from('animals').delete().eq('id', id).eq('user_id', user.id);
    if (error) toast.error("Erro ao deletar animal");
  },
  getAnimal: async (id: string) => {
    const user = store.auth.getCurrentUser();
    if (!user) return null;
    const { data } = await supabase.from('animals').select('*').eq('id', id).eq('user_id', user.id).single();
    return data;
  },

  // Events
  getEvents: async () => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('events').select('*').eq('user_id', user.id).order('date', { ascending: false });
    return data || [];
  },
  getEvent: async (id: string) => {
    const user = store.auth.getCurrentUser();
    if (!user) return null;
    const { data } = await supabase.from('events').select('*').eq('id', id).eq('user_id', user.id).single();
    return data;
  },
  updateEvent: async (id: string, data: Partial<AnimalEvent>) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    await supabase.from('events').update(data).eq('id', id).eq('user_id', user.id);
  },
  deleteEvent: async (id: string) => {
    const user = store.auth.getCurrentUser();
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
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('events').select('*').eq('animal_id', animalId).eq('user_id', user.id).order('date', { ascending: false });
    return data || [];
  },
  getFeedingLogs: async (): Promise<FeedingLog[]> => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('financial').select('*').eq('user_id', user.id).eq('type', 'metadata').eq('category', 'feeding_log');
    if (!data) return [];
    return data.map(d => { try { return JSON.parse(d.description); } catch { return null; } }).filter(Boolean);
  },
  addFeedingLog: async (log: Omit<FeedingLog, "id">) => {
    const user = store.auth.getCurrentUser();
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
    const user = store.auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = { 
      id: v4(),
      animal_id: e.animal_id,
      type: e.type,
      date: e.date,
      description: e.description,
      value: e.type === "pesagem" ? e.weight : e.value, // Treat weight as value for weighing events
      user_id: user.id
    };
    const { data, error } = await supabase.from('events').insert([item]).select().single();
    if (error) throw error;

    if (e.type === "pesagem" && e.weight) {
      await store.updateAnimal(e.animal_id, { weight: e.weight });
    }
    if (e.type === "venda") {
      await store.updateAnimal(e.animal_id, { status: "vendido", peso_saida: e.weight });
    }
    if (e.type === "morte") {
      await store.updateAnimal(e.animal_id, { status: "morto", peso_saida: e.weight });
    }
    return data;
  },

  // Financial
  getFinancials: async () => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('financial').select('*').eq('user_id', user.id).neq('type', 'metadata').order('date', { ascending: false });
    return data || [];
  },
  addFinancial: async (f: Omit<Financial, "id">, installments: number = 1) => {
    const user = store.auth.getCurrentUser();
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
      items.push({ ...f, id: v4(), user_id: user.id });
    }
    const sanitizeItem = (item: any) => {
      const { id, type, category, description, value, date, payment_method, user_id, animal_id } = item;
      const base: any = { id, type, category, description, value, date, payment_method, user_id };
      // CRITICAL: A tabela 'financial' original não possui a coluna 'animal_id'. 
      // Por isso, omitimos essa coluna do insert para evitar erro PGRST204 e travamento da tela.
      return base;
    };

    const sanitizedItems = items.map(sanitizeItem);
    const { data, error } = await supabase.from('financial').insert(sanitizedItems).select();
    if (error) throw error;
    return data[0];
  },
  updateFinancial: async (id: string, data: Partial<Financial>) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').update(data).eq('id', id).eq('user_id', user.id);
  },
  deleteFinancial: async (id: string) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').delete().eq('id', id).eq('user_id', user.id);
  },
  clearFinancials: async () => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').delete().eq('user_id', user.id);
  },

  // Insemination / Health
  getInseminations: async () => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('insemination').select('*').eq('user_id', user.id).order('date', { ascending: false });
    return data || [];
  },
  addInsemination: async (ins: Omit<Insemination, "id">) => {
    const user = store.auth.getCurrentUser();
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
    const user = store.auth.getCurrentUser();
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
    const user = store.auth.getCurrentUser();
    if (!user) return;
    await supabase.from('insemination').update(data).eq('id', id).eq('user_id', user.id);
  },

  // --- RATIONS & INGREDIENTS METADATA OVER FINANCIAL ---
  getIngredients: async (): Promise<Ingredient[]> => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('financial').select('*').eq('user_id', user.id).eq('type', 'metadata').eq('category', 'ingredient');
    if (!data) return [];
    return data.map(d => { try { return JSON.parse(d.description); } catch { return null; } }).filter(Boolean);
  },
  addIngredient: async (ing: Omit<Ingredient, "id">) => {
    const user = store.auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = { ...ing, id: v4(), user_id: user.id };
    const fin = { id: item.id, type: 'metadata', category: 'ingredient', value: 0, date: new Date().toISOString(), description: JSON.stringify(item), user_id: user.id };
    const { error } = await supabase.from('financial').insert([fin]);
    if (error) throw error;
    return item;
  },
  updateIngredient: async (id: string, data: Partial<Ingredient>) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    const all = await store.getIngredients();
    const existing = all.find(i => i.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    const finParams = { description: JSON.stringify(updated) };
    await supabase.from('financial').update(finParams).eq('id', id).eq('user_id', user.id);
  },
  deleteIngredient: async (id: string) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').delete().eq('id', id).eq('user_id', user.id);
  },

  getRations: async (): Promise<Ration[]> => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('financial').select('*').eq('user_id', user.id).eq('type', 'metadata').eq('category', 'ration');
    if (!data) return [];
    return data.map(d => { try { return JSON.parse(d.description); } catch { return null; } }).filter(Boolean);
  },
  addRation: async (rat: Omit<Ration, "id">) => {
    const user = store.auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = { ...rat, id: v4(), user_id: user.id };
    const fin = { id: item.id, type: 'metadata', category: 'ration', value: 0, date: new Date().toISOString(), description: JSON.stringify(item), user_id: user.id };
    const { error } = await supabase.from('financial').insert([fin]);
    if (error) throw error;
    return item;
  },
  updateRation: async (id: string, data: Partial<Ration>) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    const all = await store.getRations();
    const existing = all.find(r => r.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    await supabase.from('financial').update({ description: JSON.stringify(updated) }).eq('id', id).eq('user_id', user.id);
  },
  deleteRation: async (id: string) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    await supabase.from('financial').delete().eq('id', id).eq('user_id', user.id);
  },

  getIngredientPurchases: async (): Promise<IngredientPurchase[]> => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('financial').select('*').eq('user_id', user.id).eq('type', 'metadata').eq('category', 'purchase');
    if (!data) return [];
    return data.map(d => { try { return JSON.parse(d.description); } catch { return null; } }).filter(Boolean);
  },
  addIngredientPurchase: async (pur: Omit<IngredientPurchase, "id">) => {
    const user = store.auth.getCurrentUser();
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
    } catch (e) {}

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
    return item;
  },
  updateIngredientPurchase: async (id: string, data: Partial<IngredientPurchase>) => {
    const user = store.auth.getCurrentUser();
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
      } catch(e){}

      await supabase.from('financial').update({
          value: updated.total_value,
          date: updated.date,
          payment_method: updated.payment_method || 'Pix',
          description: `Compra de ${updated.total_qty_kg}kg de ${ingName}`
      }).eq('id', expenses[0].id).eq('user_id', user.id);
    }
  },
  deleteIngredientPurchase: async (id: string) => {
    const user = store.auth.getCurrentUser();
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

  // Auth
  auth: {
    signup: async (name: string, email: string, pass: string) => {
      const { data, error } = await supabase.from('users').insert([{
        name,
        email,
        password_hash: btoa(pass)
      }]).select().single();
      if (error) throw error;
      const users = loadUsers();
      users.push(data);
      saveUsers(users);
      return data;
    },
    login: async (email: string, pass: string) => {
      const hash = btoa(pass);
      const { data, error } = await supabase.from('users').select('*').ilike('email', email.trim());
      if (error || !data || data.length === 0) throw new Error("Email não encontrado");
      const user = data.find(u => u.password_hash === hash);
      if (!user) throw new Error("Senha incorreta");
      localStorage.setItem("bovi_session", user.id);
      const users = loadUsers();
      if (!users.find(u => u.id === user.id)) {
        users.push(user);
        saveUsers(users);
      }
      return user;
    },
    logout: () => {
      localStorage.removeItem("bovi_session");
    },
    getCurrentUser: () => {
      const userId = localStorage.getItem("bovi_session");
      if (!userId) return null;
      const users = loadUsers();
      const user = users.find(u => u.id === userId);
      return user || { id: userId, name: "Usuário", email: "", password_hash: "", createdAt: "" };
    }
  },

  // System
  sync: async () => true,
  pushToCloud: async () => true
};
