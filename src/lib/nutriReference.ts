// Tabela de referência bromatológica (valores médios brasileiros - % na MS)
// Fonte: CQBAL 4.0 / UFV / NRC
export const NUTRI_REFERENCE: Record<string, { pb: number; ndt: number; fdn: number; ca: number; p: number; type: string }> = {
  "milho": { pb: 9, ndt: 88, fdn: 12, ca: 0.03, p: 0.30, type: "Energia" },
  "milho grão": { pb: 9, ndt: 88, fdn: 12, ca: 0.03, p: 0.30, type: "Energia" },
  "milho moído": { pb: 9, ndt: 88, fdn: 12, ca: 0.03, p: 0.30, type: "Energia" },
  "sorgo": { pb: 10, ndt: 82, fdn: 18, ca: 0.04, p: 0.30, type: "Energia" },
  "sorgo grão": { pb: 10, ndt: 82, fdn: 18, ca: 0.04, p: 0.30, type: "Energia" },
  "farelo de soja": { pb: 46, ndt: 80, fdn: 14, ca: 0.35, p: 0.65, type: "Proteína" },
  "soja farelo": { pb: 46, ndt: 80, fdn: 14, ca: 0.35, p: 0.65, type: "Proteína" },
  "farelo soja": { pb: 46, ndt: 80, fdn: 14, ca: 0.35, p: 0.65, type: "Proteína" },
  "casca de soja": { pb: 12, ndt: 74, fdn: 65, ca: 0.50, p: 0.20, type: "Volumoso" },
  "caroço de algodão": { pb: 23, ndt: 90, fdn: 48, ca: 0.15, p: 0.60, type: "Proteína" },
  "farelo de algodão": { pb: 38, ndt: 72, fdn: 32, ca: 0.20, p: 0.90, type: "Proteína" },
  "algodão farelo": { pb: 38, ndt: 72, fdn: 32, ca: 0.20, p: 0.90, type: "Proteína" },
  "polpa cítrica": { pb: 7, ndt: 82, fdn: 24, ca: 1.50, p: 0.15, type: "Energia" },
  "polpa de citrus": { pb: 7, ndt: 82, fdn: 24, ca: 1.50, p: 0.15, type: "Energia" },
  "silagem de milho": { pb: 7.5, ndt: 66, fdn: 50, ca: 0.25, p: 0.20, type: "Volumoso" },
  "silagem milho": { pb: 7.5, ndt: 66, fdn: 50, ca: 0.25, p: 0.20, type: "Volumoso" },
  "cana de açúcar": { pb: 3, ndt: 60, fdn: 55, ca: 0.30, p: 0.06, type: "Volumoso" },
  "cana": { pb: 3, ndt: 60, fdn: 55, ca: 0.30, p: 0.06, type: "Volumoso" },
  "ureia": { pb: 281, ndt: 0, fdn: 0, ca: 0, p: 0, type: "Proteína" },
  "uréia": { pb: 281, ndt: 0, fdn: 0, ca: 0, p: 0, type: "Proteína" },
  "sal mineral": { pb: 0, ndt: 0, fdn: 0, ca: 15, p: 8, type: "Mineral" },
  "mineral": { pb: 0, ndt: 0, fdn: 0, ca: 15, p: 8, type: "Mineral" },
  "núcleo": { pb: 40, ndt: 20, fdn: 5, ca: 2, p: 1, type: "Núcleo" },
  "nucleo": { pb: 40, ndt: 20, fdn: 5, ca: 2, p: 1, type: "Núcleo" },
  "premix": { pb: 0, ndt: 0, fdn: 0, ca: 0, p: 0, type: "Núcleo" },
  "farelo de trigo": { pb: 16, ndt: 72, fdn: 45, ca: 0.15, p: 1.00, type: "Energia" },
  "trigo farelo": { pb: 16, ndt: 72, fdn: 45, ca: 0.15, p: 1.00, type: "Energia" },
  "ddgs milho": { pb: 30, ndt: 85, fdn: 35, ca: 0.10, p: 0.80, type: "Proteína" },
  "feno de tifton": { pb: 10, ndt: 55, fdn: 76, ca: 0.40, p: 0.20, type: "Volumoso" },
  "feno": { pb: 8, ndt: 52, fdn: 75, ca: 0.40, p: 0.20, type: "Volumoso" },
  "melaço": { pb: 4, ndt: 75, fdn: 0, ca: 0.80, p: 0.08, type: "Energia" },
};

// Tenta encontrar valores de referência baseado no nome do ingrediente
export function findNutriReference(name: string): { pb: number; ndt: number; fdn: number; ca: number; p: number; type: string } | null {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  // Busca exata
  if (NUTRI_REFERENCE[normalized]) return NUTRI_REFERENCE[normalized];
  // Busca parcial
  for (const [key, val] of Object.entries(NUTRI_REFERENCE)) {
    if (normalized.includes(key) || key.includes(normalized)) return val;
  }
  return null;
}

// Retorna os valores nutricionais efetivos de um ingrediente:
// usa os dados salvos se existirem, senão faz fallback para a tabela de referência
export function getEffectiveNutri(ing: { name?: string; pb?: number; ndt?: number; fdn?: number; ca?: number; p?: number }) {
  const hasSavedValues = (ing.pb && ing.pb > 0) || (ing.ndt && ing.ndt > 0) || (ing.fdn && ing.fdn > 0);
  
  if (hasSavedValues) {
    return {
      pb: ing.pb || 0,
      ndt: ing.ndt || 0,
      fdn: ing.fdn || 0,
      ca: (ing as any).ca || 0,
      p: (ing as any).p || 0,
    };
  }

  // Fallback: busca na tabela de referência pelo nome
  const ref = findNutriReference(ing.name || "");
  if (ref) {
    return { pb: ref.pb, ndt: ref.ndt, fdn: ref.fdn, ca: ref.ca, p: ref.p };
  }

  return { pb: 0, ndt: 0, fdn: 0, ca: 0, p: 0 };
}
