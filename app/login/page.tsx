import Image from "next/image";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { login } from "../actions";
import { ActionForm, Submit } from "../ui";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <div className="flex min-h-[85dvh] flex-col justify-center">
      <div className="rise mb-8 flex flex-col items-center text-center">
        <Image src="/logo.jpg" alt="" width={112} height={112} priority className="mb-6 rounded-[30px] shadow-[0_20px_60px_rgba(31,122,77,0.45)] ring-1 ring-tint/50" />
        <h1 className="font-display text-[40px] font-extrabold tracking-tight">Poker Tally</h1>
        <p className="mt-1 tracking-[0.3em] text-secondary">♠ <span className="text-red">♥</span> ♣ <span className="text-red">♦</span></p>
        <p className="mt-2 text-secondary">Take your seat at the table</p>
      </div>
      <ActionForm action={login} className="rise space-y-3 [animation-delay:80ms]">
        <input name="username" placeholder="Username" autoCapitalize="none" autoComplete="username" required className="field" />
        <input name="password" type="password" placeholder="Password" autoComplete="current-password" required className="field" />
        <Submit>Sign In</Submit>
      </ActionForm>
      <p className="mt-6 text-center text-[13px] text-secondary">Accounts are created by your admin.</p>
    </div>
  );
}
