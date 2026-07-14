import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zaytouna Bistro Loyalty",
  description: "Digital loyalty card for Zaytouna Bistro guests.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Zaytouna Loyalty",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#b1c553",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
