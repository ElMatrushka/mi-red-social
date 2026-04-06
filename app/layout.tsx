import type { Metadata } from "next";
import "./globals.css";

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
    // Forzamos el modo claro con "light" para evitar que el sistema operativo lo ponga negro
    <html lang="es" className="light">
      <body className="bg-white antialiased text-gray-900">
        {/* BARRA SUPERIOR ESTILO FACEBOOK */}
        <header className="bg-white shadow-md fixed top-0 w-full z-50 h-14 flex items-center px-4 border-b border-gray-200">
          <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
            
            {/* Lado Izquierdo: Logo */}
            <div className="w-1/4">
              <h1 className="text-2xl font-bold text-[#1877F2] select-none">comunidadApp</h1>
            </div>

            {/* Lado Central: Barra de Busqueda */}
            <div className="w-2/4 max-w-md">
              <div className="bg-[#F0F2F5] rounded-full px-4 py-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path></svg>
                <input type="text" placeholder="Buscar en comunidadApp" className="bg-transparent outline-none w-full text-sm text-gray-700 placeholder-gray-500" />
              </div>
            </div>

            {/* Lado Derecho: Perfil de usuario */}
            <div className="w-1/4 flex justify-end">
              {/* Aqui se inyectara el usuario desde las paginas */}
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