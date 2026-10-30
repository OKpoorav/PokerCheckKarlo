import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createGame } from "../actions";
import { Chip, Header, Submit } from "../ui";

export default async function NewSession() {
  const me = await requireUser();
  const users = await db()`select id, name from users where id <> ${me.id} order by name`;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <>
      <Header title="New Session" back="/" />
      <form action={createGame} className="rise">
        <h2 className="section-title">Name</h2>
        <input name="name" placeholder={today} className="field" />

        <h2 className="section-title">Who&apos;s playing</h2>
        <div className="card">
          <div className="row"><Chip id={me.id} name={me.name} /><span className="flex-1">{me.name}</span><span className="text-[13px] text-tint">Host</span></div>
          {users.map((u) => (
            <label key={u.id} className="row press cursor-pointer">
              <Chip id={u.id} name={u.name} />
              <span className="flex-1">{u.name}</span>
              <input type="checkbox" name="players" value={u.id} className="size-5 accent-[var(--tint)]" />
            </label>
          ))}
        </div>
        <p className="px-4 pt-2 text-[13px] text-secondary">You can add more players later. Only you can enter final cashouts.</p>
        <div className="mt-6"><Submit>Start Session</Submit></div>
      </form>
    </>
  );
}
