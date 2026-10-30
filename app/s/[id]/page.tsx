import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, money, signed } from "@/lib/db";
import { addBuyIn, addPlayer, deleteBuyIn, settle } from "../../actions";
import { ActionForm, AmountChips, AutoRefresh, Chip, Header, Picker, RoundMeter, SettleForm, Submit } from "../../ui";

const tone = (n: number) => (n > 0 ? "text-green" : n < 0 ? "text-red" : "text-secondary");

export default async function SessionPage({ params }: PageProps<"/s/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const me = await requireUser();
  const sql = db();

  const [[game], players, buyins, others] = await Promise.all([
    sql`select g.*, u.name as host_name from games g join users u on u.id = g.host_id where g.id = ${id}`,
    sql`select u.id, u.name, gp.cashout::float8 as cashout,
          coalesce((select sum(amount) from buyins where game_id = ${id} and user_id = u.id), 0)::float8 as bought
        from game_players gp join users u on u.id = gp.user_id
        where gp.game_id = ${id} order by u.name`,
    sql`select b.id, b.amount::float8 as amount, b.created_at, u.name, a.name as added_by
        from buyins b join users u on u.id = b.user_id join users a on a.id = b.added_by
        where b.game_id = ${id} order by b.created_at desc`,
    sql`select id, name from users where id not in (select user_id from game_players where game_id = ${id}) order by name`,
  ]);
  const isPlayer = players.some((p) => p.id === me.id);
  if (!game || !(isPlayer || me.is_admin)) notFound();

  const live = !game.ended_at;
  const isHost = game.host_id === me.id;
  const pot = players.reduce((s, p) => s + p.bought, 0);
  const myBought = players.find((p) => p.id === me.id)?.bought ?? 0;

  return (
    <>
      {live && <AutoRefresh />}
      <Header title={game.name} back="/">
        <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${live ? "bg-green/15 text-green" : "bg-fill text-secondary"}`}>
          {live ? "● Live" : "Settled"}
        </span>
      </Header>
      <p className="rise text-[15px] text-secondary">
        Hosted by {isHost ? "you" : game.host_name} · Pot <span className="font-semibold text-label tabular-nums">{money(pot)}</span>
      </p>

      <RoundMeter gameId={id} rounds={game.rounds} canTap={live && isPlayer} />

      {live && isPlayer && (
        <>
          <h2 className="section-title">Add buy-in</h2>
          <ActionForm action={addBuyIn.bind(null, id)} className="rise card relative z-20 space-y-3 overflow-visible p-4">
            {isHost ? (
              <Picker
                name="user_id"
                label="Buy-in for"
                defaultValue={me.id}
                options={players.map((p) => ({ id: p.id, name: p.name, note: p.id === me.id ? "(you)" : `in ${money(p.bought)}` }))}
              />
            ) : (
              <p className="text-[15px] text-secondary">You&apos;re in for <span className="font-semibold text-label">{money(myBought)}</span> so far</p>
            )}
            <AmountChips target="amount" />
            <div className="flex gap-2">
              <input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Amount" required className="field tabular-nums" />
              <Submit className="btn w-auto px-6">Add</Submit>
            </div>
          </ActionForm>
        </>
      )}

      <h2 className="section-title">Players</h2>
      <div className="card rise">
        {players.map((p) => {
          const net = (p.cashout ?? 0) - p.bought;
          return (
            <div key={p.id} className="row">
              <Chip id={p.id} name={p.name} />
              <div className="flex-1">
                <p className={p.id === me.id ? "font-semibold" : ""}>{p.name}{p.id === game.host_id && <span className="ml-1.5 text-[13px] text-secondary">host</span>}</p>
                <p className="text-[13px] text-secondary tabular-nums">
                  In {money(p.bought)}{!live && ` · Out ${money(p.cashout ?? 0)}`}
                </p>
              </div>
              {!live && <span className={`font-semibold tabular-nums ${tone(net)}`}>{signed(net)}</span>}
            </div>
          );
        })}
      </div>

      {live && isHost && others.length > 0 && (
        <form action={addPlayer.bind(null, id)} className="mt-3 flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-card">
            <Picker name="user_id" label="Seat a player" options={others.map((u) => ({ id: u.id, name: u.name }))} />
          </div>
          <Submit className="btn w-auto whitespace-nowrap px-5">Add Player</Submit>
        </form>
      )}

      {buyins.length > 0 && (
        <details className="rise mt-1">
          <summary className="section-title cursor-pointer list-none">Buy-in log ({buyins.length}) ›</summary>
          <div className="card">
            {buyins.map((b) => (
              <div key={b.id} className="row">
                <div className="flex-1">
                  <p>{b.name} <span className="font-semibold tabular-nums">{money(b.amount)}</span></p>
                  <p className="text-[13px] text-secondary">
                    {new Date(b.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                    {b.added_by !== b.name && ` · by ${b.added_by}`}
                  </p>
                </div>
                {live && isHost && (
                  <form action={deleteBuyIn.bind(null, id, b.id)}>
                    <button className="press text-[15px] text-red">Remove</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {live && isHost && (
        <>
          <h2 className="section-title">Final cashouts</h2>
          <SettleForm action={settle.bind(null, id)} players={players.map((p) => ({ id: p.id, name: p.name, bought: p.bought }))} pot={pot} />
        </>
      )}
      {live && !isHost && (
        <p className="px-4 pt-6 text-center text-[13px] text-secondary">{game.host_name} will enter final cashouts when the game ends.</p>
      )}
    </>
  );
}
