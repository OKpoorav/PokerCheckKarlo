"use client";

import Link from "next/link";
import { useActionState, useEffect, useOptimistic, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { bumpRound } from "./actions";

export function Header({ title, back, children }: { title: string; back?: string; children?: React.ReactNode }) {
  return (
    <header className="rise mb-2">
      {back && (
        <Link href={back} className="press -ml-1 flex h-11 w-fit items-center text-[17px] text-tint">
          <svg width="12" height="20" viewBox="0 0 12 20" className="mr-1" aria-hidden>
            <path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
      )}
      <div className={`flex items-center justify-between gap-3 ${back ? "" : "pt-3"}`}>
        <h1 className="min-w-0 font-display text-[36px] font-extrabold leading-tight tracking-tight">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </header>
  );
}

export function Submit({ children, className = "btn" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className}>
      {pending ? <span className="chip-loader on-gold inline-block size-5 align-middle" aria-label="Working" /> : children}
    </button>
  );
}

// Form wrapper that shows the action's returned error string, or `ok` once it succeeds.
export function ActionForm({
  action,
  children,
  className,
  ok,
}: {
  action: (prev: string | null, form: FormData) => Promise<string | null | undefined>;
  children: React.ReactNode;
  className?: string;
  ok?: string;
}) {
  // undefined = not submitted yet, null = succeeded, string = error
  const [error, run] = useActionState(
    async (prev: string | null | undefined, form: FormData) => (await action(prev ?? null, form)) ?? null,
    undefined,
  );
  return (
    <form action={run} className={className}>
      {children}
      {error && <p className="rise text-[15px] text-red">{error}</p>}
      {error === null && ok && <p className="rise text-[15px] text-green">{ok}</p>}
    </form>
  );
}

// Keeps a live session in sync for everyone at the table.
export function AutoRefresh({ every = 4000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}

export function RoundMeter({ gameId, rounds, canTap }: { gameId: number; rounds: number; canTap: boolean }) {
  const [count, setCount] = useOptimistic(rounds);
  const [spin, setSpin] = useState(0);
  const bump = (d: 1 | -1) =>
    startTransition(async () => {
      setCount((c) => Math.max(0, c + d));
      setSpin((r) => r + d * 135);
      navigator.vibrate?.(d > 0 ? [12, 30, 12] : 8);
      await bumpRound(gameId, d);
    });

  return (
    <div className="rise flex flex-col items-center pb-2 pt-6">
      <button
        disabled={!canTap}
        onClick={() => bump(1)}
        aria-label={`Round ${count}. Tap for next round`}
        className="press relative grid size-56 place-items-center rounded-full disabled:active:scale-100"
      >
        {/* glow under the chip */}
        <span className="absolute inset-4 rounded-full bg-[#b91c2c] opacity-40 blur-2xl" />
        {/* spinning striped edge */}
        <span
          className="absolute inset-0 rounded-full shadow-[0_24px_50px_rgba(0,0,0,0.7)] transition-transform duration-700 ease-[cubic-bezier(0.2,1.2,0.3,1)]"
          style={{
            transform: `rotate(${spin}deg)`,
            background: "repeating-conic-gradient(#b91c2c 0 30deg, #f5f1e6 30deg 45deg)",
          }}
        >
          <span className="absolute inset-[10%] rounded-full border-2 border-dashed border-[#e9c46a]/70" />
        </span>
        {/* face */}
        <span className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#e2394a,#8f1220_70%)] shadow-[inset_0_2px_6px_rgba(255,255,255,0.25),inset_0_-6px_14px_rgba(0,0,0,0.45)]" />
        <span className="relative flex flex-col items-center">
          <span key={count} className="pop font-display text-[64px] font-extrabold leading-none tabular-nums text-[#fff6e0] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            {count}
          </span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.3em] text-[#f8dd94]">
            {count === 1 ? "Round" : "Rounds"}
          </span>
        </span>
      </button>
      {canTap && (
        <div className="mt-4 flex items-center gap-3 text-[13px] text-secondary">
          Tap the chip for the next round
          <button onClick={() => bump(-1)} className="btn-plain px-3 py-0.5 text-[13px]" aria-label="Undo round">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

// Tap chips to stack an amount into the named input.
export function AmountChips({ target }: { target: string }) {
  const add = (e: React.MouseEvent, v: number) => {
    const input = (e.currentTarget.closest("form")!.elements.namedItem(target) as HTMLInputElement);
    input.value = String((Number(input.value) || 0) + v);
    navigator.vibrate?.(6);
  };
  return (
    <div className="flex justify-between gap-2">
      {[100, 500, 1000, 2000, 5000].map((v, i) => (
        <button key={v} type="button" onClick={(e) => add(e, v)} className="press flex flex-col items-center gap-1" aria-label={`Add ${v}`}>
          <Chip id={i} name={v >= 1000 ? `${v / 1000}K` : String(v)} size={46} text />
        </button>
      ))}
    </div>
  );
}

const fmtDay = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// Past sessions with instant client-side search by name or date.
export function SessionList({
  sessions,
}: {
  sessions: { id: number; name: string; created_at: string; rounds: number; players: number; net: number }[];
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? sessions.filter((g) => `${g.name} ${fmtDay(g.created_at)}`.toLowerCase().includes(needle))
    : sessions;

  return (
    <>
      <div className="relative mb-3">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary">
          <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sessions or dates"
          aria-label="Search sessions"
          className="field pl-11"
        />
      </div>
      <div className="card">
        {shown.map((g, i) => (
          <Link key={g.id} href={`/s/${g.id}`} className="row press rise" style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{g.name}</p>
              <p className="text-[13px] text-secondary">
                {fmtDay(g.created_at)} · {g.players} players · {g.rounds} rounds
              </p>
            </div>
            <span className={`font-semibold tabular-nums ${g.net > 0 ? "text-green" : g.net < 0 ? "text-red" : "text-secondary"}`}>
              {g.net > 0 ? "+" : g.net < 0 ? "−" : ""}{Math.abs(g.net).toLocaleString("en-IN")}
            </span>
          </Link>
        ))}
        {!shown.length && <p className="px-4 py-6 text-center text-[15px] text-secondary">No sessions match “{q}”</p>}
      </div>
    </>
  );
}

export function SettleForm({
  action,
  players,
  pot,
}: {
  action: (prev: string | null, form: FormData) => Promise<string | null>;
  players: { id: number; name: string; bought: number }[];
  pot: number;
}) {
  const [total, setTotal] = useState(0);
  const sum = (form: HTMLFormElement) =>
    setTotal(players.reduce((s, p) => s + (Number((form.elements.namedItem(`cashout_${p.id}`) as HTMLInputElement).value) || 0), 0));
  const diff = Math.round((total - pot) * 100) / 100;

  return (
    <ActionForm action={action} className="space-y-3">
      <div className="card" onInput={(e) => sum(e.currentTarget.closest("form")!)}>
        {players.map((p) => (
          <label key={p.id} className="row">
            <Chip id={p.id} name={p.name} />
            <div className="flex-1">
              <p>{p.name}</p>
              <p className="text-[13px] text-secondary">In for {p.bought.toLocaleString("en-IN")}</p>
            </div>
            <input name={`cashout_${p.id}`} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" className="field w-32 py-2 text-right tabular-nums" />
          </label>
        ))}
      </div>
      <p className={`px-4 text-[13px] ${diff === 0 ? "text-green" : "text-secondary"}`}>
        Cashouts {total.toLocaleString("en-IN")} of {pot.toLocaleString("en-IN")} pot
        {diff !== 0 && ` · ${diff > 0 ? "over" : "short"} by ${Math.abs(diff).toLocaleString("en-IN")}`}
      </p>
      <Submit>Settle &amp; End Session</Submit>
    </ActionForm>
  );
}

const CHIP_COLORS = ["#d62839", "#1e6fd9", "#1f9d55", "#7b3fe4", "#f08c00", "#2b2b2b"];
const SUITS = ["♠", "♥", "♣", "♦"];

// Casino-chip avatar: striped edge, inset ring, initials in the middle.
export function Chip({ id, name, size = 36, text }: { id: number; name: string; size?: number; text?: boolean }) {
  const c = CHIP_COLORS[id % CHIP_COLORS.length];
  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
      style={{ width: size, height: size, background: `repeating-conic-gradient(${c} 0 30deg, #f5f1e6 30deg 45deg)` }}
    >
      <span
        className="grid size-[72%] place-items-center rounded-full border border-dashed border-white/60 font-bold text-white"
        style={{ background: c, fontSize: size * (text ? 0.26 : 0.32) }}
      >
        {text ? name : name.slice(0, 2).toUpperCase()}
      </span>
    </span>
  );
}

// Poker-felt dropdown that submits like a <select name=...>.
export function Picker({
  name,
  options,
  defaultValue,
  label = "Pick a player",
}: {
  name: string;
  options: { id: number; name: string; note?: string }[];
  defaultValue?: number;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? options[0]?.id);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (id: number) => {
    setValue(id);
    setOpen(false);
    navigator.vibrate?.(8);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setActive(Math.max(0, options.findIndex((o) => o.id === value)));
      return setOpen(true);
    }
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(options[active].id);
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <input type="hidden" name={name} value={value ?? ""} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="press flex w-full items-center gap-3 rounded-xl bg-fill py-2 pl-2 pr-4 text-left"
      >
        {selected && <Chip id={selected.id} name={selected.name} />}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] uppercase tracking-widest text-secondary">{label}</span>
          <span className="block truncate text-[17px] font-semibold">
            {selected?.name}
            {selected?.note && <span className="ml-1.5 font-normal text-secondary">{selected.note}</span>}
          </span>
        </span>
        <svg width="14" height="9" viewBox="0 0 14 9" aria-hidden className={`text-secondary transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          <path d="m1.5 1.5 5.5 5.5 5.5-5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="felt absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl p-1.5"
        >
          <div className="flex items-center justify-between px-3 pb-1.5 pt-1 text-[11px] uppercase tracking-[0.2em] text-[#e9d8a6]/70">
            <span>Seat</span>
            <span className="tracking-[0.35em]">♠<span className="text-[#ff6b6b]">♥</span>♣<span className="text-[#ff6b6b]">♦</span></span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {options.map((o, i) => {
              const on = o.id === value;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => choose(o.id)}
                  onPointerEnter={() => setActive(i)}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className={`rise press flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-white transition-colors ${
                    i === active ? "bg-white/12" : ""
                  } ${on ? "ring-1 ring-[#e9d8a6]/60" : ""}`}
                >
                  <Chip id={o.id} name={o.name} size={34} />
                  <span className="min-w-0 flex-1 truncate text-[17px] font-medium">
                    {o.name}
                    {o.note && <span className="ml-1.5 text-white/55">{o.note}</span>}
                  </span>
                  <span className={`text-lg transition-all duration-300 ${on ? "scale-100 text-[#e9d8a6] opacity-100" : "scale-50 opacity-0"}`}>
                    {SUITS[o.id % 4]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
