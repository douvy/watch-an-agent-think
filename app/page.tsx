export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6">
      <p className="label mb-4">Interactive explainer</p>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight text-header-text">
        Watch an AI agent think
      </h1>
      <p className="max-w-xl text-center text-muted">
        Three agent runs on a scrubbable timeline — planning, tool calls,
        failure, recovery, context pressure.
      </p>
      <p className="mt-8 font-mono text-xs text-accent">
        scaffold ready — build day pending
      </p>
    </div>
  );
}
