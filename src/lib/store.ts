const v4 = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
import { supabase } from "./supabase";
import { toast } from "sonner";

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

export interface IngredientPurchase {
  id: string;
  ingredient_id: string;
  total_value: number;
  total_qty_kg: number;
  cost_per_kg: number;
  date: string;
  payment_method?: string;
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

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Fire-and-forget Supabase helper — triggers toast on error
const cloud = (table: string, method: 'insert' | 'update' | 'delete' | 'upsert', data: any, filter?: { col: string, val: any }) => {
  if (!supabase) return;
  const user = store.auth.getCurrentUser();
  if (!user) return;

  // Most operations need the data to be scoped to the user
  let query = supabase.from(table);
  
  if (method === 'insert' || method === 'upsert') {
    const dataWithUser = Array.isArray(data) 
      ? data.map(d => ({ ...d, user_id: user.id }))
      : { ...data, user_id: user.id };
    
    query[method](dataWithUser).then(({ error }: any) => {
      if (error) {
        console.warn(`Supabase ${method} Error (${table}):`, error.message);
        toast.error(`Erro de Sincronização: ${error.message}`);
      }
    });
  } else if (method === 'update') {
    query.update(data).eq(filter!.col, filter!.val).eq('user_id', user.id).then(({ error }: any) => {
      if (error) {
        console.warn("Supabase update Error:", error.message);
      }
    });
  } else if (method === 'delete') {
    query.delete().eq(filter!.col, filter!.val).eq('user_id', user.id).then(({ error }: any) => {
      if (error) {
        console.warn("Supabase delete Error:", error.message);
      }
    });
  }
};

// Helper to format YYYY-MM-DD to DD/MM/YYYY without timezone shifts
export const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "—";
  if (dateStr.includes("T")) dateStr = dateStr.split("T")[0]; // Handle ISO strings
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

// Helper to parse YYYY-MM-DD into a LOCAL Date object (ignoring UTC/Timezone shift)
export const parseDateSafe = (dateStr: string | null | undefined) => {
  if (!dateStr || dateStr.trim() === "") return new Date();
  try {
    if (dateStr.includes("T")) dateStr = dateStr.split("T")[0];
    const parts = dateStr.split("-");
    if (parts.length !== 3) return new Date();
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? new Date() : date;
  } catch {
    return new Date();
  }
};

export const store = {
  // Animals
  getAnimals: () => load<Animal>("bovi_animals"),
  addAnimal: (a: Omit<Animal, "id">) => {
    const list = load<Animal>("bovi_animals");
    const item = { ...a, id: v4() };
    list.push(item);
    save("bovi_animals", list);
    cloud('animals', 'insert', item);
    return item;
  },
  updateAnimal: (id: string, data: Partial<Animal>) => {
    const list = load<Animal>("bovi_animals").map(a => a.id === id ? { ...a, ...data } : a);
    save("bovi_animals", list);
    cloud('animals', 'update', data, { col: 'id', val: id });
  },
  deleteAnimal: (id: string) => {
    const animals = load<Animal>("bovi_animals").filter(a => a.id !== id);
    save("bovi_animals", animals);
    cloud('animals', 'delete', null, { col: 'id', val: id });
    const events = load<AnimalEvent>("bovi_events").filter(e => e.animal_id !== id);
    save("bovi_events", events);
    const health = load<Health>("bovi_health").filter(h => h.animal_id !== id);
    save("bovi_health", health);
  },
  getAnimal: (id: string) => load<Animal>("bovi_animals").find(a => a.id === id),

  // Events
  getEvents: () => load<AnimalEvent>("bovi_events"),
  getEvent: (id: string) => load<AnimalEvent>("bovi_events").find(e => e.id === id),
  getEventsByAnimal: (animalId: string) => load<AnimalEvent>("bovi_events").filter(e => e.animal_id === animalId),
  updateEvent: (id: string, data: Partial<AnimalEvent>) => {
    const list = load<AnimalEvent>("bovi_events").map(e => e.id === id ? { ...e, ...data } : e);
    save("bovi_events", list);
    const event = list.find(e => e.id === id);
    if (event) {
      if (data.type === "pesagem" && data.weight) {
        store.updateAnimal(event.animal_id, { weight: data.weight });
      }
      if (data.type === "venda") {
        store.updateAnimal(event.animal_id, { status: "vendido", peso_saida: data.weight });
      }
      if (data.type === "morte") {
        store.updateAnimal(event.animal_id, { status: "morto", peso_saida: data.weight });
      }
    }
    cloud('events', 'update', data, { col: 'id', val: id });
  },
  addEvent: (e: Omit<AnimalEvent, "id">) => {
    const list = load<AnimalEvent>("bovi_events");
    const item = { ...e, id: v4() };
    list.push(item);
    save("bovi_events", list);
    if (e.type === "pesagem" && e.weight) {
      store.updateAnimal(e.animal_id, { weight: e.weight });
    }
    if (e.type === "venda") {
      store.updateAnimal(e.animal_id, { status: "vendido", peso_saida: e.weight });
    }
    if (e.type === "morte") {
      store.updateAnimal(e.animal_id, { status: "morto", peso_saida: e.weight });
    }
    cloud('events', 'insert', item);
    return item;
  },

  // Financial
  getFinancials: () => load<Financial>("bovi_financial"),
  addFinancial: (f: Omit<Financial, "id">, installments: number = 1) => {
    const list = load<Financial>("bovi_financial");
    const items: Financial[] = [];
    
    if (installments > 1) {
      const valuePerInstallment = f.value / installments;
      const baseDate = parseDateSafe(f.date);
      
      for (let i = 0; i < installments; i++) {
        // Create a new date object for each installment, incrementing the month
        const instDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
        const instDateStr = instDate.toISOString().split("T")[0];
        
        const item = { 
          ...f, 
          id: v4(), 
          value: valuePerInstallment, 
          date: instDateStr,
          description: `${f.description} (${i + 1}/${installments})` 
        };
        items.push(item);
      }
    } else {
      items.push({ ...f, id: v4() });
    }

    list.push(...items);
    save("bovi_financial", list);
    cloud('financial', 'insert', items);
    return items[0];
  },
  updateFinancial: (id: string, data: Partial<Financial>) => {
    const list = load<Financial>("bovi_financial").map(f => f.id === id ? { ...f, ...data } : f);
    save("bovi_financial", list);
    cloud('financial', 'update', data, { col: 'id', val: id });
  },
  deleteFinancial: (id: string) => {
    const list = load<Financial>("bovi_financial").filter(f => f.id !== id);
    save("bovi_financial", list);
    cloud('financial', 'delete', null, { col: 'id', val: id });
  },

  // Health
  getHealthRecords: () => load<Health>("bovi_health"),
  addHealth: (h: Omit<Health, "id">) => {
    const list = load<Health>("bovi_health");
    const item = { ...h, id: v4() };
    list.push(item);
    save("bovi_health", list);
    cloud('health', 'insert', item);
    return item;
  },
  updateHealth: (id: string, data: Partial<Health>) => {
    const list = load<Health>("bovi_health").map(h => h.id === id ? { ...h, ...data } : h);
    save("bovi_health", list);
    cloud('health', 'update', data, { col: 'id', val: id });
  },
  deleteHealth: (id: string) => {
    const list = load<Health>("bovi_health").filter(h => h.id !== id);
    save("bovi_health", list);
    cloud('health', 'delete', null, { col: 'id', val: id });
  },
  getUpcomingAlerts: () => {
    const today = new Date().toISOString().split("T")[0];
    return load<Health>("bovi_health").filter(h => h.next_date && h.next_date <= today);
  },

  // --- FEEDING MODULE ---

  // Ingredients
  getIngredients: () => load<Ingredient>("bovi_ingredients"),
  getIngredient: (id: string) => load<Ingredient>("bovi_ingredients").find(i => i.id === id),
  addIngredient: (i: Omit<Ingredient, "id">) => {
    const list = load<Ingredient>("bovi_ingredients");
    const item = { ...i, id: v4() };
    list.push(item);
    save("bovi_ingredients", list);
    cloud('ingredients', 'insert', item);
    return item;
  },
  updateIngredient: (id: string, data: Partial<Ingredient>) => {
    const list = load<Ingredient>("bovi_ingredients").map(i => i.id === id ? { ...i, ...data } : i);
    save("bovi_ingredients", list);
    cloud('ingredients', 'update', data, { col: 'id', val: id });
  },
  deleteIngredient: (id: string) => {
    const list = load<Ingredient>("bovi_ingredients").filter(i => i.id !== id);
    save("bovi_ingredients", list);
    cloud('ingredients', 'delete', null, { col: 'id', val: id });
  },

  // Rations
  getRations: () => load<Ration>("bovi_rations"),
  getRation: (id: string) => load<Ration>("bovi_rations").find(r => r.id === id),
  addRation: (r: Omit<Ration, "id">) => {
    const list = load<Ration>("bovi_rations");
    const item = { ...r, id: v4() };
    list.push(item);
    save("bovi_rations", list);
    cloud('rations', 'insert', item);
    return item;
  },
  updateRation: (id: string, data: Partial<Ration>) => {
    const list = load<Ration>("bovi_rations").map(r => r.id === id ? { ...r, ...data } : r);
    save("bovi_rations", list);
    cloud('rations', 'update', data, { col: 'id', val: id });
  },
  deleteRation: (id: string) => {
    const list = load<Ration>("bovi_rations").filter(r => r.id !== id);
    save("bovi_rations", list);
    cloud('rations', 'delete', null, { col: 'id', val: id });
  },

  // Feeding Logs
  getFeedingLogs: () => load<FeedingLog>("bovi_feeding_logs"),
  addFeedingLog: (l: Omit<FeedingLog, "id">) => {
    const list = load<FeedingLog>("bovi_feeding_logs");
    const item = { ...l, id: v4() };
    list.push(item);
    save("bovi_feeding_logs", list);
    store.addFinancial({
      type: "despesa",
      category: "Alimentação",
      description: `Alimentação - ${l.num_animals} animais/lote`,
      value: l.total_cost,
      date: l.date
    });
    cloud('feeding_logs', 'insert', item);
    return item;
  },

  // Purchases
  getIngredientPurchases: () => load<IngredientPurchase>("bovi_purchases"),
  addIngredientPurchase: (p: Omit<IngredientPurchase, "id">) => {
    const list = load<IngredientPurchase>("bovi_purchases");
    const item = { ...p, id: v4() };
    list.push(item);
    save("bovi_purchases", list);
    store.updateIngredient(p.ingredient_id, { cost_per_kg: p.cost_per_kg });
    const ing = store.getIngredient(p.ingredient_id);
    store.addFinancial({
      type: "despesa",
      category: "Alimentação",
      payment_method: p.payment_method,
      description: `Compra: ${ing?.name || 'Insumo'} (${p.total_qty_kg}kg)`,
      value: p.total_value,
      date: p.date
    });
    cloud('purchases', 'insert', item);
    return item;
  },
  updateIngredientPurchase: (id: string, data: Partial<IngredientPurchase>) => {
    const list = load<IngredientPurchase>("bovi_purchases").map(p => {
      if (p.id === id) {
        const updated = { ...p, ...data };
        if (data.total_value !== undefined || data.total_qty_kg !== undefined) {
          updated.cost_per_kg = updated.total_value / updated.total_qty_kg;
          store.updateIngredient(updated.ingredient_id, { cost_per_kg: updated.cost_per_kg });
        }
        return updated;
      }
      return p;
    });
    save("bovi_purchases", list);
    cloud('purchases', 'update', data, { col: 'id', val: id });
  },
  deleteIngredientPurchase: (id: string) => {
    const list = load<IngredientPurchase>("bovi_purchases").filter(p => p.id !== id);
    save("bovi_purchases", list);
    cloud('purchases', 'delete', null, { col: 'id', val: id });
  },

  // Insemination
  getInseminations: () => load<Insemination>("bovi_inseminations"),
  addInsemination: (ins: Omit<Insemination, "id">) => {
    const list = load<Insemination>("bovi_inseminations");
    const item = { ...ins, id: v4() };
    list.push(item);
    save("bovi_inseminations", list);
    cloud('inseminations', 'insert', item);
    return item;
  },
  updateInsemination: (id: string, data: Partial<Insemination>) => {
    const list = load<Insemination>("bovi_inseminations").map(ins => ins.id === id ? { ...ins, ...data } : ins);
    save("bovi_inseminations", list);
    cloud('inseminations', 'update', data, { col: 'id', val: id });
  },
  getInseminationsByAnimal: (animalId: string) => load<Insemination>("bovi_inseminations").filter(ins => ins.animal_id === animalId),

  clearFinancials: () => {
    save("bovi_financial", []);
    save("bovi_feeding_logs", []);
    save("bovi_purchases", []);
  },

  // --- AUTH MODULE ---
  auth: {
    getUsers: () => load<User>("bovi_users"),
    signup: async (name: string, email: string, pass: string) => {
      if (!supabase) throw new Error("Supabase não configurado");
      // Create user in Supabase
      const { data, error } = await supabase.from('users').insert([{
        name,
        email,
        password_hash: btoa(pass)
      }]).select().single();

      if (error) throw error;
      
      const users = load<User>("bovi_users");
      users.push(data);
      save("bovi_users", users);
      return data;
    },
    login: async (email: string, pass: string) => {
      if (!supabase) throw new Error("Supabase não configurado");
      // Try with simple btoa
      const hash1 = btoa(pass);
      const hash2 = btoa(unescape(encodeURIComponent(pass)));
      
      const { data, error } = await supabase.from('users')
        .select('*')
        .ilike('email', email.trim());

      if (error || !data || data.length === 0) {
        throw new Error("Email não encontrado");
      }

      const user = data.find(u => u.password_hash === hash1 || u.password_hash === hash2);
      
      if (!user) {
        throw new Error("Senha incorreta");
      }
      
      localStorage.setItem("bovi_session", user.id);
      
      // Cache user locally to avoid "Usuário" fallback
      const users = load<User>("bovi_users");
      if (!users.find(u => u.id === user.id)) {
        users.push(user);
        save("bovi_users", users);
      }
      
      return user;
    },
    resetPassword: async (email: string, newPass: string) => {
      if (!supabase) throw new Error("Supabase não configurado");
      const { data, error } = await supabase.from('users')
        .update({ password_hash: btoa(newPass) })
        .ilike('email', email.trim())
        .select();

      if (error || !data || data.length === 0) throw new Error("E-mail não encontrado");
      return true;
    },
    logout: () => {
      localStorage.removeItem("bovi_session");
    },
    getCurrentUser: () => {
      const userId = localStorage.getItem("bovi_session");
      if (!userId) return null;
      const users = load<User>("bovi_users");
      const user = users.find(u => u.id === userId);
      // Return the cached user if found, otherwise return a minimal object with just the ID
      // This prevents immediate redirects before sync completes on page reload
      return user || { id: userId, name: "Usuário", email: "", password_hash: "", createdAt: "" };
    }
  },

  // --- SYNC SYSTEM ---
  sync: async () => {
    try {
      const tables = [
        'animals', 'events', 'financial', 'inseminations', 'users',
        'ingredients', 'rations', 'feeding_logs', 'purchases', 'health'
      ];
      console.log("Sync iniciada...");
      for (const table of tables) {
        if (!supabase) {
           console.warn("Supabase não inicializado, pulando sincronização.");
           break;
        }
        try {
          const { data, error } = await supabase.from(table).select('*');
          if (error) {
            console.warn(`Erro na tabela ${table}:`, error.message);
            continue;
          }
          if (data && data.length > 0) {
            save(`bovi_${table}`, data);
            console.log(`Tabela '${table}' sincronizada: ${data.length} registros`);
          } else {
            console.log(`Tabela '${table}' está vazia no servidor.`);
          }
        } catch (e: any) {
          console.warn(`Exceção na tabela '${table}':`, e.message);
        }
      }
      localStorage.setItem("bovi_last_sync", new Date().toISOString());
      console.log("Sincronização concluída com sucesso.");
      return true;
    } catch (e) {
      console.error("Erro fatal na sincronização", e);
      return false;
    }
  },
  // --- MIGRATION: UPLOAD LOCAL TO CLOUD ---
  pushToCloud: async () => {
    if (!supabase) {
      toast.error("Supabase não configurado. Impossível enviar dados.");
      return false;
    }
    try {
      const tables = [
        { key: 'bovi_animals', table: 'animals' },
        { key: 'bovi_events', table: 'events' },
        { key: 'bovi_financial', table: 'financial' },
        { key: 'bovi_users', table: 'users' },
        { key: 'bovi_ingredients', table: 'ingredients' },
        { key: 'bovi_rations', table: 'rations' },
        { key: 'bovi_purchases', table: 'purchases' },
        { key: 'bovi_health', table: 'health' },
        { key: 'bovi_inseminations', table: 'inseminations' }
      ];

      toast.info("Iniciando upload para nuvem...");
      
      for (const t of tables) {
        const localData = load<any>(t.key);
        if (localData.length === 0) continue;

        // Inject user_id into every item being pushed
        const user = store.auth.getCurrentUser();
        if (!user) continue;

        const dataToPush = localData.map(item => ({
          ...item,
          user_id: user.id
        }));

        console.log(`Subindo ${t.table}...`);
        const { error } = await supabase.from(t.table).upsert(dataToPush);
        
        if (error) {
          console.warn(`Erro no upload da tabela ${t.table}:`, error.message);
          if (error.code === '42P01') {
             toast.error(`Tabela '${t.table}' não existe no banco de dados. Execute o script SQL.`);
          }
        } else {
          console.log(`Tabela '${t.table}' enviada com sucesso!`);
        }
      }
      
      toast.success("Todos os dados locais foram enviados para a nuvem! 🚀");
      return true;
    } catch (e: any) {
      console.error("Erro no Push-to-Cloud", e);
      toast.error("Falha ao enviar dados para a nuvem.");
      return false;
    }
  }
};
