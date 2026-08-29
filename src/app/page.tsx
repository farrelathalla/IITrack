"use client";

import Image from "next/image";
import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="relative min-h-screen grid place-items-center overflow-hidden">
      {/* Background gradient + subtle stripes */}
      <div className="absolute inset-0 -z-20 bg-gradient-to-br via-[#0b0a0f] from-[#3f2b72] to-[#f5a524]" />
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 14px)",
        }}
      />
      <div className="text-center text-white">
        {/* Logos */}
        <div className="flex items-center justify-center gap-12 my-10">
          <a
            href="https://nextjs.org"
            target="_blank"
            className="transition-transform hover:scale-110"
            rel="noreferrer"
          >
            <Image
              src="/next-white.svg"
              className="logo drop-shadow-lg"
              width={96}
              height={96}
              alt="Next.js logo"
            />
          </a>
          <a
            href="https://github.com/Inkubator-IT"
            target="_blank"
            className="transition-transform hover:scale-110"
            rel="noreferrer"
          >
            <Image
              src="/logo-iit.png"
              alt="Inkubator IT"
              className="h-16 w-auto drop-shadow-[0_6px_30px_rgba(0,0,0,0.35)]"
              width={100}
              height={100}
            />
          </a>
        </div>
        <h1 className="mt-4 text-4xl font-bold">Inkubator IT — Next.js</h1>
        <p className="mt-2 text-sm text-gray-200">
          Kickstart your frontend with Next.js, Tailwind, and Bun.
        </p>

        {/* Card */}
        <div className="mt-8 inline-flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-6">
          <button
            type="button"
            className="rounded-xl border border-white/20 px-5 py-2 text-base font-medium text-white shadow-sm transition hover:bg-white/10 active:scale-95 bg-white/5 backdrop-blur"
            onClick={() => setCount((c: number) => c + 1)}
          >
            count is <span className="font-semibold">{count}</span>
          </button>

          <p className="text-sm text-gray-200">
            Edit <code className="font-mono">src/app/page.tsx</code> and save to
            test HMR
          </p>
        </div>

        {/* Links */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
          <a
            href="https://github.com/Inkubator-IT"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-left transition hover:shadow-sm"
          >
            <div>
              <p className="font-medium">Inkubator IT on GitHub</p>
              <p className="text-xs text-gray-200">
                Templates, tooling, and examples
              </p>
            </div>
          </a>
          <a
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-left transition hover:shadow-sm"
          >
            <p className="font-medium">Next.js Docs</p>
            <p className="text-xs text-gray-200">Fast dev server and build</p>
          </a>
          <a
            href="https://tailwindcss.com/docs"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-left transition hover:shadow-sm"
          >
            <p className="font-medium">Tailwind CSS</p>
            <p className="text-xs text-gray-200">Utility-first styling</p>
          </a>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-sm text-gray-300">
          Click on the logos to learn more • Built by Inkubator IT
        </p>
      </div>
    </div>
  );
}

export default App;
