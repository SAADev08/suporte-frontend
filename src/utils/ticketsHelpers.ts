import type { ChamadoStatus, Categoria, Origem } from "../types";

// ─── Status ───────────────────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<
    ChamadoStatus,
    {
        label: string;
        cor: string;
        bg: string;
        border: string;
        icone: string;
    }
> = {
    AGUARDANDO: {
        label: "Aguardando",
        icone: "⏳",
        cor: "#92400e",
        bg: "rgba(251,191,36,.12)",
        border: "rgba(251,191,36,.35)",
    },
    EM_ATENDIMENTO: {
        label: "Em Atendimento",
        icone: "🎧",
        cor: "#1a6b3c",
        bg: "rgba(26,107,60,.1)",
        border: "rgba(26,107,60,.3)",
    },
    AGUARDANDO_CLIENTE: {
        label: "Aguard. Cliente",
        icone: "💬",
        cor: "#1e40af",
        bg: "rgba(59,130,246,.1)",
        border: "rgba(59,130,246,.3)",
    },
    ENCERRADO: {
        label: "Encerrado",
        icone: "✅",
        cor: "#6b7280",
        bg: "rgba(107,114,128,.1)",
        border: "rgba(107,114,128,.3)",
    },
};

// ─── Categoria ────────────────────────────────────────────────────────────────
export const CATEGORIA_CONFIG: Record<
    Categoria,
    { label: string; icone: string }
> = {
    ERRO: { label: "Erro", icone: "🔴" },
    DUVIDA: { label: "Dúvida", icone: "❓" },
};

// ─── Origem ───────────────────────────────────────────────────────────────────
export const ORIGEM_CONFIG: Record<Origem, { label: string; icone: string }> = {
    WHATSAPP: { label: "WhatsApp", icone: "💬" },
    EMAIL: { label: "E-mail", icone: "📧" },
    TELEFONE: { label: "Telefone", icone: "📞" },
};

// ─── Tempo formatado ──────────────────────────────────────────────────────────
export function formatarTempo(segundos?: number | null): string {
    if (!segundos) return "—";
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// ─── Data/hora curta ──────────────────────────────────────────────────────────
export function formatarDataHora(iso?: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}
