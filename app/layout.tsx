import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Red Social",
  description: "Comunidades mejoradas",
};

// Componente de búsqueda embebido para no romper el Server Component
function SearchBar() {
  return <SearchBarClient />;
}

import SearchBarClient from "@/components/SearchBar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light">
      <body className="bg-white antialiased text-gray-900">
        <header className="bg-white shadow-md fixed top-0 w-full z-50 h-14 flex items-center px-4 border-b border-gray-200">
          <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
            <div className="w-1/3 md:w-1/4">
              <h1 className="text-lg md:text-2xl font-bold text-[#1877F2] select-none truncate">comunidadApp</h1>
            </div>
            
            {/* BARRA DE BÚSQUEDA FUNCIONAL */}
            <div className="hidden md:block w-2/4 max-w-md relative">
              <SearchBar />
            </div>

            <div className="w-2/3 md:w-1/4 flex justify-end items-center gap-2">
              {/* Botón buscar para móviles (abre popup) */}
              <MobileSearchButton />
            </div>
          </div>
        </header>
        
        <div className="pt-14 min-h-screen bg-[#F0F2F5]">
          {children}
        </div>
      </body>
    </html>
  );
}

// Componente auxiliar para el botón de móvil
function MobileSearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="md:hidden text-gray-500 hover:bg-gray-100 rounded-full p-2">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path></svg>
      </button>
      {open && <MobileSearchPopup onClose={() => setOpen(false)} />}
    </>
  );
}

// Componente auxiliar para el popup de móvil
function MobileSearchPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-start justify-center pt-20 px-4 md:hidden">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="p-3 border-b flex items-center gap-2">
          <SearchBar onClose={onClose} />
        </div>
        <div onClick={onClose} className="p-4 text-center text-sm text-gray-500 cursor-pointer">
          Cerrar
        </div>
      </div>
    </div>
  );
}

// Fix para useState en layout
import { useState } from "react";
