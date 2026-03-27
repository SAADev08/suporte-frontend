// ─── Formatação ───────────────────────────────────────────────────────────────
export function formatarCpfCnpj(valor: string): string {
    const nums = valor.replace(/\D/g, "");
    if (nums.length <= 11) {
        return nums
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return nums
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function apenasNumeros(valor: string): string {
    return valor.replace(/\D/g, "");
}

// ─── Validação CPF ────────────────────────────────────────────────────────────
function validarCPF(cpf: string): boolean {
    const nums = cpf.replace(/\D/g, "");
    if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(nums[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(nums[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(nums[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(nums[10]);
}

// ─── Validação CNPJ ───────────────────────────────────────────────────────────
function validarCNPJ(cnpj: string): boolean {
    const nums = cnpj.replace(/\D/g, "");
    if (nums.length !== 14 || /^(\d)\1+$/.test(nums)) return false;
    const calc = (n: string, p: number[]) =>
        p.reduce((acc, p, i) => acc + parseInt(n[i]) * p, 0);
    const mod = (n: number) => {
        const r = n % 11;
        return r < 2 ? 0 : 11 - r;
    };
    const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    return (
        mod(calc(nums, p1)) === parseInt(nums[12]) &&
        mod(calc(nums, p2)) === parseInt(nums[13])
    );
}

export function validarCpfCnpj(valor: string): boolean {
    const nums = valor.replace(/\D/g, "");
    if (nums.length === 11) return validarCPF(nums);
    if (nums.length === 14) return validarCNPJ(nums);
    return false;
}

// ─── Data ────────────────────────────────────────────────────────────────────
export function formatarData(iso: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

// ─── Formatação de telefone ───────────────────────────────────────────────────
export function formatarTelefone(valor: string): string {
    const nums = valor.replace(/\D/g, "");
    if (nums.length <= 10) {
        return nums
            .replace(/(\d{2})(\d)/, "($1) $2")
            .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
    }
    return nums
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

// ─── Helpers TriagemConversaPanel e ContactTimeline ─────────────────────────────────────────────────────────────────
export function formatHora(iso?: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatDataCurta(ts: number): string {
    const d = new Date(ts);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    if (d.toDateString() === hoje.toDateString()) return "Hoje";
    if (d.toDateString() === ontem.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
    });
}
