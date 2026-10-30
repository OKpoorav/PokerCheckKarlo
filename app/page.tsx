import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, money, signed } from "@/lib/db";
import { Chip, Header, SessionList } from "./ui";

const tone = (n: number) => (n > 0 ? "text-green" : n < 0 ? "text-red" : "text-secondary");
const MEDALS = ["#f8dd94", "#d7dde4", "#e0a36c"];

export default async function Home() {
  const me = await requireUser();
  const sql = db();
  const [board, games] = await Promise.all([
    // P&L only counts settled sessions.
    sql`
      select u.id, u.name,
        coalesce((select sum(gp.cashout) from game_players gp join games g on g.id = gp.game_id
                  where gp.user_id = u.id and g.ended_at is not null), 0)::float8
      - coalesce((select sum(b.amount) from buyins b join games g on g.id = b.game_id
                  where b.user_id = u.id and g.ended_at is not null), 0)::float8 as pnl,
        (select count(*) from game_players gp join games g on g.id = gp.game_id
         where gp.user_id = u.id and g.ended_at is not null)::int as played
      from users u order by pnl desc, u.name`,
    sql`
      select g.id, g.name, g.rounds, g.ended_at, g.created_at::text,
        (select count(*) from game_players where game_id = g.id)::int as players,
        coalesce((select sum(amount) from buyins where game_id = g.id), 0)::float8 as pot,
        coalesce(gp.cashout, 0)::float8
          - coalesce((select sum(amount) from buyins where game_id = g.id and user_id = ${me.id}), 0)::float8 as net
      from games g join game_players gp on gp.game_id = g.id and gp.user_id = ${me.id}
      order by g.ended_at is not null, g.created_at desc limit 500`,
  ]);
  const mine = board.find((r) => r.id === me.id);
  const pnl = mine?.pnl ?? 0;
  const live = games.filter((g) => !g.ended_at);
  const past = games.filter((g) => g.ended_at);
  const wins = past.filter((g) => g.net > 0).length;
  const best = Math.max(0, ...past.map((g) => g.net));

  return (
    <>
      <Header title="Tally">
        {me.is_admin && <Link href="/admin" className="btn-plain">Admin</Link>}
        <Link href="/account" className="btn-plain">Account</Link>
      </Header>

      <div className="gilded rise mt-3 [animation-delay:40ms]">
        <div className="relative overflow-hidden rounded-[calc(1.75rem-1px)] bg-[linear-gradient(160deg,#0f2a1d,#07140d)] p-5">
          <span aria-hidden className="pointer-events-none absolute right-4 top-3 font-display text-[110px] leading-none text-white/[0.04]">♠</span>
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="" width={44} height={44} className="rounded-xl ring-1 ring-tint/40" />
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-secondary">Lifetime P&amp;L</p>
              <p className="text-[15px] font-medium">{me.name}</p>
            </div>
          </div>
          <p className={`pop mt-5 text-[52px] font-extrabold leading-none tracking-tight tabular-nums ${tone(pnl)}`}>{signed(pnl)}</p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              ["Played", past.length],
              ["In profit", `${wins}/${past.length}`],
              ["Best night", best > 0 ? `+${money(best)}` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-black/25 px-2 py-2.5">
                <p className="truncate text-[19px] font-bold tabular-nums">{v}</p>
                <p className="text-[11px] uppercase tracking-wider text-secondary">{k}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Link href="/new" className="btn rise mt-4 block text-center [animation-delay:80ms]">♠ Deal a New Session</Link>

      {live.length > 0 && (
        <>
          <h2 className="section-title"><span className="size-2 animate-pulse rounded-full bg-green" />Live now</h2>
          <div className="card rise [animation-delay:120ms]">
            {live.map((g) => (
              <Link key={g.id} href={`/s/${g.id}`} className="row press">
                <div className="grid size-11 place-items-center rounded-2xl bg-green/15 font-display text-[19px] font-bold text-green">{g.rounds}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.name}</p>
                  <p className="text-[13px] text-secondary">{g.players} players · Pot {money(g.pot)}</p>
                </div>
                <Chevron />
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Leaderboard</h2>
      <div className="card rise [animation-delay:160ms]">
        {board.map((r, i) => (
          <div key={r.id} className={`row ${r.id === me.id ? "bg-tint/[0.06]" : ""}`}>
            <span
              className="w-6 text-center font-display text-[17px] font-bold tabular-nums"
              style={{ color: MEDALS[i] ?? "var(--secondary)" }}
            >
              {i + 1}
            </span>
            <Chip id={r.id} name={r.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}{r.id === me.id && <span className="ml-1.5 text-secondary">(you)</span>}</p>
              <p className="text-[13px] text-secondary">{r.played} sessions</p>
            </div>
            <span className={`font-semibold tabular-nums ${tone(r.pnl)}`}>{signed(r.pnl)}</span>
          </div>
        ))}
      </div>

      {past.length > 0 && (
        <>
          <h2 className="section-title">Your sessions</h2>
          <div className="rise [animation-delay:200ms]">
            <SessionList sessions={past.map((g) => ({ id: g.id, name: g.name, created_at: g.created_at, rounds: g.rounds, players: g.players, net: g.net }))} />
          </div>
        </>
      )}
    </>
  );
}

function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" className="text-secondary/60" aria-hidden>
      <path d="m1 1 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
