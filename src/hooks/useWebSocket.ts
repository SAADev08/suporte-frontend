import { useCallback, useEffect } from "react";
import { wsService } from "../services/websocket";
import { useNotificacaoStore } from "../store/notificationStore";
import { useAuthStore } from "../store/authStore";
import type { ContatoPendente } from "../types";
import { contatoApi } from "../services/api";

export function useWebSocket() {
    const { token, isAuthenticated } = useAuthStore();
    const { adicionar, adicionarContatoPendente, setContatosPendentes } =
        useNotificacaoStore();

    const carregarPendentesIniciais = useCallback(async () => {
        try {
            const { data } = await contatoApi.pendentes(0, 50);
            setContatosPendentes(data.content);
        } catch {
            // Falha silenciosa — o WebSocket continua entregando novos eventos.
            console.warn(
                "[WS] Não foi possível carregar contatos pendentes iniciais.",
            );
        }
    }, [setContatosPendentes]);

    useEffect(() => {
        if (!isAuthenticated || !token) return;

        if (!wsService.isConnected()) {
            wsService.connect(token, () => {
                // Ao conectar (ou reconectar), carrega a lista completa de
                // pendentes via REST — o WebSocket só entrega novos eventos
                // a partir deste momento, não o histórico anterior.
                carregarPendentesIniciais();
            });
        } else {
            // Já conectado (ex: hot-reload em dev) — carrega mesmo assim
            carregarPendentesIniciais();
        }

        wsService.subscribe("/topic/notificacoes", (body: unknown) => {
            const data = body as { mensagem?: string; nivel?: string };
            adicionar({
                tipo: (data.nivel?.toLowerCase() as "alerta") || "info",
                mensagem: data.mensagem || "Nova notificação recebida",
            });
        });

        wsService.subscribe("/topic/sla", (body: unknown) => {
            const data = body as { mensagem?: string; nivel?: string };
            adicionar({
                tipo:
                    data.nivel === "CRITICO"
                        ? "critico"
                        : data.nivel === "ESCALADO"
                          ? "escalado"
                          : "alerta",
                mensagem: data.mensagem || "Alerta de SLA",
            });
        });

        wsService.subscribe("/topic/contatos-pendentes", (body: unknown) => {
            const contato = body as ContatoPendente;
            adicionarContatoPendente(contato);
            adicionar({
                tipo: "alerta",
                mensagem: `Novo contato sem vínculo: ${contato.nome} (${contato.telefone})`,
            });
        });
    }, [isAuthenticated, token]);
}
