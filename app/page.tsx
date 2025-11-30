export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-purple-600 to-pink-500 py-24 text-center text-white">
        <div className="mx-auto max-w-4xl px-4">
          <h1 className="text-5xl font-bold">Bring Your Ideas to Life</h1>
          <p className="mt-6 text-xl text-purple-100">
            IndieCrowdfund is home to creative projects in art, design, film, games, music, and more. Back a project or start your own today.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <a
              href="/discover"
              className="rounded-lg bg-white px-6 py-3 font-semibold text-purple-600 hover:bg-purple-50"
            >
              Discover Projects
            </a>
            <a
              href="/start"
              className="rounded-lg border-2 border-white px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              Start a Project
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
