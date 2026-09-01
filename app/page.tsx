export default function Home() {
  return (
    <main>
      {['Hero', 'Services', 'Move as One', 'Guarantees', 'Testimonials', 'CTA'].map(
        (name) => (
          <section
            key={name}
            className="flex h-screen items-center justify-center"
          >
            <h2 className="text-4xl font-semibold">{name}</h2>
          </section>
        ),
      )}
    </main>
  );
}
