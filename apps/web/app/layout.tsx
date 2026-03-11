import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Linux Playground",
  description: "Web-based Linux playground with isolated containers"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const runtime = {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
    apiWsUrl: process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:8080"
  };

  return (
    <html lang="en">
      <body>
        <script
          // Runtime env for client components; avoids build-time NEXT_PUBLIC inlining.
          dangerouslySetInnerHTML={{
            __html: `window.__linuxpg=${JSON.stringify(runtime)};`
          }}
        />
        <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
      </body>
    </html>
  );
}
