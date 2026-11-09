'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-3xl font-bold">Something went wrong.</h1>
      <p className="mt-2 max-w-sm text-ink-3">We hit an unexpected error. Your funds and orders are safe. Try again.</p>
      <button onClick={reset} className="btn btn-primary mt-6">Try again</button>
    </div>
  );
}
