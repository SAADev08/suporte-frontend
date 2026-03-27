import { useState, useRef, useCallback } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import { chatApi } from "../services/api/chatApi";
import { ticketApi } from "../services/api/ticketApi";
import type { Chat, Chamado } from "../types";

const PAGE_SIZE = 50;

export interface UsePaginatedMessagesReturn {
    messages: Chat[];
    setMessages: Dispatch<SetStateAction<Chat[]>>;
    chamados: Chamado[];
    loading: boolean;
    loadingOlder: boolean;
    hasOlderPages: boolean;
    containerRef: RefObject<HTMLDivElement | null>;
    isLoadingOlderRef: RefObject<boolean>;
    loadOlderMessages: () => Promise<void>;
    initialize: (contatoId: string) => Promise<void>;
}

/**
 * Gerencia mensagens paginadas de um contato com suporte a carregar páginas
 * anteriores preservando a posição de scroll.
 *
 * - `initialize(contatoId)` busca a última página (mais recente) e os chamados.
 * - `loadOlderMessages()` busca a página anterior e mantém o scroll.
 */
export function usePaginatedMessages(): UsePaginatedMessagesReturn {
    const [messages, setMessages] = useState<Chat[]>([]);
    const [chamados, setChamados] = useState<Chamado[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasOlderPages, setHasOlderPages] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const isLoadingOlderRef = useRef(false);
    // Refs evitam closures desatualizadas em loadOlderMessages
    const contatoIdRef = useRef<string | null>(null);
    const currentPageRef = useRef(0);
    const loadingOlderRef = useRef(false);

    const initialize = useCallback(async (contatoId: string) => {
        contatoIdRef.current = contatoId;
        currentPageRef.current = 0;
        setLoading(true);
        setMessages([]);
        setChamados([]);
        setHasOlderPages(false);

        try {
            const [msgsRes, ticketsRes] = await Promise.all([
                chatApi.buscarPorContato(contatoId, 0, PAGE_SIZE),
                ticketApi.listar({ contatoId, size: 100 }),
            ]);

            const totalPages = msgsRes.data.totalPages;
            if (totalPages > 1) {
                const lastRes = await chatApi.buscarPorContato(
                    contatoId,
                    totalPages - 1,
                    PAGE_SIZE,
                );
                setMessages(lastRes.data.content);
                currentPageRef.current = totalPages - 1;
                setHasOlderPages(true);
            } else {
                setMessages(msgsRes.data.content);
            }

            setChamados(ticketsRes.data.content);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadOlderMessages = useCallback(async () => {
        const contatoId = contatoIdRef.current;
        if (loadingOlderRef.current || currentPageRef.current <= 0 || !contatoId)
            return;

        loadingOlderRef.current = true;
        isLoadingOlderRef.current = true;
        setLoadingOlder(true);

        const container = containerRef.current;
        const prevHeight = container?.scrollHeight ?? 0;

        try {
            const res = await chatApi.buscarPorContato(
                contatoId,
                currentPageRef.current - 1,
                PAGE_SIZE,
            );
            setMessages(prev => [...res.data.content, ...prev]);
            const nextPage = currentPageRef.current - 1;
            currentPageRef.current = nextPage;
            setHasOlderPages(nextPage > 0);

            setTimeout(() => {
                if (container)
                    container.scrollTop = container.scrollHeight - prevHeight;
                isLoadingOlderRef.current = false;
            }, 0);
        } catch {
            isLoadingOlderRef.current = false;
        } finally {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    }, []);

    return {
        messages,
        setMessages,
        chamados,
        loading,
        loadingOlder,
        hasOlderPages,
        containerRef,
        isLoadingOlderRef,
        loadOlderMessages,
        initialize,
    };
}
