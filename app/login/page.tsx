"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [esRegistro, setEsRegistro] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mensajeError, setMensajeError] = useState("");

  const manejarAuth = async () => {
    setMensajeError("");

    if (esRegistro) {
      if (!username.trim() || !username.startsWith("@")) {
        setMensajeError("El usuario debe empezar con @");
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      
      if (error) {
        setMensajeError(error.message);
      } else if (data.user) {
        // Crear el perfil automaticamente con el mismo ID del usuario
        await supabase.from("perfiles").insert([
          { 
            id: data.user.id, 
            username: username, 
            // Truco magico: Creamos una imagen de perfil usando el nombre
            avatar_url: `https://ui-avatars.com/api/?name=${username}&background=1877F2&color=fff&bold=true&size=128` 
          }
        ]);
        router.push("/"); // Lo mandamos al inicio
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMensajeError(error.message);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-[#F0F2F5]">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-sm text-black">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {esRegistro ? "Crear Cuenta" : "Iniciar Sesion"}
        </h1>

        {mensajeError && (
          <p className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{mensajeError}</p>
        )}

        {esRegistro && (
          <input 
            type="text" 
            placeholder="@tu_usuario" 
            className="w-full p-2 border border-gray-300 rounded mb-4"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}

        <input 
          type="email" 
          placeholder="Tu correo electronico" 
          className="w-full p-2 border border-gray-300 rounded mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input 
          type="password" 
          placeholder="Tu contrasena (minimo 6 letras)" 
          className="w-full p-2 border border-gray-300 rounded mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && manejarAuth()}
        />

        <button 
          className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-2 px-4 rounded w-full cursor-pointer mb-4"
          onClick={manejarAuth}
        >
          {esRegistro ? "Registrarme" : "Entrar"}
        </button>

        <p className="text-sm text-center text-gray-600">
          {esRegistro ? "Ya tienes cuenta?" : "No tienes cuenta?"}{" "}
          <button onClick={() => setEsRegistro(!esRegistro)} className="text-[#1877F2] font-bold cursor-pointer">
            {esRegistro ? "Inicia sesion aqui" : "Registrate aqui"}
          </button>
        </p>
        
        <Link href="/" className="block text-center text-sm text-gray-500 mt-4 hover:underline">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}