import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "GradeGuru",
  description: "Calculate your semester CGPA on a 5.0 scale.",
  icons: [{ rel: "icon", url: "/logomark.svg" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} text-white`}>
      <body className="max-h-dvh overflow-hidden overscroll-none">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
