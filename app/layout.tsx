import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Mi Red Social",
  description: "Comunidades mejoradas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light">
      <body className="bg-white antialiased text-gray-900">
        <Header />
        <div className="pt-14 min-h-screen bg-[#F0F2F5]">
          {children}
        </div>
      </body>
    </html>
  );
}
