"use client";

import Image from "next/image";
import { type ReactNode, useState } from "react";

export function LoginScene({
  form,
  startOpen,
}: {
  form: ReactNode;
  startOpen: boolean;
}) {
  const [revealed, setRevealed] = useState(startOpen);

  return (
    <div className={`login-scene ${revealed ? "is-revealed" : "is-intro"}`}>
      <div className="login-brand-pane">
        <div className="login-hero-logo">
          <span className="inline-flex items-center gap-3">
            <Image
              src="/logo-iit.png"
              alt="Inkubator IT"
              width={180}
              height={42}
              priority
              unoptimized
              className="h-10 w-auto mix-blend-screen"
            />
            <span className="border-white/25 border-l pl-3 font-semibold text-lg text-white tracking-tight">
              IITrack
            </span>
          </span>
        </div>

        <div className="login-hero-copy">
          <h1 className="login-hero-title">
            Satu Sistem
            <br />
            Kendali Penuh
          </h1>
          <p className="login-hero-tagline">
            Lacak progres, selaraskan tim, dan selesaikan project lebih cepat
            dalam satu workspace.
          </p>
          <button
            type="button"
            className="login-hero-start"
            onClick={() => setRevealed(true)}
            disabled={revealed}
            tabIndex={revealed ? -1 : 0}
          >
            <span>Mulai</span>
            <svg
              className="login-hero-start-icon size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>

        <p className="login-hero-foot">
          © {new Date().getFullYear()} Inkubator IT HMIF ITB
        </p>
      </div>

      <div className="login-form-panel" inert={revealed ? undefined : true}>
        <div className="login-form-inner">{form}</div>
      </div>
    </div>
  );
}
