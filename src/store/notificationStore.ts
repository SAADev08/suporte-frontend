import { create } from "zustand";
import type { ContatoPendente } from "../types";

export interface Notificacao {
    id: string;
    tipo: "info" | "alerta" | "critico" | "escalado";
    mensagem: string;
    lida: boolean;
    dtRecebimento: string;
}

interface NotificacaoState {
    notificacoes: Notificacao[];
    naoLidas: number;
    adicionar: (n: Omit<Notificacao, "id" | "lida" | "dtRecebimento">) => void;
    marcarLida: (id: string) => void;
    marcarTodasLidas: () => void;

    // ── Contatos pendentes de vinculação ──────────────────────────────────────
    /** Lista de contatos criados via webhook sem vínculo com Cliente. */
    contatosPendentes: ContatoPendente[];
    /** Substitui a lista inteira — usado na carga inicial via REST. */
    setContatosPendentes: (contatos: ContatoPendente[]) => void;
    /** Adiciona um contato à lista, evitando duplicatas por id. */
    adicionarContatoPendente: (contato: ContatoPendente) => void;
    /** Remove um contato da lista (chamado após vinculação com Cliente). */
    removerContatoPendente: (id: string) => void;
}

export const useNotificacaoStore = create<NotificacaoState>(set => ({
    notificacoes: [],
    naoLidas: 0,

    adicionar: n => {
        const nova: Notificacao = {
            ...n,
            id: crypto.randomUUID(),
            lida: false,
            dtRecebimento: new Date().toISOString(),
        };
        set(state => ({
            notificacoes: [nova, ...state.notificacoes].slice(0, 50),
            naoLidas: state.naoLidas + 1,
        }));
    },

    marcarLida: id =>
        set(state => ({
            notificacoes: state.notificacoes.map(n =>
                n.id === id ? { ...n, lida: true } : n,
            ),
            naoLidas: Math.max(0, state.naoLidas - 1),
        })),

    marcarTodasLidas: () =>
        set(state => ({
            notificacoes: state.notificacoes.map(n => ({ ...n, lida: true })),
            naoLidas: 0,
        })),

    contatosPendentes: [],

    setContatosPendentes: contatos => set({ contatosPendentes: contatos }),

    adicionarContatoPendente: contato =>
        set(state => {
            // Evita duplicata caso o webhook seja entregue mais de uma vez
            const jaExiste = state.contatosPendentes.some(
                c => c.id === contato.id,
            );
            if (jaExiste) return state;
            return {
                contatosPendentes: [contato, ...state.contatosPendentes],
            };
        }),

    removerContatoPendente: id =>
        set(state => ({
            contatosPendentes: state.contatosPendentes.filter(c => c.id !== id),
        })),
}));
