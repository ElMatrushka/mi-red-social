"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ConfigurarPerfil() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [imagenPreview, setImagenPreview] = useState("");
  const [archivoASubir, setArchivoASubir] = useState<any>(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push("/login");
        return;
      }
      setUsuario(session.user);
      traerPerfil(session.user.id);
    });
  }, []);

  const traerPerfil = async (userId: string) => {
    const { data } = await supabase.from("perfiles").select("*").eq("id", userId).maybeSingle();
    if (data) {
      setPerfil(data);
      setUsername(data.username);
      setImagenPreview(data.avatar_url);
    }
  };

  const seleccionarImagen = (e: any) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    // Mostrar vista previa local
    setImagenPreview(URL.createObjectURL(archivo));
    setArchivoASubir(archivo);
  };

  const guardarCambios = async () => {
    if (!usuario) return;
    setMensaje("");

    // 1. Si hay una imagen nueva, la subimos a Supabase Storage
    let urlFinal = perfil?.avatar_url;

    if (archivoASubir) {
      // Ponemos el archivo en una carpeta con su ID de usuario. upsert:true sobreescribe si ya existe
      const rutaArchivo = `${usuario.id}/avatar.jpg`;
      
      const { error: errorSubida } = await supabase.storage
        .from("avatars")
        .upload(rutaArchivo, archivoASubir, { upsert: true });

      if (errorSubida) {
        setMensaje("Error al subir imagen: " + errorSubida.message);
        return;
      }

      // Obtenemos la URL publica de la imagen que acabamos de subir
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(rutaArchivo);
      
      // FIX: Agregamos ?t= para engañar al navegador y que no use la imagen vieja guardada en caché
      urlFinal = `${urlData.publicUrl}?t=${Date.now()}`;
    }

    // 2. Actualizamos la base de datos con el nuevo username y la nueva URL de la imagen
    const { error: errorUpdate } = await supabase
      .from("perfiles")
      .update({ username: username, avatar_url: urlFinal })
      .eq("id", usuario.id);

    if (errorUpdate) {
      setMensaje("Error al guardar: " + errorUpdate.message);
    } else {
      setMensaje("Perfil actualizado correctamente!");
      setArchivoASubir(null); // Limpiamos el archivo temporal
      // Forzamos recarga de la pagina para que el sidebar del layout cambie la foto al instante
      window.location.reload();
    }
  };

  if (!usuario || !perfil) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F0F2F5]">
        <p className="text-gray-500">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto mt-20 p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Configurar Perfil</h1>
          <Link href="/" className="text-[#1877F2] font-medium hover:underline">Volver al inicio</Link>
        </div>

        {mensaje && (
          <p className={`p-3 rounded mb-6 text-sm ${mensaje.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {mensaje}
          </p>
        )}

        {/* ZONA DE LA FOTO DE PERFIL */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group mb-4">
            <img 
              src={imagenPreview} 
              className="w-32 h-32 rounded-full object-cover border-4 border-gray-200" 
              alt="Avatar Preview"
            />
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <span className="text-white font-medium text-sm">Cambiar</span>
            </div>
            <input 
              type="file" 
              accept="image/png, image/jpeg" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={seleccionarImagen}
            />
          </div>
          <p className="text-sm text-gray-500">Haz clic en la foto para cambiarla (JPG o PNG)</p>
        </div>

        {/* ZONA DEL USERNAME */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de usuario</label>
          <input 
            type="text" 
            className="w-full p-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@tu_usuario"
          />
        </div>

        {/* ZONA DEL CORREO (Solo lectura) */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">Correo electronico (Privado)</label>
          <input 
            type="email" 
            className="w-full p-3 border border-gray-100 rounded-md text-gray-500 bg-gray-50 cursor-not-allowed"
            value={usuario.email}
            readOnly
          />
          <p className="text-xs text-gray-400 mt-1">El correo no se puede cambiar y no se muestra al publico.</p>
        </div>

        <button 
          onClick={guardarCambios}
          className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-3 px-6 rounded-md w-full cursor-pointer"
        >
          Guardar Cambios
        </button>
      </div>
    </main>
  );
}
