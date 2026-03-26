import { supabase } from "./supabase";
import { toast } from "sonner";

// Helper to generate UUIDs locally if needed (though Supabase usually handles it)
const v4 = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

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
    return (data || []).sort((a, b) => b.tag.localeCompare(a.tag));
  },
  addAnimal: async (a: Omit<Animal, "id">) => {
    const user = store.auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = { ...a, user_id: user.id, id: v4() };
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
    const { error } = await supabase.from('animals').update(data).eq('id', id).eq('user_id', user.id);
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
  getEventsByAnimal: async (animalId: string) => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('events').select('*').eq('animal_id', animalId).eq('user_id', user.id).order('date', { ascending: false });
    return data || [];
  },
  getFeedingLogs: async () => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    // Feeding logs are stored in the events table with type 'alimentacao'
    const { data } = await supabase.from('events').select('*').eq('user_id', user.id).eq('type', 'alimentacao');
    return data || [];
  },
  addEvent: async (e: Omit<AnimalEvent, "id">) => {
    const user = store.auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    const item = { ...e, user_id: user.id, id: v4() };
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
    const { data } = await supabase.from('financial').select('*').eq('user_id', user.id).order('date', { ascending: false });
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
    const { data, error } = await supabase.from('financial').insert(items).select();
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
    const item = { ...ins, id: v4(), user_id: user.id };
    const { data, error } = await supabase.from('insemination').insert([item]).select().single();
    if (error) throw error;
    return data;
  },
  addHealth: async (h: Omit<Health, "id">) => {
    const user = store.auth.getCurrentUser();
    if (!user) throw new Error("Não autenticado");
    // Using insemination table for health as per mapping
    const item = { ...h, id: v4(), user_id: user.id };
    const { data, error } = await supabase.from('insemination').insert([item]).select().single();
    if (error) throw error;
    return data;
  },
  updateInsemination: async (id: string, data: Partial<Insemination>) => {
    const user = store.auth.getCurrentUser();
    if (!user) return;
    await supabase.from('insemination').update(data).eq('id', id).eq('user_id', user.id);
  },

  // Ingredients stored in 'animals' for now
  getIngredients: async () => {
    const user = store.auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase.from('animals').select('*').eq('user_id', user.id).eq('status', 'ingredient');
    return data || []; 
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
