import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import type { Chat, WsEnvelope } from "../../types";
import { wsService, BoundedEventCache } from "../../services/websocket";
import { CATEGORIA_CONFIG, formatarDataHora } from "../../utils/ticketsHelpers";
import { buildTimeline } from "../../utils/buildTimeline";
import { usePaginatedMessages } from "../../hooks/usePaginatedMessages";
import { formatDataCurta, formatHora } from "../../utils/formatters";

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    contatoId: string;
    contatoNome: string;
    foneContato: string;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ContactTimeline({
    contatoId,
    contatoNome,
    foneContato,
    onClose,
}: Props) {
    const paginado = usePaginatedMessages();
    const {
        initialize,
        setMessages,
        messages,
        chamados,
        loading,
        loadingOlder,
        hasOlderPages,
        loadOlderMessages,
        containerRef,
        isLoadingOlderRef,
    } = paginado;

    const fimRef = useRef<HTMLDivElement>(null);
    const processedEvents = useRef(new BoundedEventCache());
    const prevLengthRef = useRef(0);

    // ── Carga inicial ─────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        prevLengthRef.current = 0;
        initialize(contatoId).catch(() => {
            if (!cancelled) toast.error("Erro ao carregar conversa");
        });
        return () => {
            cancelled = true;
        };
    }, [contatoId, initialize]);

    // ── Scroll para o fim após carga inicial ──────────────────────────────────
    useEffect(() => {
        if (!loading) {
            fimRef.current?.scrollIntoView({ behavior: "instant" });
            prevLengthRef.current = messages.length;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    // ── Auto-scroll em novas mensagens em tempo real ───────────────────────────
    // Não rola quando loadOlderMessages prepend (isLoadingOlderRef ainda é true)
    useEffect(() => {
        if (
            messages.length > prevLengthRef.current &&
            prevLengthRef.current > 0 &&
            !isLoadingOlderRef.current
        ) {
            fimRef.current?.scrollIntoView({ behavior: "smooth" });
        }
        prevLengthRef.current = messages.length;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length]);

    // ── WebSocket: mensagens em tempo real ────────────────────────────────────
    useEffect(() => {
        const topic = `/topic/contato/${contatoId}`;
        const cleanup = wsService.subscribe(topic, (body: unknown) => {
            const env = body as WsEnvelope<Chat>;
            if (processedEvents.current.markAndCheck(env.eventId)) return;
            const msg = env.payload;
            setMessages(prev =>
                prev.some(m => m.id === msg.id) ? prev : [...prev, msg],
            );
        });
        return cleanup;
    }, [contatoId, setMessages]);

    const timeline = buildTimeline(messages, chamados);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="timeline-overlay" onClick={onClose}>
            <div className="timeline-panel" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="timeline-header">
                    <div className="timeline-header-avatar">
                        {contatoNome.charAt(0).toUpperCase()}
                    </div>
                    <div className="timeline-header-info">
                        <strong>{contatoNome}</strong>
                        <span>{foneContato}</span>
                    </div>
                    <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={onClose}
                    >
                        ✕ Fechar
                    </button>
                </div>

                {/* Sub-header */}
                {!loading && (
                    <div className="timeline-subheader">
                        <span>
                            {chamados.length > 0
                                ? `${chamados.length} chamado${chamados.length !== 1 ? "s" : ""} · `
                                : ""}
                            {messages.length}
                            {hasOlderPages ? "+" : ""} mensagem
                            {messages.length !== 1 ? "s" : ""}
                        </span>
                        <span className="timeline-subheader-rt">
                            ● tempo real
                        </span>
                    </div>
                )}

                {/* Messages */}
                <div className="timeline-messages" ref={containerRef}>
                    {loading ? (
                        <div className="timeline-loading">
                            Carregando conversa...
                        </div>
                    ) : timeline.length === 0 ? (
                        <div className="timeline-vazio">
                            <span>💬</span>
                            <p>Nenhuma mensagem encontrada</p>
                        </div>
                    ) : (
                        <>
                            {/* Load older button */}
                            {hasOlderPages && (
                                <div className="timeline-load-older">
                                    <button
                                        type="button"
                                        onClick={loadOlderMessages}
                                        disabled={loadingOlder}
                                    >
                                        {loadingOlder
                                            ? "Carregando..."
                                            : "↑ Carregar mensagens anteriores"}
                                    </button>
                                </div>
                            )}

                            {/* Timeline items */}
                            {timeline.map((item, i) => {
                                if (item.kind === "open") {
                                    const cat = item.data.categoria
                                        ? CATEGORIA_CONFIG[item.data.categoria]
                                        : null;
                                    return (
                                        <div
                                            key={`open-${item.data.id}`}
                                            className="timeline-marker timeline-marker-open"
                                        >
                                            <div className="timeline-marker-content">
                                                <span>
                                                    📋 Chamado aberto
                                                    {cat
                                                        ? ` — ${cat.icone} ${cat.label}`
                                                        : ""}
                                                </span>
                                                <span className="timeline-marker-ts">
                                                    {formatarDataHora(
                                                        item.data.dtAbertura,
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }

                                if (item.kind === "close") {
                                    return (
                                        <div
                                            key={`close-${item.data.id}`}
                                            className="timeline-marker timeline-marker-close"
                                        >
                                            <div className="timeline-marker-content">
                                                <span>
                                                    🔒 Chamado encerrado
                                                </span>
                                                <span className="timeline-marker-ts">
                                                    {formatarDataHora(
                                                        item.data
                                                            .dtEncerramento,
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }

                                // kind === "msg"
                                const msg = item.data;
                                const prevItem = timeline[i - 1];
                                const showDateSep =
                                    !prevItem ||
                                    new Date(prevItem.ts).toDateString() !==
                                        new Date(item.ts).toDateString();
                                const isSuporte = msg.origem === "SUPORTE";

                                return (
                                    <div key={msg.id}>
                                        {showDateSep && (
                                            <div className="timeline-sep-data">
                                                <span>
                                                    {formatDataCurta(item.ts)}
                                                </span>
                                            </div>
                                        )}
                                        <div
                                            className={`timeline-msg ${isSuporte ? "timeline-msg-suporte" : "timeline-msg-cliente"}`}
                                        >
                                            {!isSuporte && (
                                                <div className="timeline-msg-avatar">
                                                    {(msg.nomeContato || "?")
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                            )}
                                            <div className="timeline-msg-balao">
                                                {!isSuporte && (
                                                    <span className="timeline-msg-remetente">
                                                        {msg.nomeContato}
                                                    </span>
                                                )}
                                                {msg.tipoMidia === "IMAGEM" &&
                                                msg.fileUrl ? (
                                                    <img
                                                        src={msg.fileUrl}
                                                        alt="imagem"
                                                        className="timeline-msg-imagem"
                                                    />
                                                ) : msg.tipoMidia === "AUDIO" &&
                                                  msg.fileUrl ? (
                                                    <audio
                                                        controls
                                                        src={msg.fileUrl}
                                                        className="timeline-msg-audio"
                                                    />
                                                ) : (
                                                    <p className="timeline-msg-texto">
                                                        {msg.texto}
                                                    </p>
                                                )}
                                                <span className="timeline-msg-hora">
                                                    {formatHora(msg.dtEnvio)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={fimRef} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
