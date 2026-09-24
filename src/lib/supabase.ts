import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isRealSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'seu_projeto_aqui' &&
  supabaseAnonKey !== 'sua_chave_anon_aqui' &&
  supabaseUrl.startsWith('http')
);

if (!isRealSupabaseConfigured) {
  console.info("FazendaControl: Rodando em modo de banco local/offline com persistência.");
}

// In-memory / LocalStorage fallback client when Supabase is not configured
function createLocalClient() {
  const getTableData = (table: string): any[] => {
    try {
      const raw = localStorage.getItem(`fc_db_${table}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }

    // Seed default sample data for a rich initial experience
    if (table === 'users') {
      const defaultUsers = [{
        id: "demo-user-01",
        name: "Gabriel Produtor",
        email: "produtor@fazendacontrol.com",
        farm_name: "Fazenda Santa Maria",
        cpf: "12345678901",
        createdAt: new Date().toISOString()
      }];
      setTableData('users', defaultUsers);
      return defaultUsers;
    }

    if (table === 'animals') {
      const defaultAnimals = [
        {
          id: "animal-01",
          tag: "BR-0101",
          birth_date: "2024-03-15",
          sex: "Macho",
          breed: "Nelore",
          weight: 420,
          status: "ativo",
          categoria: "Boi Gordo",
          lot: "Lote Confinamento A",
          origem: "Cria Própria",
          data_compra: "2025-01-10",
          valor_compra: 3200,
          preco_arroba: 285,
          peso_entrada: 380,
          user_id: "demo-user-01"
        },
        {
          id: "animal-02",
          tag: "BR-0102",
          birth_date: "2024-04-20",
          sex: "Macho",
          breed: "Angus",
          weight: 460,
          status: "ativo",
          categoria: "Boi Gordo",
          lot: "Lote Confinamento A",
          origem: "Compra",
          data_compra: "2025-01-10",
          valor_compra: 3500,
          preco_arroba: 290,
          peso_entrada: 410,
          user_id: "demo-user-01"
        },
        {
          id: "animal-03",
          tag: "BR-0103",
          birth_date: "2023-11-10",
          sex: "Fêmea",
          breed: "Nelore",
          weight: 490,
          status: "ativo",
          categoria: "Matriz",
          lot: "Lote Matrizes Pasto",
          origem: "Cria Própria",
          preco_arroba: 280,
          user_id: "demo-user-01"
        },
        {
          id: "animal-04",
          tag: "BR-0104",
          birth_date: "2024-05-02",
          sex: "Macho",
          breed: "Braford",
          weight: 395,
          status: "ativo",
          categoria: "Garrote",
          lot: "Lote Recria 1",
          origem: "Compra",
          data_compra: "2025-02-01",
          valor_compra: 2800,
          preco_arroba: 285,
          peso_entrada: 340,
          user_id: "demo-user-01"
        },
        {
          id: "animal-05",
          tag: "BR-0098",
          birth_date: "2023-08-14",
          sex: "Macho",
          breed: "Nelore",
          weight: 540,
          status: "vendido",
          categoria: "Boi Gordo",
          lot: "Lote Confinamento A",
          origem: "Cria Própria",
          peso_saida: 540,
          valor_venda: 5130,
          data_saida: "2025-08-20",
          user_id: "demo-user-01"
        }
      ];
      setTableData('animals', defaultAnimals);
      return defaultAnimals;
    }

    if (table === 'financial') {
      const defaultFinancial = [
        {
          id: "fin-01",
          type: "receita",
          description: "Venda Lote Confinamento (3 animais)",
          value: 15390,
          date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          category: "Venda de Animais",
          payment_method: "Transferência PIX",
          user_id: "demo-user-01"
        },
        {
          id: "fin-02",
          type: "despesa",
          description: "Compra Ração Farelo de Soja (2.000 kg)",
          value: 4800,
          date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
          category: "Alimentação",
          payment_method: "Boleto",
          user_id: "demo-user-01"
        },
        {
          id: "fin-03",
          type: "despesa",
          description: "Vacinas e Medicamentos Aftosa",
          value: 1250,
          date: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
          category: "Sanidade",
          payment_method: "Cartão de Crédito",
          user_id: "demo-user-01"
        }
      ];
      setTableData('financial', defaultFinancial);
      return defaultFinancial;
    }

    return [];
  };

  const setTableData = (table: string, data: any[]) => {
    try {
      localStorage.setItem(`fc_db_${table}`, JSON.stringify(data));
    } catch {
      // storage error ignored
    }
  };

  class QueryBuilder {
    private table: string;
    private filters: ((item: any) => boolean)[] = [];
    private orderCol?: string;
    private orderAsc: boolean = true;
    private limitNum?: number;
    private isSingle: boolean = false;
    private isMaybeSingle: boolean = false;
    private selectCols: string = '*';

    constructor(table: string) {
      this.table = table;
    }

    select(cols: string = '*') {
      this.selectCols = cols;
      return this;
    }

    eq(col: string, val: any) {
      this.filters.push(item => item[col] === val);
      return this;
    }

    neq(col: string, val: any) {
      this.filters.push(item => item[col] !== val);
      return this;
    }

    in(col: string, vals: any[]) {
      this.filters.push(item => vals.includes(item[col]));
      return this;
    }

    order(col: string, options?: { ascending?: boolean }) {
      this.orderCol = col;
      this.orderAsc = options?.ascending !== false;
      return this;
    }

    limit(n: number) {
      this.limitNum = n;
      return this;
    }

    single() {
      this.isSingle = true;
      return this;
    }

    maybeSingle() {
      this.isMaybeSingle = true;
      return this;
    }

    async insert(rows: any | any[]) {
      const items = Array.isArray(rows) ? rows : [rows];
      const current = getTableData(this.table);
      const inserted: any[] = [];

      for (const row of items) {
        const item = {
          id: row.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
          ...row
        };
        current.push(item);
        inserted.push(item);
      }

      setTableData(this.table, current);
      return {
        data: Array.isArray(rows) ? inserted : inserted[0],
        error: null,
        select: () => ({
          single: async () => ({ data: inserted[0], error: null }),
          then: (resolve: any) => resolve({ data: Array.isArray(rows) ? inserted : inserted[0], error: null })
        })
      };
    }

    async update(values: any) {
      const current = getTableData(this.table);
      const updatedList: any[] = [];

      const next = current.map(item => {
        const match = this.filters.every(f => f(item));
        if (match) {
          const updated = { ...item, ...values };
          updatedList.push(updated);
          return updated;
        }
        return item;
      });

      setTableData(this.table, next);
      return {
        data: updatedList,
        error: null,
        select: () => ({
          single: async () => ({ data: updatedList[0] || null, error: null }),
          then: (resolve: any) => resolve({ data: updatedList, error: null })
        })
      };
    }

    async upsert(data: any) {
      const items = Array.isArray(data) ? data : [data];
      const current = getTableData(this.table);
      const result: any[] = [];

      for (const row of items) {
        const idx = current.findIndex(c => (row.id && c.id === row.id) || (row.key && c.key === row.key && c.user_id === row.user_id));
        if (idx >= 0) {
          current[idx] = { ...current[idx], ...row };
          result.push(current[idx]);
        } else {
          const newItem = {
            id: row.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
            ...row
          };
          current.push(newItem);
          result.push(newItem);
        }
      }

      setTableData(this.table, current);
      return { data: Array.isArray(data) ? result : result[0], error: null };
    }

    async delete() {
      const current = getTableData(this.table);
      const kept = current.filter(item => !this.filters.every(f => f(item)));
      setTableData(this.table, kept);
      return { error: null, data: null };
    }

    async execute() {
      let list = getTableData(this.table);

      if (this.filters.length > 0) {
        list = list.filter(item => this.filters.every(f => f(item)));
      }

      if (this.orderCol) {
        const col = this.orderCol;
        const asc = this.orderAsc;
        list = [...list].sort((a, b) => {
          const va = a[col] ?? "";
          const vb = b[col] ?? "";
          if (va < vb) return asc ? -1 : 1;
          if (va > vb) return asc ? 1 : -1;
          return 0;
        });
      }

      if (this.limitNum != null) {
        list = list.slice(0, this.limitNum);
      }

      if (this.isSingle) {
        return { data: list[0] || null, error: list.length === 0 ? new Error("Record not found") : null };
      }

      if (this.isMaybeSingle) {
        return { data: list[0] || null, error: null };
      }

      return { data: list, error: null };
    }

    then(resolve: (val: any) => any, reject?: (reason: any) => any) {
      return this.execute().then(resolve, reject);
    }
  }

  const auth = {
    getSession: async () => {
      try {
        const rawSession = localStorage.getItem("bovi_session");
        const rawProfile = localStorage.getItem("bovi_user_profile");
        if (rawSession && rawProfile) {
          const profile = JSON.parse(rawProfile);
          return {
            data: {
              session: {
                user: {
                  id: profile.id,
                  email: profile.email,
                  user_metadata: {
                    name: profile.name,
                    farm_name: profile.farm_name,
                    cpf: profile.cpf
                  }
                },
                access_token: "mock_jwt_token",
                refresh_token: "mock_refresh_token"
              }
            },
            error: null
          };
        }
      } catch {
        // ignore
      }
      return { data: { session: null }, error: null };
    },

    setSession: async ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) => {
      const users = getTableData('users');
      const user = users[0] || { id: "demo-user-01", name: "Gabriel Produtor", email: "produtor@fazendacontrol.com" };
      return {
        data: {
          session: {
            user: { id: user.id, email: user.email, user_metadata: user }
          }
        },
        error: null
      };
    },

    signUp: async ({ email, password, options }: any) => {
      const cleanEmail = (email || "").trim().toLowerCase();
      const users = getTableData('users');
      const existing = users.find(u => u.email === cleanEmail);
      if (existing) {
        return { data: { user: null }, error: { message: "User already registered" } };
      }

      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      const newUser = {
        id,
        email: cleanEmail,
        name: options?.data?.name || "Produtor",
        farm_name: options?.data?.farm_name || "Fazenda",
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      setTableData('users', users);

      return {
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            user_metadata: options?.data || {}
          }
        },
        error: null
      };
    },

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const cleanEmail = (email || "").trim().toLowerCase();
      const users = getTableData('users');
      let user = users.find(u => u.email === cleanEmail);

      // If logging in for the first time with an arbitrary email or demo credentials
      if (!user) {
        user = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          email: cleanEmail,
          name: cleanEmail.split('@')[0] || "Produtor",
          farm_name: "Fazenda Santa Maria",
          createdAt: new Date().toISOString()
        };
        users.push(user);
        setTableData('users', users);
      }

      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: {
              name: user.name,
              farm_name: user.farm_name,
              cpf: user.cpf
            }
          }
        },
        error: null
      };
    },

    updateUser: async (updates: any) => {
      const rawProfile = localStorage.getItem("bovi_user_profile");
      if (rawProfile) {
        try {
          const profile = JSON.parse(rawProfile);
          const updated = {
            ...profile,
            ...updates?.data,
            name: updates?.data?.name || profile.name,
            farm_name: updates?.data?.farm_name || profile.farm_name,
            cpf: updates?.data?.cpf || profile.cpf
          };
          localStorage.setItem("bovi_user_profile", JSON.stringify(updated));
          return { data: { user: updated }, error: null };
        } catch {
          // ignore
        }
      }
      return { data: { user: null }, error: null };
    },

    signOut: async () => {
      return { error: null };
    },

    resetPasswordForEmail: async (email: string, options?: any) => {
      return { data: {}, error: null };
    }
  };

  return {
    auth,
    from: (table: string) => new QueryBuilder(table)
  } as unknown as ReturnType<typeof createClient>;
}

export const supabase = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createLocalClient();
