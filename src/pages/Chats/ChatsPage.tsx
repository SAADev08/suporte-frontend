import { useState, useEffect, useCallback, useRef } from "react";
import "./chats.css";
import toast from "react-hot-toast";
import type {
    Chat,
    Chamado,
    NotificacaoSla,
    NotificacaoTriagemSla,
    FilaAgrupadaItem,
    Contato,
    WsEnvelope,
} from "../../types";
import { chatApi, type IniciarChatRequest } from "../../services/api/chatApi";
import { ticketApi, type ChamadoRequest } from "../../services/api/ticketApi";
import {
    STATUS_CONFIG,
    CATEGORIA_CONFIG,
    formatarDataHora,
} from "../../utils/ticketsHelpers";
import { buildTimeline } from "../../utils/buildTimeline";
import { usePaginatedMessages } from "../../hooks/usePaginatedMessages";
import { TriagemConversaPanel } from "./TriagemConversaPanel";
import type { ContatoTriagemAtivo } from "./TriagemConversaPanel";
import type { ChamadoStatus, NivelSla } from "../../types";
import { BoundedEventCache, wsService } from "../../services/websocket";
import { useNavigationStore } from "../../store/navigationStore";
import { useNotificacaoStore } from "../../store/notificationStore";
import { contactApi } from "../../services/api/contactApi";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCirclePlus,
    faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { slaApi } from "../../services/api/slaApi";

// ─── Tipos locais ─────────────────────────────────────────────────────────────
type Aba = "atendimento" | "triagem";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatarHora(iso?: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatarDataCurta(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    if (d.toDateString() === hoje.toDateString()) return "Hoje";
    if (d.toDateString() === ontem.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function previewMidia(item: FilaAgrupadaItem): string {
    if (item.ultimoTexto) {
        return item.ultimoTexto.length > 45
            ? item.ultimoTexto.slice(0, 45) + "…"
            : item.ultimoTexto;
    }
    switch (item.ultimoTipoMidia) {
        case "IMAGEM":
            return "📷 Imagem";
        case "AUDIO":
            return "🎵 Áudio";
        case "VIDEO":
            return "🎬 Vídeo";
        default:
            return "—";
    }
}

const SLA_CONFIG: Record<
    NivelSla,
    { cor: string; bg: string; icone: string; label: string }
> = {
    ALERTA: {
        cor: "#92400e",
        bg: "rgba(251,191,36,.15)",
        icone: "⚠️",
        label: "Atenção",
    },
    CRITICO: {
        cor: "#c0392b",
        bg: "rgba(192,57,43,.1)",
        icone: "🔴",
        label: "Crítico",
    },
    ESCALADO: {
        cor: "#7c3aed",
        bg: "rgba(124,58,237,.1)",
        icone: "🚨",
        label: "Escalado",
    },
};

// Contexto de triagem: ESCALADO exibe como "URGENTE" (sem chamado formal)
const SLA_TRIAGEM_CONFIG: Record<
    "ALERTA" | "ESCALADO",
    { cor: string; bg: string; borderCor: string; label: string }
> = {
    ALERTA: {
        cor: "#92400e",
        bg: "rgba(251,191,36,.18)",
        borderCor: "#f59e0b",
        label: "ALERTA",
    },
    ESCALADO: {
        cor: "#991b1b",
        bg: "rgba(192,57,43,.12)",
        borderCor: "#c0392b",
        label: "URGENTE",
    },
};

// ─── Componente principal ─────────────────────────────────────────────────────
export function ChatPage() {
    const [aba, setAba] = useState<Aba>("atendimento");
    const [chamados, setChamados] = useState<Chamado[]>([]);
    const [chamadoAtivo, setChamadoAtivo] = useState<Chamado | null>(null);
    const [loadingChamados, setLoadingChamados] = useState(true);

    const atendimento = usePaginatedMessages();
    // Desestruturados para serem usados em callbacks sem adicionar `atendimento` nas deps
    const setMensagens = atendimento.setMessages;
    const initAtendimento = atendimento.initialize;
    const [texto, setTexto] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [alertasSla, setAlertasSla] = useState<NotificacaoSla[]>([]);
    // alertas de triagem indexados por contatoId — máx. um alerta por contato
    const [alertasTriagem, setAlertasTriagem] = useState<
        Record<string, NotificacaoTriagemSla>
    >({});
    // serverTimestamp do último evento processado por contatoId (proteção contra re-entrega)
    const alertasTriagemTsRef = useRef<Record<string, number>>({});

    // ── Triagem ───────────────────────────────────────────────────────────────
    const [filaAgrupada, setFilaAgrupada] = useState<FilaAgrupadaItem[]>([]);
    const [loadingTriagem, setLoadingTriagem] = useState(false);
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
    const [modalCriarChamado, setModalCriarChamado] = useState(false);
    const [formCriar, setFormCriar] = useState<Partial<ChamadoRequest>>({
        origem: "WHATSAPP",
        categoria: "DUVIDA",
    });
    const [criando, setCriando] = useState(false);

    // ── Conversa de triagem (painel direito) ──────────────────────────────────
    const [contatoTriagemAtivo, setContatoTriagemAtivo] =
        useState<ContatoTriagemAtivo | null>(null);

    // ── Modal: Iniciar Conversa Ativa ─────────────────────────────────────────
    const [modalIniciar, setModalIniciar] = useState(false);
    const [contatosBusca, setContatosBusca] = useState<Contato[]>([]);
    const [buscandoContatos, setBuscandoContatos] = useState(false);
    const [termoBusca, setTermoBusca] = useState("");
    const [contatoSelecionado, setContatoSelecionado] =
        useState<Contato | null>(null);
    const [formIniciar, setFormIniciar] = useState<Partial<IniciarChatRequest>>(
        {
            categoria: "DUVIDA",
            tipoMidia: "TEXTO",
        },
    );
    const [iniciando, setIniciando] = useState(false);
    const buscaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { contatosPendentes } = useNotificacaoStore();
    const { navigate } = useNavigationStore();

    const fimMensagensRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const processedWsEvents = useRef(new BoundedEventCache());
    const chamadoSubCleanupRef = useRef<(() => void) | null>(null);
    const contatoSubCleanupRef = useRef<(() => void) | null>(null);

    const chamadoAtivoIdRef = useRef<string | null>(null);
    const contatoAtivoIdRef = useRef<string | null>(null);

    useEffect(() => {
        const pendentesIds = new Set(contatosPendentes.map(c => c.id));
        setFilaAgrupada(prev =>
            prev.map(item =>
                item.pendenteVinculacao && !pendentesIds.has(item.contatoId)
                    ? { ...item, pendenteVinculacao: false }
                    : item,
            ),
        );
        // Também atualiza o painel de conversa ativo se for o mesmo contato
        setContatoTriagemAtivo(ct => {
            if (
                ct &&
                ct.pendenteVinculacao &&
                !pendentesIds.has(ct.contatoId)
            ) {
                return { ...ct, pendenteVinculacao: false };
            }
            return ct;
        });
    }, [contatosPendentes]);

    // ─── Carregar triagem na inicialização ────────────────────────────
    const carregarTriagem = useCallback(async () => {
        setLoadingTriagem(true);
        try {
            const { data } = await chatApi.filaAgrupada(0, 50);
            setFilaAgrupada(data.content);
        } catch {
            toast.error("Erro ao carregar triagem");
        } finally {
            setLoadingTriagem(false);
        }
    }, []);

    // ─── Carregar chamados ────────────────────────────────────────────────────
    const carregarChamados = useCallback(async () => {
        setLoadingChamados(true);
        try {
            const { data } = await ticketApi.listar({ status: undefined });
            setChamados(data.content);
        } catch {
            toast.error("Erro ao carregar chamados");
        } finally {
            setLoadingChamados(false);
        }
    }, []);

    const carregarSlaAtivos = useCallback(async () => {
        try {
            const { data } = await slaApi.ativos();
            setAlertasSla(data.slice(-5));
        } catch (err) {
            console.warn("[SLA] Falha ao carregar alertas ativos:", err);
        }
    }, []);

    const carregarSlaTriagemAtivos = useCallback(async () => {
        try {
            const { data } = await slaApi.triagemAtivos();
            setAlertasTriagem(prev => {
                const next = { ...prev };
                data.forEach(alerta => {
                    // REST só vence se ainda não há evento WS mais recente para este contato
                    if (!(alerta.contatoId in alertasTriagemTsRef.current)) {
                        next[alerta.contatoId] = alerta;
                    }
                });
                return next;
            });
        } catch {
            console.warn("[SLA] Falha ao carregar alertas de triagem ativos.");
        }
    }, []);

    // Carrega os dois na inicialização
    useEffect(() => {
        carregarChamados();
        carregarTriagem();
        carregarSlaAtivos();
        carregarSlaTriagemAtivos();
    }, [
        carregarChamados,
        carregarTriagem,
        carregarSlaAtivos,
        carregarSlaTriagemAtivos,
    ]);

    // Recarrega triagem ao mudar para a aba (atualiza dados que podem ter mudado)
    useEffect(() => {
        if (aba === "triagem") carregarTriagem();
    }, [aba, carregarTriagem]);

    // Recarrega sla quando foca na aba
    useEffect(() => {
        const onFocus = () => carregarSlaAtivos();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [carregarSlaAtivos]);

    // ─── WebSocket ────────────────────────────────────────────────────────────
    const handleNovaMensagem = useCallback(
        (envelope: WsEnvelope<Chat>) => {
            // Descarta re-entrega do broker STOMP via eventId do envelope
            if (processedWsEvents.current.markAndCheck(envelope.eventId))
                return;
            const msg = envelope.payload;

            // Mensagens da conversa agora chegam por /topic/contato/{id}
            // Aqui só atualizamos a fila de triagem e o preview da sidebar
            if (!msg.chamadoId) {
                setFilaAgrupada(prev => {
                    const existe = prev.some(
                        item => item.contatoId === msg.contatoId,
                    );
                    if (existe) {
                        return prev.map(item =>
                            item.contatoId === msg.contatoId
                                ? {
                                      ...item,
                                      totalMensagens: item.totalMensagens + 1,
                                      dtUltimaMensagem:
                                          msg.dtEnvio ?? item.dtUltimaMensagem,
                                      ultimoTexto:
                                          msg.tipoMidia === "TEXTO"
                                              ? (msg.texto ?? item.ultimoTexto)
                                              : item.ultimoTexto,
                                      ultimoTipoMidia:
                                          msg.tipoMidia ?? item.ultimoTipoMidia,
                                  }
                                : item,
                        );
                    }
                    // Novo contato na triagem — recarrega para obter dados completos
                    carregarTriagem();
                    return prev;
                });
            }
            if (msg.chamadoId) {
                setChamados(prev =>
                    prev.map(c =>
                        c.id === msg.chamadoId
                            ? ({ ...c, _ultimaMensagem: msg } as Chamado & {
                                  _ultimaMensagem: Chat;
                              })
                            : c,
                    ),
                );
            }
        },
        [carregarTriagem],
    );

    const handleNotificacaoSla = useCallback(
        (envelope: WsEnvelope<NotificacaoSla>) => {
            // Descarta re-entrega do broker STOMP via eventId do envelope
            if (processedWsEvents.current.markAndCheck(envelope.eventId))
                return;
            const notif = envelope.payload;

            setAlertasSla(prev => {
                // Substitui alerta anterior do mesmo chamado (nunca acumula)
                const semExistente = prev.filter(
                    a => a.chamadoId !== notif.chamadoId,
                );
                return [...semExistente, notif].slice(-5); // máximo 5 visíveis
            });

            // Auto-dismiss graduado: ALERTA some após 30s
            if (notif.nivel === "ALERTA") {
                setTimeout(() => {
                    setAlertasSla(prev =>
                        prev.filter(
                            a =>
                                a.chamadoId !== notif.chamadoId ||
                                a.timestamp !== notif.timestamp,
                        ),
                    );
                }, 30_000);
            }
            // CRITICO e ESCALADO: sem auto-dismiss
        },
        [],
    );

    const handleNotificacaoTriagem = useCallback(
        (envelope: WsEnvelope<NotificacaoTriagemSla>) => {
            if (processedWsEvents.current.markAndCheck(envelope.eventId))
                return;
            const { payload, serverTimestamp } = envelope;

            // Descarta evento mais antigo que o estado atual para este contato
            const tsAtual =
                alertasTriagemTsRef.current[payload.contatoId] ?? -1;
            if (serverTimestamp <= tsAtual) return;

            alertasTriagemTsRef.current[payload.contatoId] = serverTimestamp;
            setAlertasTriagem(prev => ({
                ...prev,
                [payload.contatoId]: payload,
            }));
        },
        [],
    );

    const removerAlertaTriagem = useCallback((contatoId: string) => {
        setAlertasTriagem(prev => {
            const next = { ...prev };
            delete next[contatoId];
            return next;
        });
        delete alertasTriagemTsRef.current[contatoId];
    }, []);

    const handleNovoChamado = useCallback((envelope: WsEnvelope<Chamado>) => {
        // Descarta re-entrega do broker STOMP via eventId do envelope
        if (processedWsEvents.current.markAndCheck(envelope.eventId)) return;

        const chamado = envelope.payload;
        setChamados(prev =>
            prev.some(c => c.id === chamado.id) ? prev : [chamado, ...prev],
        );
    }, []);

    // Subscreve /topic/contato/{id} — entrega mensagens para o painel de atendimento ativo
    const inscreverContatoAtivo = useCallback(
        (contatoId: string) => {
            contatoSubCleanupRef.current?.();
            contatoAtivoIdRef.current = contatoId;

            contatoSubCleanupRef.current = wsService.subscribe(
                `/topic/contato/${contatoId}`,
                (body: unknown) => {
                    const env = body as WsEnvelope<Chat>;
                    if (processedWsEvents.current.markAndCheck(env.eventId))
                        return;
                    const msg = env.payload;
                    setMensagens(prev =>
                        prev.some(m => m.id === msg.id) ? prev : [...prev, msg],
                    );
                },
            );
        },
        [setMensagens],
    );

    const inscreverChamadoAtivo = useCallback((chamadoId: string) => {
        chamadoSubCleanupRef.current?.();

        chamadoSubCleanupRef.current = wsService.subscribe(
            `/topic/chamados/${chamadoId}`,
            (body: unknown) => {
                const env = body as WsEnvelope<Chamado>;
                if (processedWsEvents.current.markAndCheck(env.eventId)) return;

                const atualizado = env.payload;
                setChamadoAtivo(atualizado);
                setChamados(prev =>
                    prev.map(c => (c.id === atualizado.id ? atualizado : c)),
                );
            },
        );
    }, []);

    useEffect(() => {
        const handleMsg = (body: unknown) =>
            handleNovaMensagem(body as WsEnvelope<Chat>);

        const handleSlaLocal = (body: unknown) =>
            handleNotificacaoSla(body as WsEnvelope<NotificacaoSla>);

        const handleSlaTriagemLocal = (body: unknown) =>
            handleNotificacaoTriagem(body as WsEnvelope<NotificacaoTriagemSla>);

        const handleTicket = (body: unknown) =>
            handleNovoChamado(body as WsEnvelope<Chamado>);

        const cleanupMsg = wsService.subscribe("/topic/mensagens", handleMsg);
        const cleanupSla = wsService.subscribe(
            "/topic/notificacoes",
            handleSlaLocal,
        );
        const cleanupSlaTriagem = wsService.subscribe(
            "/topic/notificacoes-triagem",
            handleSlaTriagemLocal,
        );
        const cleanupTicket = wsService.subscribe(
            "/topic/chamados/novo",
            handleTicket,
        );

        wsService.onReconnect = async () => {
            await carregarChamados();

            await carregarSlaAtivos();
            await carregarSlaTriagemAtivos();

            const chamadoId = chamadoAtivoIdRef.current;
            if (chamadoId) {
                inscreverChamadoAtivo(chamadoId);
                const contatoId = contatoAtivoIdRef.current;
                if (contatoId) inscreverContatoAtivo(contatoId);
                try {
                    const { data } = await ticketApi.buscarPorId(chamadoId);
                    setChamadoAtivo(data);
                    setChamados(prev =>
                        prev.map(c => (c.id === data.id ? data : c)),
                    );
                } catch (err) {
                    console.warn(
                        "[WS] Falha ao recarregar chamado ativo após reconexão:",
                        err,
                    );
                }
            }

            processedWsEvents.current.clear();
        };

        return () => {
            cleanupMsg();
            cleanupSla();
            cleanupSlaTriagem();
            cleanupTicket();

            wsService.onReconnect = null;
            chamadoSubCleanupRef.current?.();
            chamadoSubCleanupRef.current = null;
            contatoSubCleanupRef.current?.();
            contatoSubCleanupRef.current = null;
            chamadoAtivoIdRef.current = null;
            contatoAtivoIdRef.current = null;
        };
    }, [
        handleNovaMensagem,
        handleNotificacaoSla,
        handleNotificacaoTriagem,
        handleNovoChamado,
        carregarChamados,
        carregarSlaAtivos,
        carregarSlaTriagemAtivos,
        inscreverChamadoAtivo,
        inscreverContatoAtivo,
    ]);

    // ─── Scroll automático ────────────────────────────────────────────────────
    useEffect(() => {
        if (atendimento.isLoadingOlderRef.current) return;
        fimMensagensRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [atendimento.messages, atendimento.isLoadingOlderRef]);

    // ─── Selecionar chamado ───────────────────────────────────────────────────
    const selecionarChamado = useCallback(
        async (chamado: Chamado) => {
            chamadoAtivoIdRef.current = chamado.id;
            setChamadoAtivo(chamado);
            inscreverChamadoAtivo(chamado.id);
            inscreverContatoAtivo(chamado.contatoId);

            try {
                await initAtendimento(chamado.contatoId);
            } catch {
                toast.error("Erro ao carregar mensagens");
            }
        },
        [inscreverChamadoAtivo, inscreverContatoAtivo, initAtendimento],
    );

    // ─── Enviar mensagem (chamado) ────────────────────────────────────────────
    const enviarMensagem = async () => {
        if (!texto.trim() || !chamadoAtivo || enviando) return;
        const textoEnvio = texto.trim();
        setTexto("");
        setEnviando(true);
        try {
            const { data } = await chatApi.enviar({
                chamadoId: chamadoAtivo.id,
                texto: textoEnvio,
                tipoMidia: "TEXTO",
            });
            setMensagens(prev => [...prev, data]);
        } catch {
            toast.error("Erro ao enviar mensagem");
            setTexto(textoEnvio); // restaura texto se falhou
        } finally {
            setEnviando(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviarMensagem();
        }
    };

    // ─── Abrir conversa de triagem ────────────────────────────────────────────
    const abrirConversaTriagem = (item: FilaAgrupadaItem) => {
        setContatoTriagemAtivo({
            contatoId: item.contatoId,
            nomeContato: item.nomeContato,
            foneContato: item.foneContato,
            pendenteVinculacao: item.pendenteVinculacao,
        });
    };

    // ─── Seleção para criar chamado ───────────────────────────────────────────
    const toggleSelecionado = (contatoId: string) => {
        setSelecionados(prev => {
            const next = new Set(prev);
            if (next.has(contatoId)) next.delete(contatoId);
            else next.add(contatoId);
            return next;
        });
    };

    const itensSelecionados = filaAgrupada.filter(g =>
        selecionados.has(g.contatoId),
    );

    const abrirModalCriarParaContato = (contatoId: string) => {
        setFormCriar({
            origem: "WHATSAPP",
            categoria: "DUVIDA",
            contatoId,
            texto: "",
        });
        setModalCriarChamado(true);
    };

    const abrirModalCriar = () => {
        if (itensSelecionados.length === 0) return;
        const comPendencia = itensSelecionados.filter(
            g => g.pendenteVinculacao,
        );
        if (comPendencia.length > 0) {
            toast.error(
                `${comPendencia.length} contato(s) precisam ser vinculados a um Cliente antes de criar o chamado.`,
            );
            return;
        }
        abrirModalCriarParaContato(itensSelecionados[0].contatoId);
    };

    const criarChamadoDeTriagem = async () => {
        if (!formCriar.contatoId) {
            toast.error("Contato é obrigatório");
            return;
        }
        setCriando(true);
        try {
            // Busca os IDs de todas as mensagens de triagem deste contato
            const { data: msgsTriagem } = await chatApi.conversaTriagem(
                formCriar.contatoId,
            );
            const chatIds = msgsTriagem.map(m => m.id);

            const { data: novoChamado } = await ticketApi.criar({
                ...(formCriar as ChamadoRequest),
                chatIds, // vincula mensagens ao chamado
            });

            toast.success("Chamado criado com sucesso!");
            setModalCriarChamado(false);
            setSelecionados(new Set());

            // Remove o contato da fila de triagem imediatamente
            setFilaAgrupada(prev =>
                prev.filter(item => item.contatoId !== formCriar.contatoId),
            );
            removerAlertaTriagem(formCriar.contatoId!);

            // Fecha o painel de conversa se era o contato criado
            setContatoTriagemAtivo(ct => {
                if (ct?.contatoId === formCriar.contatoId) {
                    return null;
                }
                return ct;
            });

            // Adiciona o chamado criado na lista de atendimento
            setChamados(prev =>
                prev.some(c => c.id === novoChamado.id)
                    ? prev
                    : [novoChamado, ...prev],
            );

            // Muda para aba de atendimento e abre o chamado
            setAba("atendimento");
            await selecionarChamado(novoChamado);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao criar chamado";
            toast.error(msg);
        } finally {
            setCriando(false);
        }
    };

    // ─── Modal: Iniciar Conversa Ativa ────────────────────────────────────────
    const abrirModalIniciar = () => {
        setTermoBusca("");
        setContatosBusca([]);
        setContatoSelecionado(null);
        setFormIniciar({ categoria: "DUVIDA", tipoMidia: "TEXTO" });
        setModalIniciar(true);
    };

    const fecharModalIniciar = () => {
        if (iniciando) return;
        setModalIniciar(false);
        setContatoSelecionado(null);
        setTermoBusca("");
        setContatosBusca([]);
    };

    const handleBuscaContato = (termo: string) => {
        setTermoBusca(termo);
        setContatoSelecionado(null);
        if (buscaTimeout.current) clearTimeout(buscaTimeout.current);
        if (!termo.trim()) {
            setContatosBusca([]);
            return;
        }
        buscaTimeout.current = setTimeout(async () => {
            setBuscandoContatos(true);
            try {
                const { data } = await contactApi.listar({
                    nome: termo,
                    size: 8,
                });
                setContatosBusca(
                    data.content.filter(c => c.ativo && !c.pendenteVinculacao),
                );
            } catch {
                toast.error("Erro ao buscar contatos");
            } finally {
                setBuscandoContatos(false);
            }
        }, 350);
    };

    const selecionarContato = (contato: Contato) => {
        setContatoSelecionado(contato);
        setTermoBusca(contato.nome);
        setContatosBusca([]);
        setFormIniciar(f => ({ ...f, contatoId: contato.id }));
    };

    const confirmarIniciarChat = async () => {
        if (!contatoSelecionado) {
            toast.error("Selecione um contato");
            return;
        }
        if (!formIniciar.texto?.trim()) {
            toast.error("Digite uma mensagem para iniciar a conversa");
            return;
        }
        setIniciando(true);
        try {
            const { data } = await chatApi.iniciarChat({
                contatoId: contatoSelecionado.id,
                texto: formIniciar.texto.trim(),
                tipoMidia: formIniciar.tipoMidia ?? "TEXTO",
                descricaoChamado:
                    formIniciar.descricaoChamado?.trim() || undefined,
                categoria: formIniciar.categoria ?? "DUVIDA",
            });
            toast.success(`Conversa iniciada com ${contatoSelecionado.nome}!`);
            fecharModalIniciar();
            setChamados(prev =>
                prev.some(c => c.id === data.chamado.id)
                    ? prev
                    : [data.chamado, ...prev],
            );
            setAba("atendimento");
            await selecionarChamado(data.chamado);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao iniciar conversa";
            toast.error(msg);
        } finally {
            setIniciando(false);
        }
    };

    const totalTriagem = filaAgrupada.length;
    const timelineAtendimento = buildTimeline(
        atendimento.messages,
        atendimento.chamados,
    );
    const totalPendentesVinculacao = contatosPendentes.length;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="chat-page-wrapper">
            <div className="chat-shell">
                {/* Alertas SLA */}
                {alertasSla.length > 0 && (
                    <div className="sla-alertas">
                        {alertasSla.map((a, i) => {
                            const cfg = SLA_CONFIG[a.nivel];
                            return (
                                <div
                                    key={i}
                                    className="sla-alerta"
                                    style={{
                                        color: cfg.cor,
                                        background: cfg.bg,
                                        borderColor: cfg.cor + "40",
                                    }}
                                >
                                    <span>{cfg.icone}</span>
                                    <div>
                                        <strong>{cfg.label}</strong>
                                        <p>{a.mensagem}</p>
                                    </div>
                                    <button
                                        className="sla-alerta-fechar"
                                        onClick={() =>
                                            setAlertasSla(prev =>
                                                prev.filter(
                                                    (_, idx) => idx !== i,
                                                ),
                                            )
                                        }
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Sidebar ──────────────────────────────────────────────────── */}
                <div className="chat-sidebar">
                    <div className="flex">
                        <div className="chat-abas flex flex-grow">
                            <button
                                className={`chat-aba ${aba === "atendimento" ? "ativa" : ""}`}
                                onClick={() => setAba("atendimento")}
                            >
                                🎧 Atendimento
                                {chamados.length > 0 && (
                                    <span className="chat-aba-badge">
                                        {chamados.length}
                                    </span>
                                )}
                            </button>
                            <button
                                className={`chat-aba ${aba === "triagem" ? "ativa" : ""}`}
                                onClick={() => setAba("triagem")}
                            >
                                📥 Triagem
                                {totalTriagem > 0 && (
                                    <span
                                        className="chat-aba-badge chat-aba-badge-alerta"
                                        title={`${totalTriagem} contato(s) aguardando triagem`}
                                    >
                                        {totalTriagem}
                                    </span>
                                )}
                                {aba !== "triagem" &&
                                    Object.keys(alertasTriagem).length > 0 && (
                                        <span
                                            className="chat-aba-badge chat-aba-badge-urgente"
                                            title={`${Object.keys(alertasTriagem).length} contato(s) com alerta de SLA na triagem`}
                                        >
                                            <FontAwesomeIcon
                                                size="sm"
                                                icon={faExclamationTriangle}
                                            />
                                        </span>
                                    )}
                                {totalPendentesVinculacao > 0 && (
                                    <span
                                        className="chat-aba-badge"
                                        style={{
                                            background: "#f59e0b",
                                            marginLeft: 2,
                                        }}
                                        title={`${totalPendentesVinculacao} contato(s) aguardando vinculação`}
                                    >
                                        {totalPendentesVinculacao}
                                    </span>
                                )}
                            </button>
                        </div>
                        <div className="flex flex-1 flex-row-reverse">
                            <button
                                className="chat-nova-conversa-btn"
                                onClick={abrirModalIniciar}
                                title="Iniciar conversa ativa com um contato"
                            >
                                <FontAwesomeIcon
                                    className="size-4 mr-2 text-[var(--brand-mid)]"
                                    icon={faCirclePlus}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Lista de chamados */}
                    {aba === "atendimento" && (
                        <div className="chat-lista">
                            {loadingChamados ? (
                                <div className="chat-lista-vazio">
                                    Carregando...
                                </div>
                            ) : chamados.length === 0 ? (
                                <div className="chat-lista-vazio">
                                    <span>📭</span>
                                    <p>Nenhum chamado em aberto</p>
                                    <button
                                        className="btn-primary btn-sm"
                                        style={{ marginTop: 4 }}
                                        onClick={abrirModalIniciar}
                                    >
                                        + Iniciar Conversa
                                    </button>
                                </div>
                            ) : (
                                chamados.map(c => {
                                    const statusCfg =
                                        STATUS_CONFIG[
                                            c.statusAtual as ChamadoStatus
                                        ];
                                    const ativo = chamadoAtivo?.id === c.id;
                                    const alerta = alertasSla.find(
                                        a => a.chamadoId === c.id,
                                    );
                                    return (
                                        <button
                                            key={c.id}
                                            className={`chat-item ${ativo ? "ativo" : ""} ${alerta ? "chat-item-alerta" : ""}`}
                                            onClick={() => selecionarChamado(c)}
                                        >
                                            {alerta && (
                                                <span
                                                    className="chat-item-sla"
                                                    style={{
                                                        color: SLA_CONFIG[
                                                            alerta.nivel
                                                        ].cor,
                                                    }}
                                                    title={alerta.mensagem}
                                                >
                                                    {
                                                        SLA_CONFIG[alerta.nivel]
                                                            .icone
                                                    }
                                                </span>
                                            )}
                                            <div className="chat-item-avatar">
                                                {(c.contatoNome || "?")
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>
                                            <div className="chat-item-info">
                                                <div className="chat-item-topo">
                                                    <span className="chat-item-nome">
                                                        {c.contatoNome || "—"}
                                                    </span>
                                                    <span
                                                        className="chat-item-status"
                                                        style={{
                                                            color: statusCfg?.cor,
                                                        }}
                                                    >
                                                        {statusCfg?.icone}
                                                    </span>
                                                </div>
                                                <div className="chat-item-preview">
                                                    {c.texto
                                                        ? c.texto.slice(0, 50) +
                                                          (c.texto.length > 50
                                                              ? "…"
                                                              : "")
                                                        : "Sem descrição"}
                                                </div>
                                                <div className="chat-item-data">
                                                    {formatarDataHora(
                                                        c.dtAbertura,
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Fila de triagem */}
                    {aba === "triagem" && (
                        <div className="chat-lista">
                            {loadingTriagem ? (
                                <div className="chat-lista-vazio">
                                    Carregando...
                                </div>
                            ) : filaAgrupada.length === 0 ? (
                                <div className="chat-lista-vazio">
                                    <span>✅</span>
                                    <p>
                                        Fila limpa — nenhuma mensagem pendente
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {totalPendentesVinculacao > 0 && (
                                        <div
                                            style={{
                                                padding: "8px 12px",
                                                background:
                                                    "rgba(245,158,11,.08)",
                                                borderBottom:
                                                    "1px solid rgba(245,158,11,.25)",
                                                fontSize: 12,
                                                color: "#92400e",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                gap: 8,
                                            }}
                                        >
                                            <span>
                                                🔗{" "}
                                                <strong>
                                                    {totalPendentesVinculacao}
                                                </strong>{" "}
                                                contato(s) sem vínculo com
                                                Cliente
                                            </span>
                                            <button
                                                className="btn-secondary btn-sm"
                                                onClick={() =>
                                                    navigate("contatos")
                                                }
                                            >
                                                Vincular
                                            </button>
                                        </div>
                                    )}
                                    {selecionados.size > 0 && (
                                        <div className="triagem-acoes">
                                            <span>
                                                {selecionados.size}{" "}
                                                selecionado(s)
                                            </span>
                                            <button
                                                className="btn-primary btn-sm"
                                                onClick={abrirModalCriar}
                                            >
                                                + Criar Chamado
                                            </button>
                                        </div>
                                    )}
                                    {filaAgrupada.map(item => {
                                        const pendente =
                                            item.pendenteVinculacao;
                                        const selecionado = selecionados.has(
                                            item.contatoId,
                                        );
                                        const aberto =
                                            contatoTriagemAtivo?.contatoId ===
                                            item.contatoId;
                                        const alertaTriagem =
                                            alertasTriagem[item.contatoId];
                                        // Classe de borda: alerta tem precedência sobre pendência
                                        const bordaClass = alertaTriagem
                                            ? alertaTriagem.nivel === "ESCALADO"
                                                ? "chat-item-triagem-sla-urgente"
                                                : "chat-item-triagem-sla-alerta"
                                            : pendente
                                              ? "chat-item-triagem-pendente"
                                              : "";
                                        return (
                                            <div
                                                key={item.contatoId}
                                                className={`chat-item chat-item-triagem ${aberto ? "ativo" : ""} ${selecionado ? "selecionado" : ""} ${bordaClass}`}
                                            >
                                                <button
                                                    className="chat-item-checkbox"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        toggleSelecionado(
                                                            item.contatoId,
                                                        );
                                                    }}
                                                    title="Selecionar para criar chamado"
                                                    disabled={pendente}
                                                >
                                                    {selecionado ? "☑️" : "☐"}
                                                </button>
                                                <button
                                                    className="chat-item-triagem-corpo"
                                                    onClick={() =>
                                                        abrirConversaTriagem(
                                                            item,
                                                        )
                                                    }
                                                >
                                                    <div className="chat-item-avatar chat-item-avatar-cliente">
                                                        {item.nomeContato
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </div>
                                                    <div className="chat-item-info">
                                                        <div className="chat-item-topo">
                                                            <span className="chat-item-nome">
                                                                {
                                                                    item.nomeContato
                                                                }
                                                                {pendente && (
                                                                    <span
                                                                        title="Contato sem vínculo com Cliente"
                                                                        style={{
                                                                            marginLeft: 5,
                                                                            fontSize: 12,
                                                                        }}
                                                                    >
                                                                        🔗
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {alertaTriagem && (
                                                                <span
                                                                    className={`triagem-sla-badge triagem-sla-badge--${alertaTriagem.nivel === "ESCALADO" ? "urgente" : "alerta"}`}
                                                                    title={
                                                                        alertaTriagem.mensagem
                                                                    }
                                                                >
                                                                    {
                                                                        SLA_TRIAGEM_CONFIG[
                                                                            alertaTriagem
                                                                                .nivel
                                                                        ].label
                                                                    }
                                                                </span>
                                                            )}
                                                            <span className="chat-item-contagem">
                                                                {
                                                                    item.totalMensagens
                                                                }{" "}
                                                                msg
                                                            </span>
                                                        </div>
                                                        <div className="chat-item-preview">
                                                            {previewMidia(item)}
                                                        </div>
                                                        <div className="chat-item-data">
                                                            {formatarDataCurta(
                                                                item.dtUltimaMensagem,
                                                            )}{" "}
                                                            {formatarHora(
                                                                item.dtUltimaMensagem,
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Área de conversa ─────────────────────────────────────────── */}
                <div className="chat-conteudo">
                    {/* Atendimento vazio */}
                    {aba === "atendimento" && !chamadoAtivo && (
                        <div className="chat-vazio">
                            <span className="chat-vazio-icone">💬</span>
                            <h3>Selecione um chamado</h3>
                            <p>
                                Escolha um chamado na lista para iniciar o
                                atendimento
                            </p>
                            <button
                                className="btn-primary"
                                style={{ marginTop: 8 }}
                                onClick={abrirModalIniciar}
                            >
                                Nova Conversa
                            </button>
                        </div>
                    )}

                    {/* Chamado ativo */}
                    {aba === "atendimento" && chamadoAtivo && (
                        <>
                            <div className="chat-header-conversa">
                                <div className="chat-header-avatar">
                                    {(chamadoAtivo.contatoNome || "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>
                                <div className="chat-header-info">
                                    <strong>{chamadoAtivo.contatoNome}</strong>
                                    {(() => {
                                        const cfg =
                                            STATUS_CONFIG[
                                                chamadoAtivo.statusAtual as ChamadoStatus
                                            ];
                                        return (
                                            <span
                                                className="chat-header-status"
                                                style={{
                                                    color: cfg?.cor,
                                                    background: cfg?.bg,
                                                    border: `1px solid ${cfg?.border}`,
                                                }}
                                            >
                                                {cfg?.icone} {cfg?.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <button
                                    className="btn-secondary btn-sm"
                                    onClick={() => setChamadoAtivo(null)}
                                    style={{ marginLeft: "auto" }}
                                >
                                    ✕ Fechar
                                </button>
                            </div>
                            <div
                                className="chat-mensagens"
                                ref={atendimento.containerRef}
                            >
                                {atendimento.loading ? (
                                    <div className="chat-msgs-loading">
                                        Carregando mensagens...
                                    </div>
                                ) : timelineAtendimento.length === 0 ? (
                                    <div className="chat-msgs-vazio">
                                        <p>Nenhuma mensagem ainda</p>
                                    </div>
                                ) : (
                                    <>
                                        {atendimento.hasOlderPages && (
                                            <div className="chat-timeline-load-older">
                                                <button
                                                    type="button"
                                                    onClick={
                                                        atendimento.loadOlderMessages
                                                    }
                                                    disabled={
                                                        atendimento.loadingOlder
                                                    }
                                                >
                                                    {atendimento.loadingOlder
                                                        ? "Carregando..."
                                                        : "↑ Carregar mensagens anteriores"}
                                                </button>
                                            </div>
                                        )}
                                        {timelineAtendimento.map((item, i) => {
                                            if (item.kind === "open") {
                                                const cat = item.data.categoria
                                                    ? CATEGORIA_CONFIG[
                                                          item.data.categoria
                                                      ]
                                                    : null;
                                                return (
                                                    <div
                                                        key={`open-${item.data.id}`}
                                                        className="chat-timeline-marker chat-timeline-marker-open"
                                                    >
                                                        <div className="chat-timeline-marker-content">
                                                            <span>
                                                                📋 Chamado
                                                                aberto
                                                                {cat
                                                                    ? ` — ${cat.icone} ${cat.label}`
                                                                    : ""}
                                                            </span>
                                                            <span className="chat-timeline-marker-ts">
                                                                {formatarDataHora(
                                                                    item.data
                                                                        .dtAbertura,
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
                                                        className="chat-timeline-marker chat-timeline-marker-close"
                                                    >
                                                        <div className="chat-timeline-marker-content">
                                                            <span>
                                                                🔒 Chamado
                                                                encerrado
                                                            </span>
                                                            <span className="chat-timeline-marker-ts">
                                                                {formatarDataHora(
                                                                    item.data
                                                                        .dtEncerramento,
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            const msg = item.data;
                                            const prevItem =
                                                timelineAtendimento[i - 1];
                                            const mesmoDia =
                                                prevItem &&
                                                new Date(
                                                    prevItem.ts,
                                                ).toDateString() ===
                                                    new Date(
                                                        item.ts,
                                                    ).toDateString();
                                            const isSuporteMsg =
                                                msg.origem === "SUPORTE";
                                            return (
                                                <div key={msg.id}>
                                                    {!mesmoDia && (
                                                        <div className="chat-separador-data">
                                                            <span>
                                                                {formatarDataCurta(
                                                                    msg.dtEnvio,
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div
                                                        className={`chat-msg ${isSuporteMsg ? "chat-msg-suporte" : "chat-msg-cliente"}`}
                                                    >
                                                        {!isSuporteMsg && (
                                                            <div className="chat-msg-avatar">
                                                                {(
                                                                    msg.nomeContato ||
                                                                    "?"
                                                                )
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="chat-msg-balao">
                                                            {!isSuporteMsg && (
                                                                <span className="chat-msg-remetente">
                                                                    {
                                                                        msg.nomeContato
                                                                    }
                                                                </span>
                                                            )}
                                                            {msg.tipoMidia ===
                                                                "IMAGEM" &&
                                                            msg.fileUrl ? (
                                                                <img
                                                                    src={
                                                                        msg.fileUrl
                                                                    }
                                                                    alt="imagem"
                                                                    className="chat-msg-imagem"
                                                                />
                                                            ) : msg.tipoMidia ===
                                                                  "AUDIO" &&
                                                              msg.fileUrl ? (
                                                                <audio
                                                                    controls
                                                                    src={
                                                                        msg.fileUrl
                                                                    }
                                                                    className="chat-msg-audio"
                                                                />
                                                            ) : (
                                                                <p className="chat-msg-texto">
                                                                    {msg.texto}
                                                                </p>
                                                            )}
                                                            <span className="chat-msg-hora">
                                                                {formatarHora(
                                                                    msg.dtEnvio,
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={fimMensagensRef} />
                                    </>
                                )}
                            </div>
                            {chamadoAtivo.statusAtual !== "ENCERRADO" ? (
                                <div className="chat-input-area">
                                    <textarea
                                        ref={inputRef}
                                        className="chat-input"
                                        placeholder="Digite sua resposta… (Enter para enviar, Shift+Enter para nova linha)"
                                        value={texto}
                                        onChange={e => setTexto(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        rows={2}
                                        disabled={enviando}
                                    />
                                    <button
                                        className="chat-btn-enviar"
                                        onClick={enviarMensagem}
                                        disabled={!texto.trim() || enviando}
                                        title="Enviar (Enter)"
                                    >
                                        {enviando ? "⏳" : "➤"}
                                    </button>
                                </div>
                            ) : (
                                <div className="chat-encerrado-aviso">
                                    🔒 Este chamado está encerrado. Não é
                                    possível enviar mensagens.
                                </div>
                            )}
                        </>
                    )}

                    {/* Triagem vazia */}
                    {aba === "triagem" && !contatoTriagemAtivo && (
                        <div className="chat-vazio">
                            <span className="chat-vazio-icone">📥</span>
                            <h3>Fila de Triagem</h3>
                            <p>
                                Clique em um contato para{" "}
                                <strong>ver e responder</strong> a conversa, ou
                                marque o checkbox para criar um chamado formal
                            </p>
                            {totalPendentesVinculacao > 0 && (
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: "#92400e",
                                        background: "rgba(245,158,11,.08)",
                                        padding: "8px 14px",
                                        borderRadius: 8,
                                        border: "1px solid rgba(245,158,11,.25)",
                                        marginTop: 8,
                                    }}
                                >
                                    🔗 Contatos marcados com <strong>🔗</strong>{" "}
                                    precisam ser vinculados a um Cliente antes
                                    de criar chamado.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Conversa de triagem */}
                    {aba === "triagem" && contatoTriagemAtivo && (
                        <TriagemConversaPanel
                            key={contatoTriagemAtivo.contatoId}
                            contatoTriagemAtivo={contatoTriagemAtivo}
                            onFechar={() => setContatoTriagemAtivo(null)}
                            onCriarChamado={abrirModalCriarParaContato}
                            onResponder={() =>
                                removerAlertaTriagem(
                                    contatoTriagemAtivo.contatoId,
                                )
                            }
                        />
                    )}
                </div>

                {/* ── Modal Criar Chamado ───────────────────────────────────────── */}
                {modalCriarChamado && (
                    <div
                        className="modal-overlay"
                        onClick={() => setModalCriarChamado(false)}
                    >
                        <div
                            className="modal modal-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3>Criar Chamado</h3>
                                <button
                                    className="modal-fechar"
                                    onClick={() => setModalCriarChamado(false)}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="modal-body">
                                <p
                                    style={{
                                        fontSize: 13,
                                        color: "var(--color-text-muted)",
                                        marginBottom: 14,
                                    }}
                                >
                                    As mensagens da triagem serão vinculadas
                                    automaticamente ao chamado.
                                </p>
                                <div
                                    className="form-grid"
                                    style={{ gridTemplateColumns: "1fr" }}
                                >
                                    <div className="form-group">
                                        <label>Categoria</label>
                                        <select
                                            title="categoria"
                                            value={formCriar.categoria}
                                            onChange={e =>
                                                setFormCriar(f => ({
                                                    ...f,
                                                    categoria: e.target
                                                        .value as
                                                        | "ERRO"
                                                        | "DUVIDA",
                                                }))
                                            }
                                        >
                                            <option value="DUVIDA">
                                                ❓ Dúvida
                                            </option>
                                            <option value="ERRO">
                                                🔴 Erro
                                            </option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Descrição inicial</label>
                                        <textarea
                                            rows={3}
                                            value={formCriar.texto ?? ""}
                                            onChange={e =>
                                                setFormCriar(f => ({
                                                    ...f,
                                                    texto: e.target.value,
                                                }))
                                            }
                                            placeholder="Texto inicial do chamado..."
                                            style={{ resize: "vertical" }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    className="btn-secondary"
                                    onClick={() => setModalCriarChamado(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={criarChamadoDeTriagem}
                                    disabled={criando}
                                >
                                    {criando ? "Criando..." : "+ Criar Chamado"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Modal Nova Conversa ───────────────────────────────────────── */}
                {modalIniciar && (
                    <div className="modal-overlay" onClick={fecharModalIniciar}>
                        <div
                            className="modal modal-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <div>
                                    <h3>Nova Conversa</h3>
                                    <p className="modal-subtitulo">
                                        Inicie uma conversa ativa com um contato
                                        cadastrado
                                    </p>
                                </div>
                                <button
                                    className="modal-fechar"
                                    onClick={fecharModalIniciar}
                                    disabled={iniciando}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="modal-body">
                                <div
                                    className="form-grid"
                                    style={{ gridTemplateColumns: "1fr" }}
                                >
                                    <div className="form-group">
                                        <label>
                                            Contato{" "}
                                            <span className="campo-obrigatorio">
                                                *
                                            </span>
                                        </label>
                                        <div className="chat-busca-contato-wrapper">
                                            <input
                                                type="text"
                                                className="chat-busca-contato-input"
                                                placeholder="Buscar por nome ou telefone…"
                                                value={termoBusca}
                                                onChange={e =>
                                                    handleBuscaContato(
                                                        e.target.value,
                                                    )
                                                }
                                                autoFocus
                                                disabled={iniciando}
                                            />
                                            {contatoSelecionado && (
                                                <span className="chat-contato-selecionado-badge">
                                                    ✓
                                                </span>
                                            )}
                                            {buscandoContatos && (
                                                <span className="chat-busca-spinner">
                                                    ⏳
                                                </span>
                                            )}
                                            {contatosBusca.length > 0 && (
                                                <ul className="chat-busca-dropdown">
                                                    {contatosBusca.map(c => (
                                                        <li
                                                            key={c.id}
                                                            className="chat-busca-option"
                                                            onClick={() =>
                                                                selecionarContato(
                                                                    c,
                                                                )
                                                            }
                                                        >
                                                            <div className="chat-busca-option-avatar">
                                                                {c.nome
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </div>
                                                            <div className="chat-busca-option-info">
                                                                <span className="chat-busca-option-nome">
                                                                    {c.nome}
                                                                </span>
                                                                <span className="chat-busca-option-fone">
                                                                    {c.telefone}
                                                                </span>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {termoBusca.length > 1 &&
                                                !buscandoContatos &&
                                                contatosBusca.length === 0 &&
                                                !contatoSelecionado && (
                                                    <div className="chat-busca-vazio">
                                                        <span>
                                                            Nenhum contato ativo
                                                            encontrado
                                                        </span>
                                                        <button
                                                            className="btn-link"
                                                            onClick={() => {
                                                                fecharModalIniciar();
                                                                navigate(
                                                                    "contatos",
                                                                );
                                                            }}
                                                        >
                                                            + Cadastrar contato
                                                        </button>
                                                    </div>
                                                )}
                                        </div>
                                        {contatoSelecionado && (
                                            <div className="chat-contato-selecionado-card">
                                                <div
                                                    className="chat-busca-option-avatar"
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        fontSize: 13,
                                                    }}
                                                >
                                                    {contatoSelecionado.nome
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                                <div>
                                                    <strong>
                                                        {
                                                            contatoSelecionado.nome
                                                        }
                                                    </strong>
                                                    <span>
                                                        {
                                                            contatoSelecionado.telefone
                                                        }
                                                    </span>
                                                </div>
                                                <button
                                                    className="chat-contato-remover"
                                                    onClick={() => {
                                                        setContatoSelecionado(
                                                            null,
                                                        );
                                                        setTermoBusca("");
                                                        setFormIniciar(f => ({
                                                            ...f,
                                                            contatoId:
                                                                undefined,
                                                        }));
                                                    }}
                                                    title="Remover seleção"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Mensagem{" "}
                                            <span className="campo-obrigatorio">
                                                *
                                            </span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            className="chat-iniciar-textarea"
                                            placeholder="Digite a primeira mensagem que será enviada via WhatsApp…"
                                            value={formIniciar.texto ?? ""}
                                            onChange={e =>
                                                setFormIniciar(f => ({
                                                    ...f,
                                                    texto: e.target.value,
                                                }))
                                            }
                                            style={{ resize: "vertical" }}
                                            disabled={iniciando}
                                        />
                                    </div>
                                    <div
                                        className="form-grid"
                                        style={{
                                            gridTemplateColumns: "1fr 1fr",
                                            gap: 10,
                                        }}
                                    >
                                        <div className="form-group">
                                            <label>Categoria</label>
                                            <select
                                                title="categoria"
                                                value={formIniciar.categoria}
                                                onChange={e =>
                                                    setFormIniciar(f => ({
                                                        ...f,
                                                        categoria: e.target
                                                            .value as
                                                            | "ERRO"
                                                            | "DUVIDA",
                                                    }))
                                                }
                                                disabled={iniciando}
                                            >
                                                <option value="DUVIDA">
                                                    ❓ Dúvida
                                                </option>
                                                <option value="ERRO">
                                                    🔴 Erro
                                                </option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>
                                                Descrição do chamado{" "}
                                                <span
                                                    style={{
                                                        fontWeight: 400,
                                                        fontSize: 11,
                                                        color: "var(--color-text-muted)",
                                                    }}
                                                >
                                                    (opcional)
                                                </span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Deixe vazio para usar a mensagem"
                                                value={
                                                    formIniciar.descricaoChamado ??
                                                    ""
                                                }
                                                onChange={e =>
                                                    setFormIniciar(f => ({
                                                        ...f,
                                                        descricaoChamado:
                                                            e.target.value,
                                                    }))
                                                }
                                                disabled={iniciando}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    className="btn-secondary"
                                    onClick={fecharModalIniciar}
                                    disabled={iniciando}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={confirmarIniciarChat}
                                    disabled={
                                        iniciando ||
                                        !contatoSelecionado ||
                                        !formIniciar.texto?.trim()
                                    }
                                >
                                    {iniciando
                                        ? "⏳ Enviando..."
                                        : "Iniciar Conversa"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
