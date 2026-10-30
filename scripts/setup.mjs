// Creates tables and the first admin. Usage:
//   node --env-file=.env scripts/setup.mjs <username> <password> "<Display Name>"
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const [username, password, name = username] = process.argv.slice(2);
if (!username || !password) {
  console.error('Usage: node --env-file=.env scripts/setup.mjs <username> <password> "<Name>"');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`create table if not exists users (
  id serial primary key,
  name text not null,
  username text not null unique,
  password_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
)`;
await sql`create table if not exists games (
  id serial primary key,
  name text not null,
  host_id int not null references users(id),
  rounds int not null default 0,
  created_at timestamptz not null default now(),
  ended_at timestamptz
)`;
await sql`create table if not exists game_players (
  game_id int not null references games(id) on delete cascade,
  user_id int not null references users(id),
  cashout numeric(12,2),
  primary key (game_id, user_id)
)`;
await sql`create table if not exists buyins (
  id serial primary key,
  game_id int not null references games(id) on delete cascade,
  user_id int not null references users(id),
  amount numeric(12,2) not null check (amount > 0),
  added_by int not null references users(id),
  created_at timestamptz not null default now()
)`;

await sql`insert into users (name, username, password_hash, is_admin)
  values (${name}, ${username.toLowerCase()}, ${await bcrypt.hash(password, 10)}, true)
  on conflict (username) do update set password_hash = excluded.password_hash, is_admin = true`;

console.log(`Ready. Admin "${username.toLowerCase()}" can log in.`);
