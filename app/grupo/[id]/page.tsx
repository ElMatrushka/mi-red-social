// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { buscarGifs, traerTrending } from "@/lib/giphy";

export default function PaginaGrupo() {
  const params = useParams();
  const router = useRouter();
  const idGrupo = decodeURIComponent(String(params.id));

  const [nuevoPost, setNuevoPost] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  const [usuario, setUsuario] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [esMiembro, setEsMiembro] = useState(false);
  const [imagenPreview, setImagenPreview] = useState("");
  const [archivoASubir, setArchivoASubir] = useState<any>(null);

  const [mostrarBuscadorGif, setMostrarBuscadorGif] = useState(false);
  const [busquedaGif, setBusquedaGif] = useState("");
  const [resultadosGifs, setResultadosGifs] = useState<any[]>([]);
  const [cargandoGifs, setCargandoGifs] = useState(false);

  const [postsAbiertos, setPostsAbiertos] = useState<string[]>([]);
  const [textosComentarios, setTextosComentarios] = useState<any>({});
  const [listaComentarios, setListaComentarios] = useState<any>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [userVotes, setUserVotes] = useState<Map<string, number>>(new Map());
  const [postsExpandidos, setPostsExpandidos] = useState<Set<string>>(new Set());
  const [comentariosExpandidos, setComentariosExpandidos] = useState<Set<string>>(new Set());

  const [miRol, setMiRol] = useState<string>("miembro");

  // Sidebar
  const [misGrupos, setMisGrupos] = useState<any[]>([]);
  const [gruposRecomendados, setGruposRecomendados] = useState<any[]>([]);
  const [mostrarPopup, setMostrarPopup] = useState(false);

  // SISTEMA DE ROLES
  const [rolesEnGrupo, setRolesEnGrupo] = useState<Map<string, string>>(new Map());
  const [menuAdminAbierto, setMenuAdminAbierto] = useState<string | null>(null);
  const [mostrarMiembros, setMostrarMiembros] = useState(false);
  const [miembrosGrupo, setMiembrosGrupo] = useState<any[]>([]);
  const [cargandoMiembros, setCargandoMiembros] = useState(false);

  const puedeAdministrar = miRol === "admin" || miRol === "moderador";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuario(session?.user ?? null);
      if (session?.user) traerPerfil(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ?? null);
      if (session?.user) traerPerfil(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const traerPerfil = async (userId: string) => {
    const { data } = await supabase.from("perfiles").select("*").eq("id", userId).maybeSingle();
    setPerfil(data);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    traerPosts();
    comprobarMembresia();
    traerMisGrupos();
    traerRecomendados();
    traerRolesGrupo();
  }, [idGrupo]);

  const traerMisGrupos = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setMisGrupos([]); return; }
    const { data: membresias } = await supabase.from("miembros").select("grupo_nombre").eq("user_id", session.user.id);
    if (!membresias || membresias.length === 0) { setMisGrupos([]); return; }
    const nombresGrupos = membresias.map((m) => m.grupo_nombre);
    const { data: gruposData } = await supabase.from("grupos").select("*").in("nombre", nombresGrupos);
    if (gruposData) setMisGrupos(gruposData);
  };

  const traerRecomendados = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: misMembresias } = await supabase.from("miembros").select("grupo_nombre").eq("user_id", session?.user?.id || "");
    const nombresMisGrupos = new Set(misMembresias?.map((m) => m.grupo_nombre) || []);
    const { data: todosGrupos } = await supabase.from("grupos").select("*").limit(50);
    if (!todosGrupos) return;
    const gruposFiltrados = todosGrupos.filter((g) => !nombresMisGrupos.has(g.nombre));
    const conConteo = await Promise.all(
      gruposFiltrados.map(async (g) => {
        const { count } = await supabase.from("miembros").select("*", { count: "exact", head: true }).eq("grupo_nombre", g.nombre);
        return { ...g, miembros: count || 0 };
      })
    );
    conConteo.sort((a, b) => b.miembros - a.miembros);
    setGruposRecomendados(conConteo.slice(0, 5));
  };

  // TRAER ROLES DE TODOS LOS MIEMBROS DEL GRUPO
  const traerRolesGrupo = async () => {
    const { data } = await supabase.from("miembros").select("user_id, rol").eq("grupo_nombre", idGrupo);
    const mapa = new Map<string, string>();
    data?.forEach((m: any) => mapa.set(m.user_id, m.rol));
    setRolesEnGrupo(mapa);
  };

  const comprobarMembresia = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setEsMiembro(false);
      setMiRol("miembro");
      return;
    }
    const { data } = await supabase.from("miembros").select("rol").eq("user_id", session.user.id).eq("grupo_nombre", idGrupo).maybeSingle();
    if (data && data.rol) {
      setMiRol(data.rol);
      setEsMiembro(true);
    } else {
      setMiRol("miembro");
      setEsMiembro(false);
    }
  };

  const traerPosts = async () => {
    const { data: postsData } = await supabase.from("posts").select("*").eq("grupo_nombre", idGrupo).order("creado_en", { ascending: false });
    if (!postsData) return;
    const userIds = [...new Set(postsData.map((p: any) => p.user_id).filter(Boolean))];
    const { data: perfilesData } = await supabase.from("perfiles").select("id, avatar_url, username").in("id", userIds);
    const mapaPerfiles = new Map(perfilesData?.map((p: any) => [p.id, p]) || []);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const postIds = postsData.map((p: any) => p.id);
      const { data: todosLosLikes } = await supabase.from("likes_posts").select("post_id, user_id").in("post_id", postIds);
      const mapaLikesCount = new Map<string, number>();
      todosLosLikes?.forEach((l: any) => {
        mapaLikesCount.set(l.post_id, (mapaLikesCount.get(l.post_id) || 0) + 1);
      });
      const misLikes = new Set(todosLosLikes?.filter((l: any) => l.user_id === session.user.id).map((l: any) => l.post_id) || []);
      setLikedPosts(misLikes);
      setPosts(
        postsData.map((post: any) => ({
          ...post,
          autor_perfil: mapaPerfiles.get(post.user_id) || null,
          likes: mapaLikesCount.get(post.id) || 0,
        }))
      );
    } else {
      setPosts(
        postsData.map((post: any) => ({
          ...post,
          autor_perfil: mapaPerfiles.get(post.user_id) || null,
          likes: 0,
        }))
      );
    }
  };

  const seleccionarImagenPost = (e: any) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setImagenPreview(URL.createObjectURL(archivo));
    setArchivoASubir(archivo);
    setMostrarBuscadorGif(false);
  };

  const limpiarMultimedia = () => {
    setImagenPreview("");
    setArchivoASubir(null);
  };

  const handleBuscarGifs = async (query: string) => {
    if (!query.trim()) { handleTraerTrending(); return; }
    setCargandoGifs(true);
    try {
      const gifs = await buscarGifs(query);
      setResultadosGifs(gifs);
    } catch (error) {
      console.error(error);
    }
    setCargandoGifs(false);
  };

  const handleTraerTrending = async () => {
    setCargandoGifs(true);
    try {
      const gifs = await traerTrending();
      setResultadosGifs(gifs);
    } catch (error) {
      console.error(error);
    }
    setCargandoGifs(false);
  };

  const seleccionarGif = (url: string) => {
    setImagenPreview(url);
    setArchivoASubir(null);
    setMostrarBuscadorGif(false);
    setBusquedaGif("");
  };

  const publicarPost = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if ((!nuevoPost.trim() && !archivoASubir && !imagenPreview) || !session?.user || !esMiembro || !perfil) return;
    let urlImagen = imagenPreview;
    if (archivoASubir) {
      const nombreUnico = `${Date.now()}_${archivoASubir.name}`;
      const rutaArchivo = `${session.user.id}/${nombreUnico}`;
      const { error: errorSubida } = await supabase.storage.from("post-images").upload(rutaArchivo, archivoASubir, { upsert: false });
      if (errorSubida) { alert("Error al subir imagen"); return; }
      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(rutaArchivo);
      urlImagen = urlData.publicUrl;
    }
    await supabase.from("posts").insert([{
      grupo_nombre: idGrupo,
      mensaje: nuevoPost,
      user_id: session.user.id,
      autor_email: session.user.email,
      autor_username: perfil.username,
      imagen_url: urlImagen,
    }]);
    setNuevoPost("");
    limpiarMultimedia();
    traerPosts();
  };

  const toggleLikePost = async (postId: string) => {
    if (!usuario) return;
    if (likedPosts.has(postId)) {
      await supabase.from("likes_posts").delete().eq("post_id", postId).eq("user_id", usuario.id);
      setLikedPosts((prev) => { const n = new Set(prev); n.delete(postId); return n; });
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: p.likes - 1 } : p)));
    } else {
      await supabase.from("likes_posts").insert([{ post_id: postId, user_id: usuario.id }]);
      setLikedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: p.likes + 1 } : p)));
    }
  };

  // ELIMINAR POST: dueño O admin O moderador
  const eliminarPost = async (postId: string) => {
    if (!window.confirm("¿Eliminar este post?")) return;
    await supabase.from("likes_posts").delete().eq("post_id", postId);
    await supabase.from("comentarios").delete().eq("post_id", postId);
    await supabase.from("posts").delete().eq("id", postId);
    traerPosts();
  };

  const toggleComentarios = async (postId: string) => {
    let nuevosAbiertos: string[];
    if (postsAbiertos.includes(postId)) {
      nuevosAbiertos = postsAbiertos.filter((id) => id !== postId);
    } else {
      nuevosAbiertos = [...postsAbiertos, postId];
      await traerComentarios(postId);
    }
    setPostsAbiertos(nuevosAbiertos);
  };

  const traerComentarios = async (postId: string) => {
    const { data } = await supabase.from("comentarios").select("*").eq("post_id", postId).order("creado_en", { ascending: true });
    if (!data || data.length === 0) return;
    const userIds = [...new Set(data.map((c: any) => c.user_id).filter(Boolean))];
    const { data: perfilesData } = await supabase.from("perfiles").select("id, avatar_url, username").in("id", userIds);
    const mapaPerfiles = new Map(perfilesData?.map((p: any) => [p.id, p]) || []);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: todosLosVotos } = await supabase.from("votos_comentarios").select("comentario_id, tipo_voto, user_id").in("comentario_id", data.map((c: any) => c.id));
      const votosDelUsuario = new Map(todosLosVotos?.filter((v: any) => v.user_id === session.user.id).map((v: any) => [v.comentario_id, v.tipo_voto]) || []);
      setUserVotes(new Map([...userVotes, ...votosDelUsuario]));
      const mapaScores = new Map<string, number>();
      todosLosVotos?.forEach((v: any) => {
        mapaScores.set(v.comentario_id, (mapaScores.get(v.comentario_id) || 0) + v.tipo_voto);
      });
      const comentariosConScore = data.map((c: any) => ({
        ...c,
        autor_perfil: mapaPerfiles.get(c.user_id) || null,
        score: mapaScores.get(c.id) || 0,
        userVote: votosDelUsuario.get(c.id) || 0,
      }));
      comentariosConScore.sort((a, b) => b.score - a.score);
      const newState = { ...listaComentarios };
      newState[postId] = comentariosConScore;
      setListaComentarios(newState);
    } else {
      const newState = { ...listaComentarios };
      newState[postId] = data.map((c: any) => ({
        ...c,
        autor_perfil: mapaPerfiles.get(c.user_id) || null,
        score: 0,
        userVote: 0,
      }));
      setListaComentarios(newState);
    }
  };

  const publicarComentario = async (postId: string) => {
    const textoActual = textosComentarios[postId] || "";
    const { data: { session } } = await supabase.auth.getSession();
    if (textoActual.trim() === "" || !session?.user || !perfil) return;
    await supabase.from("comentarios").insert([{ post_id: postId, user_id: session.user.id, autor_username: perfil.username, mensaje: textoActual }]);
    const textosLimpios = { ...textosComentarios };
    textosLimpios[postId] = "";
    setTextosComentarios(textosLimpios);
    await traerComentarios(postId);
  };

  // ELIMINAR COMENTARIO: dueño O admin O moderador
  const eliminarComentario = async (comentarioId: string, postId: string) => {
    if (!window.confirm("¿Eliminar este comentario?")) return;
    await supabase.from("votos_comentarios").delete().eq("comentario_id", comentarioId);
    await supabase.from("comentarios").delete().eq("id", comentarioId);
    traerComentarios(postId);
  };

  const votarComentario = async (postId: string, comentarioId: string, tipo: 1 | -1) => {
    if (!usuario) return;
    const votoActual = userVotes.get(comentarioId) || 0;
    let cambioEnScore: number = tipo;
    if (votoActual === tipo) {
      await supabase.from("votos_comentarios").delete().eq("comentario_id", comentarioId).eq("user_id", usuario.id);
      cambioEnScore = -tipo;
    } else {
      await supabase.from("votos_comentarios").upsert({ comentario_id: comentarioId, user_id: usuario.id, tipo_voto: tipo }, { onConflict: "user_id,comentario_id" });
      if (votoActual !== 0) cambioEnScore = tipo * 2;
    }
    setUserVotes((prev) => new Map(prev).set(comentarioId, votoActual === tipo ? 0 : tipo));
    setListaComentarios((prevState) => {
      const newComments = { ...prevState };
      newComments[postId] = newComments[postId]
        .map((c: any) => (c.id === comentarioId ? { ...c, score: c.score + cambioEnScore, userVote: votoActual === tipo ? 0 : tipo } : c))
        .sort((a: any, b: any) => b.score - a.score);
      return newComments;
    });
  };

  // BANEAR USUARIO: lo saca del grupo (admin O moderador, nunca a sí mismo ni a otros admin)
  const banearUsuario = async (userId: string, username: string) => {
    const rolDelObjetivo = rolesEnGrupo.get(userId);
    if (rolDelObjetivo === "admin") { alert("No puedes banear al administrador."); return; }
    if (userId === usuario?.id) { alert("No puedes banearte a ti mismo."); return; }
    if (miRol === "moderador" && rolDelObjetivo === "moderador") { alert("Los moderadores no pueden banear a otros moderadores."); return; }
    if (!window.confirm(`¿Banear a @${username} del grupo? Tendrá que volver a unirse.`)) return;
    await supabase.from("miembros").delete().eq("user_id", userId).eq("grupo_nombre", idGrupo);
    setMenuAdminAbierto(null);
    traerRolesGrupo();
    traerPosts();
    if (mostrarMiembros) traerMiembrosGrupo();
  };

  // DAR MODERADOR: solo admin puede, solo a miembros normales
  const darModerador = async (userId: string, username: string) => {
    if (miRol !== "admin") return;
    const rolDelObjetivo = rolesEnGrupo.get(userId);
    if (rolDelObjetivo === "admin") { alert("No puedes modificar el rol del administrador."); return; }
    if (!window.confirm(`¿Dar rango de moderador a @${username}?`)) return;
    await supabase.from("miembros").update({ rol: "moderador" }).eq("user_id", userId).eq("grupo_nombre", idGrupo);
    setMenuAdminAbierto(null);
    traerRolesGrupo();
    if (mostrarMiembros) traerMiembrosGrupo();
  };

  // QUITAR MODERADOR: solo admin puede, devuelve a miembro normal
  const quitarModerador = async (userId: string, username: string) => {
    if (miRol !== "admin") return;
    if (!window.confirm(`¿Quitar rango de moderador a @${username}?`)) return;
    await supabase.from("miembros").update({ rol: "miembro" }).eq("user_id", userId).eq("grupo_nombre", idGrupo);
    setMenuAdminAbierto(null);
    traerRolesGrupo();
    if (mostrarMiembros) traerMiembrosGrupo();
  };

  // TRAER MIEMBROS DEL GRUPO (para el panel de miembros)
  const traerMiembrosGrupo = async () => {
    setCargandoMiembros(true);
    const { data } = await supabase.from("miembros").select("user_id, rol").eq("grupo_nombre", idGrupo);
    if (!data || data.length === 0) { setMiembrosGrupo([]); setCargandoMiembros(false); return; }
    const userIds = data.map((m) => m.user_id);
    const { data: perfilesData } = await supabase.from("perfiles").select("id, username, avatar_url").in("id", userIds);
    const mapaPerfiles = new Map(perfilesData?.map((p: any) => [p.id, p]) || []);
    const miembrosConPerfil = data.map((m: any) => ({ ...m, perfil: mapaPerfiles.get(m.user_id) || null }));
    miembrosConPerfil.sort((a, b) => {
      const orden = { admin: 0, moderador: 1, miembro: 2 };
      return (orden[a.rol] || 2) - (orden[b.rol] || 2);
    });
    setMiembrosGrupo(miembrosConPerfil);
    setCargandoMiembros(false);
  };

  const unirseGrupo = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from("miembros").insert([{ user_id: session.user.id, grupo_nombre: idGrupo, rol: "miembro" }]);
    setEsMiembro(true);
    comprobarMembresia();
    traerRolesGrupo();
    window.dispatchEvent(new CustomEvent("grupo-actualizado"));
  };

  const salirseGrupo = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    if (miRol === "admin") { alert("El administrador no puede salir. Transfiere el grupo primero."); return; }
    if (!window.confirm("¿Salirte del grupo?")) return;
    await supabase.from("miembros").delete().eq("user_id", session.user.id).eq("grupo_nombre", idGrupo);
    setEsMiembro(false);
    router.push("/");
  };

  const toggleTextoExpandido = (setter: any, id: string) => {
    setter((prev: Set<string>) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // ABRIR PANEL DE MIEMBROS
  const abrirMiembros = async () => {
    setMostrarMiembros(true);
    traerMiembrosGrupo();
  };

  // BADGE DE ROL
  const BadgeRol = ({ rol }: { rol: string }) => {
    if (rol === "admin") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">Admin</span>;
    if (rol === "moderador") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">Mod</span>;
    return null;
  };

  return (
    <main className="max-w-6xl mx-auto pt-6 px-4 flex gap-6">
      {/* SIDEBAR IZQUIERDO */}
      <aside className="w-[280px] shrink-0 hidden lg:block">
        <div className="fixed w-[280px]">
          {perfil ? (
            <div className="flex flex-col items-center p-4">
              <Link href="/configurar-perfil" className="group relative block">
                <img src={perfil.avatar_url} className="w-16 h-16 rounded-full border-2 border-white shadow-md group-hover:opacity-80 transition-opacity" alt="avatar" />
              </Link>
              <Link href="/configurar-perfil" className="font-semibold text-[15px] text-gray-800 truncate mt-2 hover:underline">{perfil.username}</Link>
              <BadgeRol rol={miRol} />
            </div>
          ) : (
            <Link href="/login" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors mb-1">
              <div className="w-9 h-9 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">?</div>
              <span className="font-medium text-[15px] text-[#1877F2]">Iniciar Sesion</span>
            </Link>
          )}
          <hr className="my-2 border-gray-300" />
          <ul>
            <li className="font-semibold text-gray-500 text-[13px] px-2 py-1 uppercase">Tus Grupos</li>
            {misGrupos.map((grupo) => (
              <li key={grupo.nombre}>
                <Link href={`/grupo/${grupo.nombre}`} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${grupo.nombre === idGrupo ? "bg-blue-50" : "hover:bg-gray-100"}`}>
                  <div className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-lg">G</div>
                  <span className="text-[15px] text-gray-800 font-medium truncate">{grupo.nombre}</span>
                </Link>
              </li>
            ))}
            <li>
              <button onClick={() => setMostrarPopup(true)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left">
                <div className="w-9 h-9 bg-gray-100 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center text-gray-500 text-xl">+</div>
                <span className="text-[15px] text-[#1877F2] font-medium">Crear nuevo grupo</span>
              </button>
            </li>
          </ul>
          {usuario ? (
            <button onClick={cerrarSesion} className="mt-4 text-sm text-gray-400 hover:text-red-500 cursor-pointer">Cerrar sesion</button>
          ) : null}
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 max-w-[600px] min-w-0">
        {/* HEADER MOBILE */}
        <div className="flex lg:hidden flex-col gap-3 mb-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex justify-between items-center">
            {perfil ? (
              <Link href="/configurar-perfil" className="flex items-center gap-2">
                <img src={perfil.avatar_url} className="w-9 h-9 rounded-full border border-gray-200" alt="avatar" />
                <span className="font-semibold text-sm text-gray-800 truncate max-w-[120px]">{perfil.username}</span>
                <BadgeRol rol={miRol} />
              </Link>
            ) : (
              <Link href="/login" className="text-[#1877F2] font-semibold text-sm flex items-center gap-1">Iniciar Sesion</Link>
            )}
            <div className="flex items-center gap-2">
              {usuario ? <button onClick={cerrarSesion} className="text-xs text-gray-400 hover:text-red-500 cursor-pointer">Salir</button> : null}
              <button onClick={() => setMostrarPopup(true)} className="bg-[#1877F2] text-white px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-[#166FE5]">Crear</button>
            </div>
          </div>
          {misGrupos.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex gap-2 overflow-x-auto">
              {misGrupos.map((grupo) => (
                <Link key={grupo.nombre} href={`/grupo/${grupo.nombre}`} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors truncate max-w-[150px] ${grupo.nombre === idGrupo ? "bg-[#1877F2] text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"}`}>{grupo.nombre}</Link>
              ))}
            </div>
          )}
        </div>

        {/* FORMULARIO DE PUBLICAR (solo miembros) */}
        {esMiembro && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex gap-3">
              <img src={perfil?.avatar_url || "https://ui-avatars.com/api/?name=U&background=1877F2&color=fff"} className="w-10 h-10 rounded-full shrink-0" alt="avatar" />
              <div className="flex-1">
                <textarea
                  className="w-full resize-none border border-gray-200 rounded-lg p-2 text-sm text-gray-700 placeholder-gray-500 focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  placeholder="Escribe algo en este grupo..."
                  rows={2}
                  value={nuevoPost}
                  onChange={(e) => setNuevoPost(e.target.value)}
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-2">
                    <label className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <input type="file" accept="image/png, image/jpeg, image/gif" className="hidden" onChange={seleccionarImagenPost} />
                    </label>
                    <button onClick={() => { setMostrarBuscadorGif(true); handleTraerTrending(); }} className="text-gray-400 hover:text-purple-500 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {imagenPreview && <button onClick={limpiarMultimedia} className="text-xs text-red-400 hover:text-red-600 cursor-pointer">Quitar</button>}
                    <button onClick={publicarPost} className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer">Publicar</button>
                  </div>
                </div>
                {imagenPreview && <div className="mt-2 relative inline-block"><img src={imagenPreview} className="max-h-40 rounded-lg border border-gray-100 object-contain" alt="Preview" /></div>}
              </div>
            </div>
          </div>
        )}

        {/* BOTONES UNIRSE / SALIRSE / MIEMBROS */}
        {!esMiembro ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4 text-center">
            <p className="text-gray-600 mb-3">No eres miembro de este grupo.</p>
            <button onClick={unirseGrupo} className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-6 py-2 rounded-lg font-medium cursor-pointer">Unirse al grupo</button>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              {puedeAdministrar && (
                <button onClick={abrirMiembros} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium cursor-pointer flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                  Miembros
                </button>
              )}
            </div>
            <button onClick={salirseGrupo} className="text-xs text-gray-400 hover:text-red-500 cursor-pointer">Salirse del grupo</button>
          </div>
        )}

        {/* LISTA DE POSTS */}
        <div className="flex flex-col gap-4">
          {posts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              <p className="text-lg font-medium mb-2">No hay posts en este grupo</p>
              <p className="text-sm">Sé el primero en publicar algo.</p>
            </div>
          ) : (
            posts.map((post) => {
              const esDuenoDelPost = post.user_id === usuario?.id;
              const rolDelAutor = rolesEnGrupo.get(post.user_id);
              const puedeBorrarPost = esDuenoDelPost || puedeAdministrar;
              const puedeModerarAutor = puedeAdministrar && !esDuenoDelPost && rolDelAutor !== "admin";
              const puedePromover = miRol === "admin" && !esDuenoDelPost && rolDelAutor !== "admin";

              return (
                <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  {/* HEADER DEL POST */}
                  <div className="flex items-center gap-3 mb-3">
                    <img src={post.autor_perfil?.avatar_url || "https://ui-avatars.com/api/?name=Anonimo&background=gray&color=fff"} className="w-10 h-10 rounded-full shrink-0" alt="avatar" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] text-gray-900 truncate">
                        {post.autor_perfil?.username || post.autor_username || "Anonimo"}
                        <BadgeRol rol={rolDelAutor || "miembro"} />
                        <span className="font-normal text-xs text-gray-500 ml-1">
                          {new Date(post.creado_en).toLocaleDateString()} - {new Date(post.creado_en).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                    </div>
                    {/* MENU DE ADMINISTRACION EN POST */}
                    {puedeModerarAutor && (
                      <div className="relative">
                        <button onClick={() => setMenuAdminAbierto(menuAdminAbierto === post.id ? null : post.id)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer text-lg font-bold">⋯</button>
                        {menuAdminAbierto === post.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 py-1 min-w-[180px]">
                            <button onClick={() => banearUsuario(post.user_id, post.autor_perfil?.username || post.autor_username)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                              Banear del grupo
                            </button>
                            {puedePromover && (
                              rolDelAutor === "moderador" ? (
                                <button onClick={() => quitarModerador(post.user_id, post.autor_perfil?.username || post.autor_username)} className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 cursor-pointer flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Quitar moderador
                                </button>
                              ) : (
                                <button onClick={() => darModerador(post.user_id, post.autor_perfil?.username || post.autor_username)} className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 cursor-pointer flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                  Dar moderador
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CONTENIDO DEL POST */}
                  <p className="text-[15px] text-gray-800 mb-3 leading-relaxed">
                    {post.mensaje?.length > 200 && !postsExpandidos.has(post.id) ? post.mensaje.substring(0, 200) + "... " : post.mensaje}
                    {post.mensaje?.length > 200 && !postsExpandidos.has(post.id) && (
                      <button onClick={() => toggleTextoExpandido(setPostsExpandidos, post.id)} className="text-[#1877F2] font-medium hover:underline text-sm">Ver más</button>
                    )}
                    {post.mensaje?.length > 200 && postsExpandidos.has(post.id) && (
                      <button onClick={() => toggleTextoExpandido(setPostsExpandidos, post.id)} className="text-[#1877F2] font-medium hover:underline text-sm ml-1">Ver menos</button>
                    )}
                  </p>
                  {post.imagen_url ? (
                    post.imagen_url.includes(".gif") ? (
                      <img src={post.imagen_url} className="w-full rounded-lg mb-3 border border-gray-100 object-contain bg-black/5" alt="GIF" />
                    ) : (
                      <img src={post.imagen_url} className="w-full rounded-lg mb-3 border border-gray-100" alt="Imagen del post" />
                    )
                  ) : null}

                  {/* ACCIONES DEL POST */}
                  <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-gray-500 text-sm">
                    <span onClick={() => toggleLikePost(post.id)} className={`px-3 py-1 rounded cursor-pointer flex items-center gap-1 transition-colors text-xs sm:text-sm ${likedPosts.has(post.id) ? "bg-blue-50 text-blue-600 font-bold" : "hover:bg-gray-100"}`}>
                      {likedPosts.has(post.id) ? "👍 Liked" : "👍 Like"} ({post.likes || 0})
                    </span>
                    <span onClick={() => toggleComentarios(post.id)} className={`px-3 py-1 rounded cursor-pointer text-xs sm:text-sm ${postsAbiertos.includes(post.id) ? "font-bold text-gray-900 bg-gray-100" : "hover:bg-gray-100"}`}>
                      💬 Comment {Array.isArray(listaComentarios[post.id]) && listaComentarios[post.id].length > 0 ? `(${listaComentarios[post.id].length})` : ""}
                    </span>
                    {puedeBorrarPost && (
                      <span onClick={() => eliminarPost(post.id)} className={`px-3 py-1 rounded cursor-pointer text-xs sm:text-sm ${esDuenoDelPost ? "hover:bg-red-100 hover:text-red-600 text-gray-400" : "hover:bg-orange-100 hover:text-orange-600 text-gray-400"}`}>
                        {esDuenoDelPost ? "Delete" : "🗑 Moderar"}
                      </span>
                    )}
                  </div>

                  {/* COMENTARIOS */}
                  {postsAbiertos.includes(post.id) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2 mb-4">
                        <img src={perfil?.avatar_url || "https://ui-avatars.com/api/?name=U&background=1877F2&color=fff"} className="w-8 h-8 rounded-full shrink-0" alt="avatar" />
                        <input
                          type="text"
                          maxLength={1000}
                          className="flex-1 bg-gray-100 rounded-full px-4 py-1.5 outline-none text-sm text-gray-700 placeholder-gray-500"
                          placeholder="Escribe un comentario..."
                          value={textosComentarios[post.id] || ""}
                          onChange={(e) => setTextosComentarios((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && publicarComentario(post.id)}
                        />
                      </div>
                      {Array.isArray(listaComentarios[post.id]) && listaComentarios[post.id].length > 0 && (
                        <div className="flex flex-col gap-3">
                          {listaComentarios[post.id].map((c: any) => {
                            const esDuenoDelComentario = c.user_id === usuario?.id;
                            const puedeBorrarComentario = esDuenoDelComentario || puedeAdministrar;
                            return (
                              <div key={c.id} className="flex gap-2 items-start">
                                <img src={c.autor_perfil?.avatar_url || "https://ui-avatars.com/api/?name=A&background=gray&color=fff"} className="w-8 h-8 rounded-full shrink-0 mt-0.5" alt="avatar" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <p className="font-semibold text-[13px] text-gray-800 truncate mr-2">
                                      {c.autor_perfil?.username || c.autor_username || "Anonimo"}
                                      <BadgeRol rol={rolesEnGrupo.get(c.user_id) || "miembro"} />
                                      <span className="font-normal text-[11px] text-gray-500">{new Date(c.creado_en).toLocaleDateString()}</span>
                                    </p>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button onClick={() => votarComentario(post.id, c.id, 1)} className={`hover:text-orange-500 transition-colors ${c.userVote === 1 ? "text-orange-500" : "text-gray-400"}`}>
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                                      </button>
                                      <span className={`text-[11px] font-bold ${c.userVote === 1 ? "text-orange-500" : c.userVote === -1 ? "text-blue-500" : "text-gray-500"}`}>{c.score || 0}</span>
                                      <button onClick={() => votarComentario(post.id, c.id, -1)} className={`hover:text-blue-500 transition-colors ${c.userVote === -1 ? "text-blue-500" : "text-gray-400"}`}>
                                        <svg className="w-4 h-4 rotate-180" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                                      </button>
                                      {puedeBorrarComentario && (
                                        <button onClick={() => eliminarComentario(c.id, post.id)} className={`ml-1 hover:text-red-500 transition-colors ${esDuenoDelComentario ? "text-gray-300" : "text-gray-300"}`} title="Eliminar comentario">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-[15px] text-gray-700 break-words">
                                    {c.mensaje?.length > 200 && !comentariosExpandidos.has(c.id) ? c.mensaje.substring(0, 200) + "... " : c.mensaje}
                                    {c.mensaje?.length > 200 && !comentariosExpandidos.has(c.id) && (
                                      <button onClick={() => toggleTextoExpandido(setComentariosExpandidos, c.id)} className="text-[#1877F2] text-sm font-medium hover:underline">Ver más</button>
                                    )}
                                    {c.mensaje?.length > 200 && comentariosExpandidos.has(c.id) && (
                                      <button onClick={() => toggleTextoExpandido(setComentariosExpandidos, c.id)} className="text-[#1877F2] text-sm font-medium hover:underline ml-1">Ver menos</button>
                                    )}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SIDEBAR DERECHO */}
      <aside className="w-[280px] shrink-0 hidden lg:block">
        <div className="fixed w-[280px]">
          <div className="p-2"><h2 className="font-semibold text-gray-500 text-[13px] px-2 py-1 uppercase">Grupos Recomendados</h2></div>
          <ul>
            {gruposRecomendados.length === 0 && <li className="px-4 py-1 text-sm text-gray-400 italic">No hay grupos aún.</li>}
            {gruposRecomendados.map((grupo) => (
              <li key={grupo.nombre}>
                <Link href={`/grupo/${grupo.nombre}`} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-gray-500">
                    {grupo.thumbnail_url ? <img src={grupo.thumbnail_url} className="w-full h-full object-cover" alt="" /> : <span className="text-xl font-bold">{grupo.nombre.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <span className="text-[15px] text-gray-800 font-medium truncate block">{grupo.nombre}</span>
                    <span className="text-xs text-gray-500 block truncate mt-0.5">{grupo.descripcion || "Sin descripción"}</span>
                    <span className="text-xs text-gray-400 block mt-1">{grupo.miembros} miembros</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* MODAL BUSCADOR GIF */}
      {mostrarBuscadorGif && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setMostrarBuscadorGif(false)}>
          <div className="bg-white rounded-xl shadow-2xl text-black w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex gap-3 bg-white">
              <button onClick={() => setMostrarBuscadorGif(false)} className="text-gray-500 hover:text-black font-bold text-xl cursor-pointer">✕</button>
              <input type="text" className="flex-1 bg-gray-100 rounded-full px-4 py-2 outline-none text-sm text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-purple-500" placeholder="Buscar GIFs..." value={busquedaGif} onChange={(e) => setBusquedaGif(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleBuscarGifs(busquedaGif)} autoFocus />
              <button onClick={() => handleBuscarGifs(busquedaGif)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-full font-medium text-sm cursor-pointer">Buscar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {cargandoGifs ? (
                <div className="flex items-center justify-center h-full text-gray-500 font-medium">Cargando GIFs...</div>
              ) : resultadosGifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500"><p className="text-lg font-bold mb-2">Sin resultados</p><p className="text-sm">Prueba buscando &quot;feliz&quot; o &quot;gato&quot;</p></div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {resultadosGifs.map((gif) => (
                    <div key={gif.id} onClick={() => seleccionarGif(gif.url)} className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 hover:scale-105 transition-transform border border-gray-200 bg-white">
                      <img src={gif.preview} alt="GIF" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PANEL DE MIEMBROS */}
      {mostrarMiembros && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setMostrarMiembros(false)}>
          <div className="bg-white rounded-xl shadow-2xl text-black w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-gray-900">Miembros del grupo</h2>
              <button onClick={() => setMostrarMiembros(false)} className="text-gray-500 hover:text-black font-bold text-xl cursor-pointer">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cargandoMiembros ? (
                <div className="flex items-center justify-center py-8 text-gray-500 font-medium">Cargando...</div>
              ) : miembrosGrupo.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay miembros.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {miembrosGrupo.map((m: any) => {
                    const esYo = m.user_id === usuario?.id;
                    const rol = m.rol;
                    return (
                      <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50">
                        <img src={m.perfil?.avatar_url || "https://ui-avatars.com/api/?name=U&background=gray&color=fff"} className="w-9 h-9 rounded-full shrink-0" alt="avatar" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {m.perfil?.username || "Desconocido"}
                            {esYo && <span className="text-[11px] text-gray-400 ml-1">(vos)</span>}
                          </p>
                          <BadgeRol rol={rol} />
                        </div>
                        {/* ACCIONES SOLO PARA ADMIN */}
                        {miRol === "admin" && !esYo && rol !== "admin" && (
                          <div className="flex gap-1 shrink-0">
                            {rol === "moderador" ? (
                              <button onClick={() => quitarModerador(m.user_id, m.perfil?.username)} className="text-[11px] text-orange-600 hover:bg-orange-50 px-2 py-1 rounded cursor-pointer font-medium">Quitar Mod</button>
                            ) : (
                              <button onClick={() => darModerador(m.user_id, m.perfil?.username)} className="text-[11px] text-green-600 hover:bg-green-50 px-2 py-1 rounded cursor-pointer font-medium">Dar Mod</button>
                            )}
                            <button onClick={() => banearUsuario(m.user_id, m.perfil?.username)} className="text-[11px] text-red-600 hover:bg-red-50 px-2 py-1 rounded cursor-pointer font-medium">Banear</button>
                          </div>
                        )}
                        {/* ACCIONES PARA MODERADOR */}
                        {miRol === "moderador" && !esYo && rol === "miembro" && (
                          <button onClick={() => banearUsuario(m.user_id, m.perfil?.username)} className="text-[11px] text-red-600 hover:bg-red-50 px-2 py-1 rounded cursor-pointer font-medium shrink-0">Banear</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
