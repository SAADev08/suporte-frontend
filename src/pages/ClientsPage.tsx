import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { Cliente, PageResponse } from "../types";
import { clienteApi, type ClienteRequest } from "../services/api/clientApi";
import {
    formatarCpfCnpj,
    apenasNumeros,
    validarCpfCnpj,
    formatarData,
} from "../utils/formatters";
import { Pagination, type TamanhoPagina } from "../components/Pagination";

// ─── Estado inicial do formulário ─────────────────────────────────────────────
const FORM_VAZIO: ClienteRequest = {
    nome: "",
    cidade: "",
    cpfCnpj: "",
    contatoPrincipal: "",
    comercialResponsavel: "",
};

// ─── Componente principal ─────────────────────────────────────────────────────
export function ClientsPage() {
    const [pageData, setPageData] = useState<PageResponse<Cliente> | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState({ nome: "", cidade: "", cpfCnpj: "" });
    const [modal, setModal] = useState<"criar" | "editar" | "detalhe" | null>(
        null,
    );
    const [selecionado, setSelecionado] = useState<Cliente | null>(null);
    const [form, setForm] = useState<ClienteRequest>(FORM_VAZIO);
    const [erros, setErros] = useState<Partial<ClienteRequest>>({});
    const [salvando, setSalvando] = useState(false);
    const [confirmInativar, setConfirmInativar] = useState<Cliente | null>(
        null,
    );

    const [page, setPage] = useState(0);
    const [size, setSize] = useState<TamanhoPagina>(10);

    // ─── Carregar lista ─────────────────────────────────────────────────────────
    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                nome: busca.nome || undefined,
                cidade: busca.cidade || undefined,
                cpfCnpj: apenasNumeros(busca.cpfCnpj) || undefined,
                page,
                size,
            };
            const { data } = await clienteApi.listar(params);
            setPageData(data);
        } catch {
            toast.error("Erro ao carregar clientes");
        } finally {
            setLoading(false);
        }
    }, [busca, page, size]);

    useEffect(() => {
        carregar();
    }, [carregar]);

    // ─── Validação ──────────────────────────────────────────────────────────────
    const validar = (): boolean => {
        const e: Partial<ClienteRequest> = {};
        if (!form.nome.trim()) e.nome = "Nome é obrigatório";
        if (!form.cpfCnpj.trim()) {
            e.cpfCnpj = "CPF/CNPJ é obrigatório";
        } else if (!validarCpfCnpj(form.cpfCnpj)) {
            e.cpfCnpj = "CPF/CNPJ inválido";
        }
        setErros(e);
        return Object.keys(e).length === 0;
    };

    // ─── Abrir modal criar ──────────────────────────────────────────────────────
    const abrirCriar = () => {
        setForm(FORM_VAZIO);
        setErros({});
        setSelecionado(null);
        setModal("criar");
    };

    // ─── Abrir modal editar ─────────────────────────────────────────────────────
    const abrirEditar = (c: Cliente) => {
        setForm({
            nome: c.nome,
            cidade: c.cidade || "",
            cpfCnpj: formatarCpfCnpj(c.cpfCnpj),
            contatoPrincipal: c.contatoPrincipal || "",
            comercialResponsavel: c.comercialResponsavel || "",
        });
        setErros({});
        setSelecionado(c);
        setModal("editar");
    };

    // ─── Abrir detalhe ──────────────────────────────────────────────────────────
    const abrirDetalhe = async (c: Cliente) => {
        try {
            const { data } = await clienteApi.buscarPorId(c.id);
            setSelecionado(data);
            setModal("detalhe");
        } catch {
            toast.error("Erro ao carregar dados do cliente");
        }
    };

    // ─── Salvar (criar ou editar) ───────────────────────────────────────────────
    const salvar = async () => {
        if (!validar()) return;
        setSalvando(true);
        try {
            const payload: ClienteRequest = {
                ...form,
                cpfCnpj: apenasNumeros(form.cpfCnpj),
            };
            if (modal === "criar") {
                await clienteApi.criar(payload);
                toast.success("Cliente cadastrado com sucesso!");
            } else if (modal === "editar" && selecionado) {
                await clienteApi.atualizar(selecionado.id, payload);
                toast.success("Cliente atualizado com sucesso!");
            }
            setModal(null);
            carregar();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao salvar cliente";
            toast.error(msg);
        } finally {
            setSalvando(false);
        }
    };

    // ─── Inativar ───────────────────────────────────────────────────────────────
    const inativar = async () => {
        if (!confirmInativar) return;
        try {
            await clienteApi.inativar(confirmInativar.id);
            toast.success(`Cliente "${confirmInativar.nome}" inativado.`);
            setConfirmInativar(null);
            carregar();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ||
                "Não foi possível inativar o cliente";
            toast.error(msg);
            setConfirmInativar(null);
        }
    };

    // ─── Handler do formulário ──────────────────────────────────────────────────
    const handleChange = (field: keyof ClienteRequest, value: string) => {
        if (field === "cpfCnpj") {
            const nums = apenasNumeros(value);
            setForm(f => ({ ...f, cpfCnpj: formatarCpfCnpj(nums) }));
        } else {
            setForm(f => ({ ...f, [field]: value }));
        }
        if (erros[field]) setErros(e => ({ ...e, [field]: undefined }));
    };

    // ─── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="modulo">
            {/* Cabeçalho */}
            <div className="modulo-header">
                <div>
                    <h2 className="modulo-titulo">Clientes</h2>
                    <p className="modulo-subtitulo">
                        Gerencie os clientes cadastrados no sistema
                    </p>
                </div>
                <button className="btn-primary" onClick={abrirCriar}>
                    + Novo Cliente
                </button>
            </div>

            {/* Filtros */}
            <div className="filtros-bar">
                <input
                    className="filtro-input"
                    placeholder="Buscar por nome..."
                    value={busca.nome}
                    onChange={e =>
                        setBusca(b => ({ ...b, nome: e.target.value }))
                    }
                />
                <input
                    className="filtro-input"
                    placeholder="Cidade..."
                    value={busca.cidade}
                    onChange={e =>
                        setBusca(b => ({ ...b, cidade: e.target.value }))
                    }
                />
                <input
                    className="filtro-input"
                    placeholder="CPF/CNPJ..."
                    value={busca.cpfCnpj}
                    onChange={e =>
                        setBusca(b => ({ ...b, cpfCnpj: e.target.value }))
                    }
                />
                <button className="btn-secondary" onClick={carregar}>
                    🔍 Buscar
                </button>
            </div>

            {/* Tabela */}
            <div className="tabela-wrapper">
                {loading ? (
                    <div className="estado-vazio">Carregando...</div>
                ) : !pageData || pageData.content.length === 0 ? (
                    <div className="estado-vazio">
                        <p>Nenhum cliente encontrado.</p>
                        <button className="btn-primary" onClick={abrirCriar}>
                            Cadastrar primeiro cliente
                        </button>
                    </div>
                ) : (
                    <>
                        <table className="tabela tabela-6col">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>CPF/CNPJ</th>
                                    <th className="tabela-col-ocultar-mobile">
                                        Cidade
                                    </th>
                                    <th className="tabela-col-ocultar-mobile">
                                        Contato Principal
                                    </th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageData.content.map(c => (
                                    <tr
                                        key={c.id}
                                        className={
                                            !c.ativo ? "linha-inativa" : ""
                                        }
                                    >
                                        <td>
                                            <button
                                                className="link-tabela"
                                                onClick={() => abrirDetalhe(c)}
                                            >
                                                {c.nome}
                                            </button>
                                        </td>
                                        <td className="texto-mono">
                                            {formatarCpfCnpj(c.cpfCnpj)}
                                        </td>
                                        <td className="tabela-col-ocultar-mobile">
                                            {c.cidade || "—"}
                                        </td>
                                        <td className="tabela-col-ocultar-mobile">
                                            {c.contatoPrincipal || "—"}
                                        </td>
                                        <td>
                                            <span
                                                className={`badge ${c.ativo ? "badge-ativo" : "badge-inativo"}`}
                                            >
                                                {c.ativo ? "Ativo" : "Inativo"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="acoes-tabela">
                                                <button
                                                    className="btn-acao btn-acao-editar"
                                                    onClick={() =>
                                                        abrirEditar(c)
                                                    }
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                {c.ativo && (
                                                    <button
                                                        className="btn-acao btn-acao-inativar"
                                                        onClick={() =>
                                                            setConfirmInativar(
                                                                c,
                                                            )
                                                        }
                                                        title="Inativar"
                                                    >
                                                        🚫
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Pagination
                            page={pageData.number}
                            totalPages={pageData.totalPages}
                            totalElements={pageData.totalElements}
                            size={pageData.size as TamanhoPagina}
                            onPageChange={setPage}
                            onSizeChange={s => {
                                console.log("Tamanho página:", s);
                                setSize(s);
                                setPage(0);
                            }}
                        />
                    </>
                )}
            </div>

            {/* Modal Criar / Editar */}
            {(modal === "criar" || modal === "editar") && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                {modal === "criar"
                                    ? "Novo Cliente"
                                    : "Editar Cliente"}
                            </h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setModal(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-grid">
                                <div className="form-group form-col-2">
                                    <label>
                                        Nome{" "}
                                        <span className="obrigatorio">*</span>
                                    </label>
                                    <input
                                        value={form.nome}
                                        onChange={e =>
                                            handleChange("nome", e.target.value)
                                        }
                                        placeholder="Razão social ou nome completo"
                                        className={
                                            erros.nome ? "input-erro" : ""
                                        }
                                    />
                                    {erros.nome && (
                                        <span className="erro-msg">
                                            {erros.nome}
                                        </span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>
                                        CPF/CNPJ{" "}
                                        <span className="obrigatorio">*</span>
                                    </label>
                                    <input
                                        value={form.cpfCnpj}
                                        onChange={e =>
                                            handleChange(
                                                "cpfCnpj",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                                        maxLength={18}
                                        className={
                                            erros.cpfCnpj ? "input-erro" : ""
                                        }
                                        disabled={modal === "editar"}
                                    />
                                    {erros.cpfCnpj && (
                                        <span className="erro-msg">
                                            {erros.cpfCnpj}
                                        </span>
                                    )}
                                    {modal === "editar" && (
                                        <span className="campo-info">
                                            CPF/CNPJ não pode ser alterado
                                        </span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Cidade</label>
                                    <input
                                        value={form.cidade}
                                        onChange={e =>
                                            handleChange(
                                                "cidade",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Cidade"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Contato Principal</label>
                                    <input
                                        value={form.contatoPrincipal}
                                        onChange={e =>
                                            handleChange(
                                                "contatoPrincipal",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Nome do contato principal"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Comercial Responsável</label>
                                    <input
                                        value={form.comercialResponsavel}
                                        onChange={e =>
                                            handleChange(
                                                "comercialResponsavel",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Nome do comercial"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setModal(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={salvar}
                                disabled={salvando}
                            >
                                {salvando
                                    ? "Salvando..."
                                    : modal === "criar"
                                      ? "Cadastrar"
                                      : "Salvar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Detalhe */}
            {modal === "detalhe" && selecionado && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Detalhes do Cliente</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setModal(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detalhe-grid">
                                <DetalheItem
                                    label="Nome"
                                    valor={selecionado.nome}
                                />
                                <DetalheItem
                                    label="CPF/CNPJ"
                                    valor={formatarCpfCnpj(selecionado.cpfCnpj)}
                                    mono
                                />
                                <DetalheItem
                                    label="Cidade"
                                    valor={selecionado.cidade}
                                />
                                <DetalheItem
                                    label="Contato Principal"
                                    valor={selecionado.contatoPrincipal}
                                />
                                <DetalheItem
                                    label="Comercial Responsável"
                                    valor={selecionado.comercialResponsavel}
                                />
                                <DetalheItem
                                    label="Status"
                                    valor={
                                        selecionado.ativo ? "Ativo" : "Inativo"
                                    }
                                    badge={
                                        selecionado.ativo ? "ativo" : "inativo"
                                    }
                                />
                                <DetalheItem
                                    label="Cadastrado em"
                                    valor={formatarData(
                                        selecionado.createdAt || "",
                                    )}
                                />
                                <DetalheItem
                                    label="Atualizado em"
                                    valor={formatarData(
                                        selecionado.updatedAt || "",
                                    )}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setModal(null)}
                            >
                                Fechar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={() => abrirEditar(selecionado)}
                            >
                                Editar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirmar Inativação */}
            {confirmInativar && (
                <div
                    className="modal-overlay"
                    onClick={() => setConfirmInativar(null)}
                >
                    <div
                        className="modal modal-sm"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>Confirmar Inativação</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setConfirmInativar(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Deseja inativar o cliente{" "}
                                <strong>{confirmInativar.nome}</strong>?
                            </p>
                            <p className="texto-aviso">
                                ⚠️ Esta ação só é permitida se não houver
                                chamados abertos vinculados ao cliente.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setConfirmInativar(null)}
                            >
                                Cancelar
                            </button>
                            <button className="btn-danger" onClick={inativar}>
                                Confirmar Inativação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Componente auxiliar ──────────────────────────────────────────────────────
function DetalheItem({
    label,
    valor,
    mono,
    badge,
}: {
    label: string;
    valor?: string | null;
    mono?: boolean;
    badge?: "ativo" | "inativo";
}) {
    return (
        <div className="detalhe-item">
            <span className="detalhe-label">{label}</span>
            {badge ? (
                <span className={`badge badge-${badge}`}>{valor}</span>
            ) : (
                <span className={`detalhe-valor ${mono ? "texto-mono" : ""}`}>
                    {valor || "—"}
                </span>
            )}
        </div>
    );
}
