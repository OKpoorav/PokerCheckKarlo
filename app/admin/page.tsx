import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUser, resetPassword } from "../actions";
import { ActionForm, Header, SessionList, Submit } from "../ui";

export default async function Admin() {
  await requireAdmin();
  const sql = db();
  const [users, games] = await Promise.all([
    sql`select id, name, username, is_admin from users order by name`,
    sql`select g.id, g.name, g.rounds, g.created_at::text, g.ended_at is null as live,
          (select count(*) from game_players where game_id = g.id)::int as players,
          coalesce((select sum(amount) from buyins where game_id = g.id), 0)::float8 as pot
        from games g order by g.ended_at is not null, g.created_at desc`,
  ]);

  return (
    <>
      <Header title="Admin" back="/" />

      <h2 className="section-title">Add member</h2>
      <ActionForm action={createUser} className="rise card space-y-3 p-4">
        <input name="name" placeholder="Name" required className="field" />
        <input name="username" placeholder="Username" autoCapitalize="none" required className="field" />
        <input name="password" placeholder="Password" required minLength={4} className="field" />
        <label className="flex items-center justify-between px-1 py-1">
          Admin
          <input type="checkbox" name="is_admin" className="size-5 accent-[var(--tint)]" />
        </label>
        <Submit>Add Member</Submit>
      </ActionForm>

      <h2 className="section-title">{users.length} members</h2>
      <div className="card rise [animation-delay:80ms]">
        {users.map((u) => (
          <details key={u.id} className="group border-b border-sep last:border-b-0">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2.5">
              <div className="flex-1">
                <p>{u.name} {u.is_admin && <span className="ml-1 rounded-md bg-fill px-1.5 py-0.5 text-[11px] text-secondary">ADMIN</span>}</p>
                <p className="text-[13px] text-secondary">@{u.username}</p>
              </div>
              <span className="text-[15px] text-tint">Reset</span>
            </summary>
            <form action={resetPassword.bind(null, u.id)} className="flex gap-2 px-4 pb-3">
              <input name="password" placeholder="New password" minLength={4} required className="field py-2" />
              <Submit className="btn w-auto py-2 text-[15px]">Save</Submit>
            </form>
          </details>
        ))}
      </div>

      <h2 className="section-title">All sessions ({games.length})</h2>
      <p className="-mt-1 px-2 pb-2 text-[13px] text-secondary">Open one to edit, reopen or delete it. Amounts shown are the pot.</p>
      <SessionList
        showPot
        sessions={games.map((g) => ({ id: g.id, name: g.name, created_at: g.created_at, rounds: g.rounds, players: g.players, net: g.pot, live: g.live }))}
      />
    </>
  );
}
