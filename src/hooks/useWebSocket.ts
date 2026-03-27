import { useCallback, useEffect, useRef, useState } from "react";
import { wsService, BoundedEventCache } from "../services/websocket";
import { useNotificacaoStore } from "../store/notificationStore";
import { useAuthStore } from "../store/authStore";
import type { ContatoPendente, WsEnvelope } from "../types";
import { contactApi } from "../services/api/contactApi";

export type WsStatus = "connected" | "connecting" | "disconnected";

export function useWebSocket() {
    const { token, isAuthenticated, logout } = useAuthStore();
    const { adicionar, adicionarContatoPendente, setContatosPendentes } =
        useNotificacaoStore();

    const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");

    // Ref espelha o estado para leitura síncrona sem dependência do closure
    const wsStatusRef = useRef<WsStatus>("disconnected");

    const updateStatus = useCallback((next: WsStatus) => {
        if (wsStatusRef.current === next) return; // sem re-render se igual
        wsStatusRef.current = next;
        setWsStatus(next);
    }, []);

    const eventCache = useRef(new BoundedEventCache());

    const carregarPendentesIniciais = useCallback(async () => {
        try {
            const { data } = await contactApi.pendentes(0, 50);
            setContatosPendentes(data.content);
        } catch {
            console.warn(
                "[WS] Não foi possível carregar contatos pendentes iniciais.",
            );
        }
    }, [setContatosPendentes]);

    // Callbacks passados ao wsService — chamados assincronamente pelo STOMP
    const onConnected = useCallback(async () => {
        updateStatus("connected");
        await carregarPendentesIniciais();
        eventCache.current.clear();
    }, [updateStatus, carregarPendentesIniciais]);

    const onAuthError = useCallback(() => {
        console.warn("[WS] Token expirado — logout.");
        updateStatus("disconnected");
        logout();
    }, [updateStatus, logout]);

    useEffect(() => {
        if (!isAuthenticated || !token) {
            wsService.disconnect();
            return;
        }

        const getToken = () => useAuthStore.getState().token;
        wsService.connect(getToken, onConnected, onAuthError);

        // Quando o STOMP detecta desconexão, transita para "connecting" se
        // estava conectado (reconexão automática em andamento) ou mantém o estado atual.
        wsService.onDisconnected = () => {
            updateStatus(
                wsStatusRef.current === "connected" ? "connecting" : wsStatusRef.current,
            );
        };

        // Subscriptions
        const handleNotif = (body: unknown) => {
            const env = body as WsEnvelope<{
                mensagem?: string;
                nivel?: string;
            }>;
            if (eventCache.current.markAndCheck(env.eventId)) return;

            const data = env.payload;
            const tipoMap: Record<
                string,
                "alerta" | "critico" | "escalado" | "info"
            > = {
                ALERTA: "alerta",
                CRITICO: "critico",
                ESCALADO: "escalado",
            };
            adicionar({
                tipo: tipoMap[data.nivel ?? ""] ?? "info",
                mensagem: data.mensagem || "Nova notificação recebida",
            });
        };

        const handleContact = (body: unknown) => {
            const env = body as WsEnvelope<ContatoPendente>;
            if (eventCache.current.markAndCheck(env.eventId)) return;

            const contato = env.payload;
            adicionarContatoPendente(contato);
            adicionar({
                tipo: "alerta",
                mensagem: `Novo contato sem vínculo: ${contato.nome} (${contato.telefone})`,
            });
        };

        const cleanupNotifications = wsService.subscribe(
            "/topic/notificacoes",
            handleNotif,
        );
        const cleanupContacts = wsService.subscribe(
            "/topic/contatos-pendentes",
            handleContact,
        );

        return () => {
            wsService.onDisconnected = null;
            cleanupNotifications();
            cleanupContacts();
        };
    }, [
        isAuthenticated,
        token,
        onConnected,
        onAuthError,
        updateStatus,
        adicionar,
        adicionarContatoPendente,
    ]);

    return { wsStatus };
}
