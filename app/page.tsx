"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function Home() {
  const [mostrarPopup, setMostrarPopup] = useState(false);
  const [creandoGrupo, setCreandoGrupo] = useState(false);
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [descripcionGrupo, setDescripcionGrupo] = useState("");
  const [archivoMiniatura, setArchivoMiniatura] = useState<any>(null);
  const [previewMiniatura, setPreviewMiniatura] = useState("");
  
  const [misGrupos, setMisGrupos] = useState<any[]>([]);
  const [gruposRecomendados, setGruposRecomendados] = useState<any[]>([]); // NUEVO ESTADO
  
  const [usuario, setUsuario] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  
  const [postsAbiertos, setPostsAbiertos] = useState<string[]>([]);
  const [textosComentarios, setTextosComentarios] = useState<any>({});
  const [listaComentarios, setListaComentarios] = useState<any>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [userVotes, setUserVotes] = useState<Map<string, number>>(new Map());
  const [postsExpandidos, setPostsExpandidos] = useState<Set<string>>(new Set());
  const [comentariosExpandidos, setComentariosExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    traerMisGrupos(); traerFeed(); traerRecomendados(); // NUEVO
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ?? null);
      if (session?.user) { traerPerfil(session.user.id); traerMisGrupos(); traerRecomendados(); } else { setPerfil(null); setMisGrupos([]); setGruposRecomendados([]); }
      traerFeed(); 
    });
    supabase.auth.getSession().then(({ data: { session } }) => { if (session?.user) { traerPerfil(session.user.id); traerMisGrupos(); traerRecomendados(); } });
    const handleUpdate = () => { traerMisGrupos(); traerFeed(); traerRecomendados(); }; // NUEVO
    window.addEventListener('grupo-actualizado', handleUpdate);
    return () => { subscription.unsubscribe(); window.removeEventListener('grupo-actualizado', handleUpdate); };
  }, []);

  const traerPerfil = async (userId: string) => { const { data } = await supabase.from("perfiles").select("*").eq("id", userId).maybeSingle(); setPerfil(data); };
  
  const traerMisGrupos = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setMisGrupos([]); return; }
    const { data: membresias } = await supabase.from("miembros").select("grupo_nombre").eq("user_id", session.user.id);
    if (!membresias || membresias.length === 0) { setMisGrupos([]); return; }
    const nombresGrupos = membresias.map(m => m.grupo_nombre);
    const { data: gruposData } = await supabase.from("grupos").select("*").in("nombre", nombresGrupos);
    if (gruposData) setMisGrupos(gruposData);
  };

  // NUEVA FUNCIÓN: TRAE LOS GRUPOS CON MÁS MIEMBROS
  const traerRecomendados = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // 1. Sacar los grupos del usuario actual para no mostrarlos
    const { data: misMembresias } = await supabase.from("miembros").select("grupo_nombre").eq("user_id", session?.user?.id || "");
    const nombresMisGrupos = new Set(misMembresias?.map(m => m.grupo_nombre) || []);

    // 2. Traer una muestra de grupos (limit 50 para no sobrecargar)
    const { data: todosGrupos } = await supabase.from("grupos").select("*").limit(50);
    if (!todosGrupos) return;

    // 3. Filtrar los que no son del usuario y contar sus miembros
    const gruposFiltrados = todosGrupos.filter(g => !nombresMisGrupos.has(g.nombre));
    
    const conConteo = await Promise.all(
      gruposFiltrados.map(async (g) => {
        const { count } = await supabase.from("miembros").select("*", { count: 'exact', head: true }).eq("grupo_nombre", g.nombre);
        return { ...g, miembros: count || 0 };
      })
    );

    // 4. Ordenar de mayor a menor y quedarse con los top 5
    conConteo.sort((a, b) => b.miembros - a.miembros);
    setGruposRecomendados(conConteo.slice(0, 5));
  };

  const traerFeed = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setFeedPosts([]); return; }
    const { data: misGruposData } = await supabase.from("miembros").select("grupo_nombre").eq("user_id", session.user.id);
    if (!misGruposData || misGruposData.length === 0) { setFeedPosts([]); return; }
    const nombresGrupos = misGruposData.map(g => g.grupo_nombre);
    const { data: postsData } = await supabase.from("posts").select("*").in("grupo_nombre", nombresGrupos).order("creado_en", { ascending: false });
    if (!postsData) return;
    const userIds = [...new Set(postsData.map((p: any) => p.user_id).filter(Boolean))];
    const { data: perfilesData } = await supabase.from("perfiles").select("id, avatar_url, username").in("id", userIds);
    const mapaPerfiles = new Map(perfilesData?.map((p: any) => [p.id, p]) || []);
    const postIds = postsData.map((p: any) => p.id);
    const { data: todosLosLikes } = await supabase.from("likes_posts").select("post_id, user_id").in("post_id", postIds);
    const mapaLikesCount = new Map<string, number>();
    todosLosLikes?.forEach((l: any) => { mapaLikesCount.set(l.post_id, (mapaLikesCount.get(l.post_id) || 0) + 1); });
    const misLikes = new Set(todosLosLikes?.filter((l: any) => l.user_id === session.user.id).map((l: any) => l.post_id) || []);
    setLikedPosts(misLikes);
    setFeedPosts(postsData.map((post: any) => ({ ...post, autor_perfil: mapaPerfiles.get(post.user_id) || null, likes: mapaLikesCount.get(post.id) || 0 })));
  };

  const limpiarPopup = () => { setNombreGrupo(""); setDescripcionGrupo(""); setArchivoMiniatura(null); setPreviewMiniatura(""); };

  const crearGrupo = async () => {
    if (nombreGrupo.trim() === "" || creandoGrupo) return;
    setCreandoGrupo(true);
    let thumbnailUrl = null;
    if (archivoMiniatura) {
      const ext = archivoMiniatura.name.split('.').pop();
      const path = `grupo-thumbnails/${nombreGrupo.replace(/\s/g, '_')}_${Date.now()}.${ext}`;
      const { error: errorSubida } = await supabase.storage.from("grupo-thumbnails").upload(path, archivoMiniatura);
      if (!errorSubida) { const { data: urlData } = supabase.storage.from("grupo-thumbnails").getPublicUrl(path); thumbnailUrl = urlData.publicUrl; }
    }
    await supabase.from("grupos").insert([{ nombre: nombreGrupo, descripcion: descripcionGrupo, thumbnail_url: thumbnailUrl }]);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await supabase.from("miembros").insert([{ user_id: session.user.id, grupo_nombre: nombreGrupo }]);
    setCreandoGrupo(false); limpiarPopup(); setMostrarPopup(false); traerMisGrupos(); traerFeed(); traerRecomendados(); // NUEVO
  };

  const cerrarSesion = async () => { await supabase.auth.signOut(); };

  const toggleLikePost = async (postId: string) => {
    if (!usuario) return;
    if (likedPosts.has(postId)) {
      await supabase.from("likes_posts").delete().eq("post_id", postId).eq("user_id", usuario.id);
      setLikedPosts(prev => { const n = new Set(prev); n.delete(postId); return n; });
      setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes - 1 } : p));
    } else {
      await supabase.from("likes_posts").insert([{ post_id: postId, user_id: usuario.id }]);
      setLikedPosts(prev => new Set(prev).add(postId));
      setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
    }
  };

  const eliminarPost = async (postId: string) => { if (!window.confirm("Are you sure?")) return; await supabase.from("posts").delete().eq("id", postId); traerFeed(); };

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
      todosLosVotos?.forEach((v: any) => { mapaScores.set(v.comentario_id, (mapaScores.get(v.comentario_id) || 0) + v.tipo_voto); });
      const comentariosConScore = data.map((c: any) => ({ ...c, autor_perfil: mapaPerfiles.get(c.user_id) || null, score: mapaScores.get(c.id) || 0, userVote: votosDelUsuario.get(c.id) || 0 }));
      comentariosConScore.sort((a, b) => b.score - a.score);
      const newState = { ...listaComentarios }; newState[postId] = comentariosConScore; setListaComentarios(newState);
    } else {
      const newState = { ...listaComentarios }; newState[postId] = data.map((c: any) => ({ ...c, autor_perfil: mapaPerfiles.get(c.user_id) || null, score: 0, userVote: 0 })); setListaComentarios(newState);
    }
  };

  const toggleComentarios = async (postId: string) => {
    let nuevosAbiertos: string[];
    if (postsAbiertos.includes(postId)) { nuevosAbiertos = postsAbiertos.filter(id => id !== postId); } 
    else { nuevosAbiertos = [...postsAbiertos, postId]; await traerComentarios(postId); }
    setPostsAbiertos(nuevosAbiertos);
  };

  const publicarComentario = async (postId: string) => {
    const textoActual = textosComentarios[postId] || "";
    const { data: { session } } = await supabase.auth.getSession();
    if (textoActual.trim() === "" || !session?.user || !perfil) return;
    await supabase.from("comentarios").insert([{ post_id: postId, user_id: session.user.id, autor_username: perfil.username, mensaje: textoActual }]);
    const textosLimpios = { ...textosComentarios }; textosLimpios[postId] = ""; setTextosComentarios(textosLimpios);
    await traerComentarios(postId);
  };

  const votarComentario = async (postId: string, comentarioId: string, tipo: 1 | -1) => {
    if (!usuario) return;
    const votoActual = userVotes.get(comentarioId) || 0;
    let cambioEnScore = tipo;
    if (votoActual === tipo) { await supabase.from("votos_comentarios").delete().eq("comentario_id", comentarioId).eq("user_id", usuario.id); cambioEnScore = -tipo; }
    else { await supabase.from("votos_comentarios").upsert({ comentario_id: comentarioId, user_id: usuario.id, tipo_voto: tipo }, { onConflict: 'user_id,comentario_id' }); if (votoActual !== 0) cambioEnScore = tipo * 2; }
    setUserVotes(prev => new Map(prev).set(comentarioId, votoActual === tipo ? 0 : tipo));
    setListaComentarios(prevState => { const newComments = { ...prevState }; newComments[postId] = newComments[postId].map((c: any) => c.id === comentarioId ? { ...c, score: c.score + cambioEnScore, userVote: votoActual === tipo ? 0 : tipo } : c).sort((a: any, b: any) => b.score - a.score); return newComments; });
  };

  const toggleTextoExpandido = (setter: any, id: string) => { setter((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };

  return (
    <main className="max-w-6xl mx-auto pt-6 px-4 flex gap-6 justify-center">
      
      {/* SIDEBAR IZQUIERDO: MIS GRUPOS */}
      <aside className="w-[280px] shrink-0 hidden lg:block">
        <div className="fixed w-[280px]">
          {perfil ? (
            <div className="flex flex-col items-center p-4">
              <Link href="/configurar-perfil" className="group relative block"><img src={perfil.avatar_url} className="w-16 h-16 rounded-full border-2 border-white shadow-md group-hover:opacity-80 transition-opacity" alt="avatar"/></Link>
              <Link href="/configurar-perfil" className="font-semibold text-[15px] text-gray-800 truncate mt-2 hover:underline">{perfil.username}</Link>
            </div>
          ) : (<Link href="/login" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors mb-1"><div className="w-9 h-9 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">?</div><span className="font-medium text-[15px] text-[#1877F2]">Iniciar Sesion</span></Link>)}
          <hr className="my-2 border-gray-300" />
          <ul>
            <li className="font-semibold text-gray-500 text-[13px] px-2 py-1 uppercase">Mis Grupos</li>
            {misGrupos.length === 0 && <li className="px-2 py-1 text-sm text-gray-400 italic">Sin grupos todavía</li>}
            {misGrupos.map((grupo) => (
              <li key={grupo.nombre}><Link href={`/grupo/${grupo.nombre}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-9 h-9 bg-gray-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-gray-500">{grupo.thumbnail_url ? <img src={grupo.thumbnail_url} className="w-full h-full object-cover"/> : <span className="text-lg">G</span>}</div>
                <span className="text-[15px] text-gray-800 font-medium truncate">{grupo.nombre}</span>
              </Link></li>
            ))}
            <li><button onClick={() => setMostrarPopup(true)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left"><div className="w-9 h-9 bg-gray-100 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center text-gray-500 text-xl">+</div><span className="text-[15px] text-[#1877F2] font-medium">Crear nuevo grupo</span></button></li>
          </ul>
          {usuario ? (<button onClick={cerrarSesion} className="mt-4 text-sm text-gray-400 hover:text-red-500 cursor-pointer">Cerrar sesion</button>) : null}
        </div>
      </aside>

      {/* FEED CENTRAL */}
      <div className="flex-1 max-w-[600px] min-w-0">
        <div className="flex lg:hidden flex-col gap-3 mb-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex justify-between items-center">
            {perfil ? (<Link href="/configurar-perfil" className="flex items-center gap-2"><img src={perfil.avatar_url} className="w-9 h-9 rounded-full border border-gray-200" alt="avatar"/><span className="font-semibold text-sm text-gray-800 truncate max-w-[120px]">{perfil.username}</span></Link>) : (<Link href="/login" className="text-[#1877F2] font-semibold text-sm flex items-center gap-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>Iniciar Sesion</Link>)}
            <div className="flex items-center gap-2">
              {usuario ? (<button onClick={cerrarSesion} className="text-xs text-gray-400 hover:text-red-500 cursor-pointer">Salir</button>) : null}
              <button onClick={() => setMostrarPopup(true)} className="bg-[#1877F2] text-white px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-[#166FE5]">Crear</button>
            </div>
          </div>
          {misGrupos.length > 0 && (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex gap-2 overflow-x-auto">{misGrupos.map((grupo) => (<Link key={grupo.nombre} href={`/grupo/${grupo.nombre}`} className="flex-shrink-0 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-800 hover:bg-gray-200 transition-colors truncate max-w-[150px]">{grupo.nombre}</Link>))}</div>)}
        </div>

        <div className="flex flex-col gap-4">
          {feedPosts.length === 0 ? (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500"><p className="text-lg font-medium mb-2">Tu inicio está vacío</p><p className="text-sm">Usa la barra de búsqueda de arriba para encontrar comunidades y unirte a ellas.</p></div>) : (feedPosts.map((post) => (
            <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3"><img src={post.autor_perfil?.avatar_url || "https://ui-avatars.com/api/?name=A&background=gray&color=fff"} className="w-10 h-10 rounded-full shrink-0" alt="avatar"/><div className="flex-1 min-w-0"><p className="font-semibold text-[15px] text-gray-900 truncate">{post.autor_perfil?.username || post.autor_username || "Anonimo"} <span className="font-normal text-xs text-gray-500 ml-1"><Link href={`/grupo/${post.grupo_nombre}`} className="font-semibold text-[#1877F2] hover:underline">{decodeURIComponent(post.grupo_nombre)}</Link> - {new Date(post.creado_en).toLocaleDateString()}</span></p></div></div>
              <p className="text-[15px] text-gray-800 mb-3 leading-relaxed">{(post.mensaje?.length > 200 && !postsExpandidos.has(post.id)) ? <>{post.mensaje.substring(0, 200)}... <button onClick={() => toggleTextoExpandido(setPostsExpandidos, post.id)} className="text-[#1877F2] font-medium hover:underline text-sm">Ver más</button></> : post.mensaje}{(post.mensaje?.length > 200 && postsExpandidos.has(post.id)) && <button onClick={() => toggleTextoExpandido(setPostsExpandidos, post.id)} className="text-[#1877F2] font-medium hover:underline text-sm ml-1">Ver menos</button>}</p>
              {post.imagen_url ? (post.imagen_url.includes('.gif') ? (<img src={post.imagen_url} className="w-full rounded-lg mb-3 border border-gray-100 object-contain bg-black/5" alt="GIF" />) : (<img src={post.imagen_url} className="w-full rounded-lg mb-3 border border-gray-100" alt="Imagen del post" />)) : null}
              <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-gray-500 text-sm">
                <span onClick={() => toggleLikePost(post.id)} className={`px-3 py-1 rounded cursor-pointer flex items-center gap-1 transition-colors text-xs sm:text-sm ${likedPosts.has(post.id) ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-gray-100'}`}>{likedPosts.has(post.id) ? '👍 Liked' : '👍 Like'} ({post.likes || 0})</span>
                <span onClick={() => toggleComentarios(post.id)} className={`px-3 py-1 rounded cursor-pointer text-xs sm:text-sm ${postsAbiertos.includes(post.id) ? "font-bold text-gray-900 bg-gray-100" : "hover:bg-gray-100"}`}>💬 Comment {Array.isArray(listaComentarios[post.id]) && listaComentarios[post.id].length > 0 ? `(${listaComentarios[post.id].length})` : ""}</span>
                {post.user_id === usuario?.id ? (<span onClick={() => eliminarPost(post.id)} className="hover:bg-red-100 hover:text-red-600 text-gray-400 px-3 py-1 rounded cursor-pointer text-xs sm:text-sm">Delete</span>) : null}
              </div>
              {postsAbiertos.includes(post.id) && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex gap-2 mb-4"><img src={perfil?.avatar_url || "https://ui-avatars.com/api/?name=U&background=1877F2&color=fff"} className="w-8 h-8 rounded-full shrink-0" alt="avatar"/><input type="text" maxLength={1000} className="flex-1 bg-gray-100 rounded-full px-4 py-1.5 outline-none text-sm text-gray-700 placeholder-gray-500" placeholder="Escribe un comentario..." value={textosComentarios[post.id] || ""} onChange={(e) => setTextosComentarios(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && publicarComentario(post.id)} /></div>
                  {Array.isArray(listaComentarios[post.id]) && listaComentarios[post.id].length > 0 && (<div className="flex flex-col gap-3">{listaComentarios[post.id].map((c: any) => (<div key={c.id} className="flex gap-2 items-start"><img src={c.autor_perfil?.avatar_url || "https://ui-avatars.com/api/?name=A&background=gray&color=fff"} className="w-8 h-8 rounded-full shrink-0 mt-0.5" alt="avatar"/><div className="flex-1 min-w-0"><div className="flex items-center justify-between mb-0.5"><p className="font-semibold text-[13px] text-gray-800 truncate mr-2">{c.autor_perfil?.username || c.autor_username || "Anonimo"} <span className="font-normal text-[11px] text-gray-500">{new Date(c.creado_en).toLocaleDateString()}</span></p><div className="flex items-center gap-1 shrink-0"><button onClick={() => votarComentario(post.id, c.id, 1)} className={`hover:text-orange-500 transition-colors ${c.userVote === 1 ? 'text-orange-500' : 'text-gray-400'}`}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button><span className={`text-[11px] font-bold ${c.userVote === 1 ? 'text-orange-500' : c.userVote === -1 ? 'text-blue-500' : 'text-gray-500'}`}>{c.score || 0}</span><button onClick={() => votarComentario(post.id, c.id, -1)} className={`hover:text-blue-500 transition-colors ${c.userVote === -1 ? 'text-blue-500' : 'text-gray-400'}`}><svg className="w-4 h-4 rotate-180" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button></div></div><p className="text-[15px] text-gray-700 break-words">{(c.mensaje?.length > 200 && !comentariosExpandidos.has(c.id)) ? (<>{c.mensaje.substring(0, 200)}... <button onClick={() => toggleTextoExpandido(setComentariosExpandidos, c.id)} className="text-[#1877F2] text-sm font-medium hover:underline">Ver más</button></>) : c.mensaje}{(c.mensaje?.length > 200 && comentariosExpandidos.has(c.id)) && (<button onClick={() => toggleTextoExpandido(setComentariosExpandidos, c.id)} className="text-[#1877F2] text-sm font-medium hover:underline ml-1">Ver menos</button>)}</p></div></div>))}</div>)}
                </div>
              )}
            </div>
          )))}
        </div>
      </div>

      {/* SIDEBAR DERECHO: GRUPOS RECOMENDADOS */}
      <aside className="w-[280px] shrink-0 hidden lg:block">
        <div className="fixed w-[280px]">
          <div className="p-2">
            <h2 className="font-semibold text-gray-500 text-[13px] px-2 py-1 uppercase">Grupos Recomendados</h2>
          </div>
          <ul>
            {gruposRecomendados.length === 0 && <li className="px-2 py-1 text-sm text-gray-400 italic px-4">No hay grupos aún.</li>}
            {gruposRecomendados.map((grupo) => (
              <li key={grupo.nombre}>
                <Link href={`/grupo/${grupo.nombre}`} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-gray-500">
                    {grupo.thumbnail_url ? <img src={grupo.thumbnail_url} className="w-full h-full object-cover" alt=""/> : <span className="text-xl font-bold">{grupo.nombre.charAt(0).toUpperCase()}</span>}
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

      {/* POPUP CREAR GRUPO */}
      {mostrarPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-0 rounded-lg shadow-xl text-black max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-[#1877F2] p-4"><h2 className="text-xl font-bold text-white">Crear un grupo</h2><p className="text-sm text-blue-100">Dale una identidad a tu comunidad</p></div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input type="file" accept="image/png, image/jpeg" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => { const file = e.target.files[0]; if(file) { setArchivoMiniatura(file); setPreviewMiniatura(URL.createObjectURL(file)); } }} />
                  <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                    {previewMiniatura ? <img src={previewMiniatura} className="w-full h-full object-cover" alt="Preview"/> : <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                  </div>
                </div>
                <div className="flex-1 text-sm text-gray-500">Sube una imagen de miniatura (Opcional).</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del grupo</label>
                <input type="text" placeholder="Ej: Amantes del Cafe" className="w-full p-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]" value={nombreGrupo} onChange={(e) => setNombreGrupo(e.target.value)} />
              </div>
              <div>
                <div className="flex justify-between mb-1"><label className="block text-sm font-medium text-gray-700">Descripción</label><span className="text-xs text-gray-400">{descripcionGrupo.length}/50</span></div>
                <input type="text" maxLength={50} placeholder="¿De qué trata este grupo?" className="w-full p-3 border border-gray-300 rounded-md text-black focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]" value={descripcionGrupo} onChange={(e) => setDescripcionGrupo(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
                <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md font-medium cursor-pointer" onClick={() => { limpiarPopup(); setMostrarPopup(false); }}>Cancelar</button>
                <button className="bg-[#1877F2] hover:bg-[#166FE5] text-white py-2 px-4 rounded-md font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={crearGrupo} disabled={creandoGrupo}>
                  {creandoGrupo ? "Creando..." : "Crear Grupo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
