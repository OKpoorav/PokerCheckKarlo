import { neon } from "@neondatabase/serverless";

// Created per call so builds don't need DATABASE_URL; neon() is just a cheap HTTP client factory.
export const db = () => neon(process.env.DATABASE_URL!);

export const money = (n: number) =>
  Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const signed = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(n)}`;
