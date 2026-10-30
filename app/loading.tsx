// Every page reads per-user data, so each navigation shows this instantly while the page streams in.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-[70dvh] flex-col items-center justify-center gap-5">
      <span className="chip-loader size-16" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-secondary">Shuffling</span>
    </div>
  );
}
