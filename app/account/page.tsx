import { requireUser } from "@/lib/auth";
import { changePassword, logout, updateProfile } from "../actions";
import { ActionForm, Header, Submit } from "../ui";

export default async function Account() {
  const me = await requireUser();

  return (
    <>
      <Header title="Account" back="/" />

      <h2 className="section-title">Profile</h2>
      <ActionForm action={updateProfile} ok="Saved" className="rise card space-y-3 p-4">
        <input name="name" defaultValue={me.name} placeholder="Name" required className="field" />
        <input name="username" defaultValue={me.username} placeholder="Username" autoCapitalize="none" autoComplete="username" required className="field" />
        <Submit>Save</Submit>
      </ActionForm>

      <h2 className="section-title">Password</h2>
      <ActionForm action={changePassword} ok="Password changed" className="rise card space-y-3 p-4 [animation-delay:60ms]">
        <input name="current" type="password" placeholder="Current password" autoComplete="current-password" required className="field" />
        <input name="next" type="password" placeholder="New password" autoComplete="new-password" required minLength={4} className="field" />
        <input name="confirm" type="password" placeholder="Confirm new password" autoComplete="new-password" required minLength={4} className="field" />
        <Submit>Change Password</Submit>
      </ActionForm>

      <form action={logout} className="rise mt-8 [animation-delay:120ms]">
        <button className="press w-full rounded-xl bg-card px-4 py-3.5 text-[17px] font-medium text-red">Sign Out</button>
      </form>
    </>
  );
}
