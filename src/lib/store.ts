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
}

export interface Health {
  id: string;
  animal_id: string;
  type: string;
  date: string;
  next_date: string;
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
const cloud = (promise: Promise<any> | null) => {
  if (!promise) return;
  promise.then(({ error }: any) => {
    if (error) {
      console.warn("Supabase Error:", error.message);
      toast.error(`Erro de Sincronização: ${error.message}. Seus dados estão salvos apenas neste dispositivo.`);
    }
  }).catch((e: any) => {
    console.warn("Supabase offline:", e);
    toast.error("Sem conexão com o servidor. Dados salvos apenas localmente.");
  });
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
export const parseDateSafe = (dateStr: string) => {
  if (!dateStr) return new Date();
  if (dateStr.includes("T")) dateStr = dateStr.split("T")[0];
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const store = {
  // Animals
  getAnimals: () => load<Animal>("bovi_animals"),
  addAnimal: (a: Omit<Animal, "id">) => {
    const list = load<Animal>("bovi_animals");
    const item = { ...a, id: v4() };
    list.push(item);
    save("bovi_animals", list);
    cloud(supabase?.from('animals').insert([item]));
    return item;
  },
  updateAnimal: (id: string, data: Partial<Animal>) => {
    const list = load<Animal>("bovi_animals").map(a => a.id === id ? { ...a, ...data } : a);
    save("bovi_animals", list);
    cloud(supabase?.from('animals').update(data).eq('id', id));
  },
  deleteAnimal: (id: string) => {
    const animals = load<Animal>("bovi_animals").filter(a => a.id !== id);
    save("bovi_animals", animals);
    cloud(supabase?.from('animals').delete().eq('id', id));
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
    cloud(supabase?.from('events').update(data).eq('id', id));
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
    cloud(supabase?.from('events').insert([item]));
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
    cloud(supabase?.from('financial').insert(items));
    return items[0];
  },
  updateFinancial: (id: string, data: Partial<Financial>) => {
    const list = load<Financial>("bovi_financial").map(f => f.id === id ? { ...f, ...data } : f);
    save("bovi_financial", list);
    cloud(supabase?.from('financial').update(data).eq('id', id));
  },
  deleteFinancial: (id: string) => {
    const list = load<Financial>("bovi_financial").filter(f => f.id !== id);
    save("bovi_financial", list);
    cloud(supabase?.from('financial').delete().eq('id', id));
  },

  // Health
  getHealthRecords: () => load<Health>("bovi_health"),
  addHealth: (h: Omit<Health, "id">) => {
    const list = load<Health>("bovi_health");
    const item = { ...h, id: v4() };
    list.push(item);
    save("bovi_health", list);
    cloud(supabase?.from('health').insert([item]));
    return item;
  },
  updateHealth: (id: string, data: Partial<Health>) => {
    const list = load<Health>("bovi_health").map(h => h.id === id ? { ...h, ...data } : h);
    save("bovi_health", list);
    cloud(supabase?.from('health').update(data).eq('id', id));
  },
  deleteHealth: (id: string) => {
    const list = load<Health>("bovi_health").filter(h => h.id !== id);
    save("bovi_health", list);
    cloud(supabase?.from('health').delete().eq('id', id));
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
    cloud(supabase?.from('ingredients').insert([item]));
    return item;
  },
  updateIngredient: (id: string, data: Partial<Ingredient>) => {
    const list = load<Ingredient>("bovi_ingredients").map(i => i.id === id ? { ...i, ...data } : i);
    save("bovi_ingredients", list);
    cloud(supabase?.from('ingredients').update(data).eq('id', id));
  },
  deleteIngredient: (id: string) => {
    const list = load<Ingredient>("bovi_ingredients").filter(i => i.id !== id);
    save("bovi_ingredients", list);
    cloud(supabase?.from('ingredients').delete().eq('id', id));
  },

  // Rations
  getRations: () => load<Ration>("bovi_rations"),
  getRation: (id: string) => load<Ration>("bovi_rations").find(r => r.id === id),
  addRation: (r: Omit<Ration, "id">) => {
    const list = load<Ration>("bovi_rations");
    const item = { ...r, id: v4() };
    list.push(item);
    save("bovi_rations", list);
    cloud(supabase?.from('rations').insert([item]));
    return item;
  },
  updateRation: (id: string, data: Partial<Ration>) => {
    const list = load<Ration>("bovi_rations").map(r => r.id === id ? { ...r, ...data } : r);
    save("bovi_rations", list);
    cloud(supabase?.from('rations').update(data).eq('id', id));
  },
  deleteRation: (id: string) => {
    const list = load<Ration>("bovi_rations").filter(r => r.id !== id);
    save("bovi_rations", list);
    cloud(supabase?.from('rations').delete().eq('id', id));
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
    cloud(supabase?.from('feeding_logs').insert([item]));
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
    cloud(supabase?.from('purchases').insert([item]));
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
    cloud(supabase?.from('purchases').update(data).eq('id', id));
  },
  deleteIngredientPurchase: (id: string) => {
    const list = load<IngredientPurchase>("bovi_purchases").filter(p => p.id !== id);
    save("bovi_purchases", list);
    cloud(supabase?.from('purchases').delete().eq('id', id));
  },

  // Insemination
  getInseminations: () => load<Insemination>("bovi_inseminations"),
  addInsemination: (ins: Omit<Insemination, "id">) => {
    const list = load<Insemination>("bovi_inseminations");
    const item = { ...ins, id: v4() };
    list.push(item);
    save("bovi_inseminations", list);
    cloud(supabase?.from('inseminations').insert([item]));
    return item;
  },
  updateInsemination: (id: string, data: Partial<Insemination>) => {
    const list = load<Insemination>("bovi_inseminations").map(ins => ins.id === id ? { ...ins, ...data } : ins);
    save("bovi_inseminations", list);
    cloud(supabase?.from('inseminations').update(data).eq('id', id));
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
  }
};
