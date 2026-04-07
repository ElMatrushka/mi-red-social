"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function SearchBar({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data: misMembresias } = await supabase.from("miembros").select("grupo_nombre").eq("user_id", session?.user?.id || "");
    const nombresMisGrupos = new Set(misMembresias?.map(m => m.grupo_nombre) || []);

    const { data } = await supabase.from("grupos").select("*").ilike("nombre", `%${query}%`).limit(6);
    if (data) {
      const enriquecidos = await Promise.all(data.map(async (g) => {
        const { count } = await supabase.from("miembros").select("*", { count: 'exact', head: true }).eq("grupo_nombre", g.nombre);
        return { ...g, miembros: count || 0, yaEsMiembro: nombresMisGrupos.has(g.nombre) };
      }));
      setResults(enriquecidos);
    }
    setLoading(false);
    setIsOpen(true);
  };

  const unirse = async (nombre: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from("miembros").insert([{ user_id: session.user.id, grupo_nombre: nombre }]);
    setResults(prev => prev.map(g => g.nombre === nombre ? {...g, yaEsMiembro: true, miembros: g.miembros + 1} : g));
    window.dispatchEvent(new CustomEvent('grupo-actualizado'));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="bg-[#F0F2F5] rounded-full px-4 py-2 flex items-center gap-2 w-full">
        <svg className="w-4 h-4 text-gray-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path></svg>
        <input 
          type="text" 
          placeholder="Buscar comunidades..." 
          className="bg-transparent outline-none w-full text-sm text-gray-700 placeholder-gray-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl w-full max-h-[400px] overflow-y-auto z-50">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">No se encontraron comunidades.</div>
          ) : (
            results.map((grupo) => (
              <div key={grupo.nombre} className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                {/* IMAGEN Y NOMBRE AHORA SON UN LINK PARA VER EL GRUPO DIRECTAMENTE */}
                <Link href={`/grupo/${grupo.nombre}`} onClick={() => { setIsOpen(false); if(onClose) onClose(); }} className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-gray-400">
                  {grupo.thumbnail_url ? (
                    <img src={grupo.thumbnail_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-lg font-bold">{grupo.nombre.charAt(0).toUpperCase()}</span>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/grupo/${grupo.nombre}`} onClick={() => { setIsOpen(false); if(onClose) onClose(); }} className="font-semibold text-sm text-gray-900 truncate hover:underline block">{grupo.nombre}</Link>
                  <p className="text-xs text-gray-500 truncate">{grupo.descripcion || "Sin descripción"} • {grupo.miembros} miembros</p>
                </div>
                
                {/* BOTÓN LATERAL */}
                {grupo.yaEsMiembro ? (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full shrink-0">
                    Miembro
                  </span>
                ) : (
                  <button onClick={() => unirse(grupo.nombre)} className="text-xs font-bold text-[#1877F2] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full shrink-0">
                    Unirse
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
