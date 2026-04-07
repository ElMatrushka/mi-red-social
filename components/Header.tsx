"use client";

import { useState } from "react";
import SearchBar from "./SearchBar";

export default function Header() {
  const [openMobile, setOpenMobile] = useState(false);

  return (
    <>
      <header className="bg-white shadow-md fixed top-0 w-full z-50 h-14 flex items-center px-4 border-b border-gray-200">
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
          <div className="w-1/3 md:w-1/4">
            <h1 className="text-lg md:text-2xl font-bold text-[#1877F2] select-none truncate">comunidadApp</h1>
          </div>
          
          <div className="hidden md:block w-2/4 max-w-md">
            <SearchBar />
          </div>

          <div className="w-2/3 md:w-1/4 flex justify-end items-center gap-2">
            <button onClick={() => setOpenMobile(true)} className="md:hidden text-gray-500 hover:bg-gray-100 rounded-full p-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Popup Móvil */}
      {openMobile && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-start justify-center pt-20 px-4 md:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-3 border-b">
              <SearchBar onClose={() => setOpenMobile(false)} />
            </div>
            <div onClick={() => setOpenMobile(false)} className="p-4 text-center text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
              Cerrar
            </div>
          </div>
        </div>
      )}
    </>
  );
}
