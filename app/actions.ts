"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { endSession, requireAdmin, requireUser, startSession } from "@/lib/auth";

const amountOf = (v: FormDataEntryValue | null) => {
  const n = Math.round(Number(v) * 100) / 100;
  return Number.isFinite(n) ? n : NaN;
};

// Loads a game plus the caller's role in it; throws if the caller isn't allowed in.
async function gameFor(gameId: number) {
  const user = await requireUser();
  const [g] = await db()`
    select g.host_id, g.ended_at,
      exists(select 1 from game_players where game_id = g.id and user_id = ${user.id}) as is_player
    from games g where g.id = ${gameId}`;
  if (!g || !(g.is_player || user.is_admin)) throw new Error("Not in this session");
  const isHost = g.host_id === user.id;
  // RBAC: players log their own buy-ins and count rounds; the host runs their table; admins can manage any session.
  return { user, isHost, live: !g.ended_at, isPlayer: g.is_player as boolean, canManage: isHost || user.is_admin, isAdmin: user.is_admin };
}

export async function login(_: string | null, form: FormData) {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [u] = await db()`select id, password_hash from users where username = ${username}`;
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return "Wrong username or password";
  await startSession(u.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

const USERNAME = /^[a-z0-9_.]{2,30}$/;

export async function updateProfile(_: string | null, form: FormData) {
  const me = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  if (!name || !USERNAME.test(username)) return "Enter a name and a username (letters, numbers, _ .)";
  const rows = await db()`
    update users set name = ${name}, username = ${username}
    where id = ${me.id} and not exists(select 1 from users where username = ${username} and id <> ${me.id})
    returning id`;
  if (!rows.length) return "That username is taken";
  refresh();
  return null;
}

export async function changePassword(_: string | null, form: FormData) {
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 4) return "New password must be at least 4 characters";
  if (next !== form.get("confirm")) return "New passwords don't match";
  const sql = db();
  const [u] = await sql`select password_hash from users where id = ${me.id}`;
  if (!(await bcrypt.compare(current, u.password_hash))) return "Current password is wrong";
  await sql`update users set password_hash = ${await bcrypt.hash(next, 10)} where id = ${me.id}`;
  return null;
}

export async function createUser(_: string | null, form: FormData) {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name || !USERNAME.test(username)) return "Enter a name and a username (letters, numbers, _ .)";
  if (password.length < 4) return "Password must be at least 4 characters";
  const rows = await db()`
    insert into users (name, username, password_hash, is_admin)
    values (${name}, ${username}, ${await bcrypt.hash(password, 10)}, ${form.get("is_admin") === "on"})
    on conflict (username) do nothing returning id`;
  if (!rows.length) return "That username is taken";
  refresh();
  return null;
}

export async function resetPassword(userId: number, form: FormData) {
  await requireAdmin();
  const password = String(form.get("password") ?? "");
  if (password.length < 4) return;
  await db()`update users set password_hash = ${await bcrypt.hash(password, 10)} where id = ${userId}`;
  refresh();
}

export async function createGame(form: FormData) {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim() ||
    new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const ids = [...new Set([user.id, ...form.getAll("players").map(Number).filter(Number.isInteger)])];
  const sql = db();
  const [g] = await sql`insert into games (name, host_id) values (${name}, ${user.id}) returning id`;
  await sql`insert into game_players (game_id, user_id)
    select ${g.id}, id from users where id = any(${ids}) on conflict do nothing`;
  redirect(`/s/${g.id}`);
}

export async function addPlayer(gameId: number, form: FormData) {
  const { canManage, live } = await gameFor(gameId);
  if (!canManage || !live) return;
  await db()`insert into game_players (game_id, user_id) values (${gameId}, ${Number(form.get("user_id"))}) on conflict do nothing`;
  refresh();
}

// Only players with no buy-ins can be removed, so money is never silently dropped.
export async function removePlayer(gameId: number, userId: number) {
  const { canManage, live } = await gameFor(gameId);
  if (!canManage || !live) return;
  await db()`delete from game_players where game_id = ${gameId} and user_id = ${userId}
    and user_id <> (select host_id from games where id = ${gameId})
    and not exists(select 1 from buyins where game_id = ${gameId} and user_id = ${userId})`;
  refresh();
}

export async function addBuyIn(gameId: number, _: string | null, form: FormData) {
  const { user, canManage, live } = await gameFor(gameId);
  if (!live) return "Session is settled";
  const amount = amountOf(form.get("amount"));
  if (!(amount > 0)) return "Enter an amount";
  // Players log their own buy-ins; host/admin can log for anyone at the table.
  const target = canManage ? Number(form.get("user_id") ?? user.id) : user.id;
  const rows = await db()`
    insert into buyins (game_id, user_id, amount, added_by)
    select ${gameId}, ${target}, ${amount}, ${user.id}
    where exists(select 1 from game_players where game_id = ${gameId} and user_id = ${target})
    returning id`;
  if (!rows.length) return "Not a player in this session";
  refresh();
  return null;
}

export async function deleteBuyIn(gameId: number, buyinId: number) {
  const { canManage, live } = await gameFor(gameId);
  if (!canManage || !live) return;
  await db()`delete from buyins where id = ${buyinId} and game_id = ${gameId}`;
  refresh();
}

export async function bumpRound(gameId: number, delta: 1 | -1) {
  const { isPlayer, isAdmin } = await gameFor(gameId);
  if (!isPlayer && !isAdmin) return;
  await db()`update games set rounds = greatest(rounds + ${delta}, 0) where id = ${gameId} and ended_at is null`;
  refresh();
}

export async function settle(gameId: number, _: string | null, form: FormData) {
  const { canManage, live } = await gameFor(gameId);
  if (!canManage) return "Only the host can enter cashouts";
  if (!live) return "Already settled";
  const sql = db();
  const players = await sql`select user_id from game_players where game_id = ${gameId}`;
  const cashouts = players.map((p) => ({ id: p.user_id as number, amount: amountOf(form.get(`cashout_${p.user_id}`) || "0") }));
  if (cashouts.some((c) => !(c.amount >= 0))) return "Cashouts must be 0 or more";
  await sql.transaction([
    ...cashouts.map((c) => sql`update game_players set cashout = ${c.amount} where game_id = ${gameId} and user_id = ${c.id}`),
    sql`update games set ended_at = now() where id = ${gameId}`,
  ]);
  refresh();
  return null;
}

// Admin only: reopen a settled session to correct buy-ins/cashouts, then settle again.
export async function reopenGame(gameId: number) {
  await requireAdmin();
  await db()`update games set ended_at = null where id = ${gameId}`;
  refresh();
}

export async function renameGame(gameId: number, form: FormData) {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return;
  await db()`update games set name = ${name} where id = ${gameId}`;
  refresh();
}

export async function deleteGame(gameId: number) {
  await requireAdmin();
  await db()`delete from games where id = ${gameId}`;
  redirect("/admin");
}
