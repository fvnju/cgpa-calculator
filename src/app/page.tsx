import Link from "next/link";

import { LatestPost } from "~/app/_components/post";
import { RainbowButton } from "~/components/magicui/rainbow-button";
import Logo from "~/components/Logo";
import { api, HydrateClient } from "~/trpc/server";
import { LineShadowText } from "~/components/magicui/line-shadow-text";
import { ShimmerButton } from "~/components/magicui/shimmer-button";
import { Suspense } from "react";
import { AnimatedShinyText } from "~/components/magicui/animated-shiny-text";
import { cn } from "~/lib/utils";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#121212] text-white">
        <div className="flex h-16 w-full items-center border-b-2 border-[#37474F]/20 px-12">
          <Logo />
        </div>
        <div className="flex w-full flex-grow flex-col items-center justify-center px-12 py-6">
          <div className="flex flex-col gap-4">
            <div className="z-10 flex">
              <div
                className={cn(
                  "group rounded-full border border-white/5 bg-neutral-900 text-base transition-all ease-in hover:cursor-pointer hover:bg-neutral-800",
                )}
              >
                <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
                  <span>✨ Still in Beta</span>
                </AnimatedShinyText>
              </div>
            </div>
            <h1 className="text-balance text-center text-5xl font-semibold leading-none tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl">
              Calculate Your{" "}
              <Suspense
                fallback={<span className="italic text-[#ffff00]">CGPA</span>}
              >
                <LineShadowText
                  className="italic text-[#ffff00]"
                  shadowColor={"white"}
                >
                  CGPA.
                </LineShadowText>
              </Suspense>
            </h1>
          </div>

          <Link href={"/cgpa"} className="btn-glitch-fill group mt-10">
            <span className="text">// Get Started</span>
            <span className="text-decoration"> _</span>
            <span className="decoration">⇒</span>
          </Link>
        </div>
      </main>
    </HydrateClient>
  );
}
