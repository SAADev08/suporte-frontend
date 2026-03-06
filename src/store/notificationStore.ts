import { create } from "zustand";

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
}));
