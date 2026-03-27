import type { Chat, Chamado } from "../types";

export type TlMsg   = { kind: "msg";   data: Chat;    ts: number };
export type TlOpen  = { kind: "open";  data: Chamado; ts: number };
export type TlClose = { kind: "close"; data: Chamado; ts: number };
export type TlItem  = TlMsg | TlOpen | TlClose;

export function buildTimeline(messages: Chat[], chamados: Chamado[]): TlItem[] {
    const items: TlItem[] = messages.map(m => ({
        kind: "msg",
        data: m,
        ts: m.dtEnvio ? new Date(m.dtEnvio).getTime() : 0,
    }));
    for (const c of chamados) {
        items.push({ kind: "open",  data: c, ts: new Date(c.dtAbertura).getTime() });
        if (c.dtEncerramento) {
            items.push({ kind: "close", data: c, ts: new Date(c.dtEncerramento).getTime() });
        }
    }
    return items.sort((a, b) => a.ts - b.ts);
}
