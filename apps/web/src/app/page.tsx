export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6efe1_0%,#fff9ef_55%,#fffdf8_100%)] px-6 py-16 text-stone-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.28em] text-stone-500">
            our-adventures
          </p>
          <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-stone-950">
            Step 3 scaffold complete.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-stone-700">
            This Next.js app now owns both the UI and server-side route surface
            for the project.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-950">Included</h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              App Router, Tailwind, Auth.js route stub, database client stub,
              query directory, and placeholder API handlers for activities,
              completion, picker, and profile endpoints.
            </p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-stone-950 p-6 text-stone-100 shadow-sm">
            <h2 className="text-lg font-semibold">Next steps</h2>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              Step 4 adds the repo-level database contract under <code>db/</code>
              , then the app can start wiring real queries and auth behavior.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
