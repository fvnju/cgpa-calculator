import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Menu } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#ff6d5a] max-h-dvh overflow-hidden overscroll-none">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-5 sm:px-10">
        <button
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center text-white/90 transition-colors hover:text-white"
        >
          <Menu className="h-6 w-6" strokeWidth={2.5} />
        </button>

        {/* Center logo */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 2.33333V25.6667M22.2496 5.75042L5.75046 22.2496M25.6667 14H2.33337M22.2496 22.2496L5.75046 5.75042"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        {/* Try the app link */}
        <Link
          href="/app"
          className="flex items-center gap-1.5 text-sm font-medium tracking-wide text-white/90 transition-colors hover:text-white"
        >
          Try the app
          <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </nav>

      {/* Hero image container */}
      <div className="relative flex w-full flex-1 px-0">
        <div className="relative flex-1 overflow-hidden rounded-b-[2.5rem] sm:rounded-b-[3.5rem]">
          <Image
            src="https://images.pexels.com/photos/9572362/pexels-photo-9572362.jpeg"
            alt="Students studying together"
            fill
            priority
            className="object-cover"
          />
          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />

          {/* Hero headline */}
          <div className="absolute inset-x-0 bottom-12 flex flex-col items-center px-6 sm:bottom-16 md:bottom-20">
            <h1 className="text-center font-[family-name:var(--font-geist-sans)] text-4xl font-bold leading-[1.05] tracking-tight text-[#f5f1eb] sm:text-6xl md:text-7xl lg:text-8xl">
              Know your grade.
              <br />
              Own your future.
            </h1>
          </div>
        </div>
      </div>

      {/* Subtitle section on accent background */}
      <div className="flex items-center justify-center px-6 py-8 sm:py-10">
        <p className="text-center font-[family-name:var(--font-geist-sans)] text-sm font-medium tracking-wide text-white/90 sm:text-base">
          Calculate your CGPA on a 5.0 scale. Visual. Instant. Free.
        </p>
      </div>
    </main>
  );
}
