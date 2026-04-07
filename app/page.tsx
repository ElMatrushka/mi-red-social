export const dynamic = 'force-dynamic';
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function Home() {
  const [mostrarPopup, setMostrarPopup] = useState(false);
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [grupos, setGrupos] = useState<string[]>([]);
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
    traerGrupos(); traerFeed();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ?? null);
      if (session?.user) traerPerfil(session.user.id); else setPerfil(null);
      traerFeed(); 
    });
    supabase.auth.getSession().then(({ data: { session } }) => { if (session?.user) traerPerfil(session.user.id); });
    return () => subscription.unsubscribe();
  }, []);

  const traerPerfil = async (userId: string) => { const { data } = await supabase.from("perfiles").select("*").eq("id", userId).maybeSingle(); setPerfil(data); };
  const traerGrupos = async () => { const { data } = await supabase.from("grupos").select("*").order("creado_en", { ascending: false }); if (data) setGrupos(data.map((g: any) => g.nombre)); };

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
    const postsCompletos = postsData.map((post: any) => ({ ...post, autor_perfil: mapaPerfiles.get(post.user_id) || null, likes: mapaLikesCount.get(post.id) || 0 }));
    setFeedPosts(postsCompletos);
  };

  const crearGrupo = async () => {
    if (nombreGrupo.trim() === "") return;
    await supabase.from("grupos").insert([{ nombre: nombreGrupo }]);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await supabase.from("miembros").insert([{ user_id: session.user.id, grupo_nombre: nombreGrupo }]);
    setNombreGrupo(""); setMostrarPopup(false); traerGrupos(); traerFeed();
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

  const eliminarPost = async (postId: string) => { if (!window.confirm("Are you sure you want to delete this post?")) return; await supabase.from("posts").delete().eq("id", postId); traerFeed(); };

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
      const comentariosConScore = data.map((c: any) => ({ ...c, autor_perfil: mapaPerfiles.get(c.user_id) || null, score: 0, userVote: 0 }));
      const newState = { ...listaComentarios }; newState[postId] = comentariosConScore; setListaComentarios(newState);
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
    if (votoActual === tipo) {
      await supabase.from("votos_comentarios").delete().eq("comentario_id", comentarioId).eq("user_id", usuario.id);
      cambioEnScore = -tipo;
    } else {
      await supabase.from("votos_comentarios").upsert({ comentario_id: comentarioId, user_id: usuario.id, tipo_voto: tipo }, { onConflict: 'user_id,comentario_id' });
      if (votoActual !== 0) cambioEnScore = tipo * 2;
    }
    setUserVotes(prev => new Map(prev).set(comentarioId, votoActual === tipo ? 0 : tipo));
    setListaComentarios(prevState => {
      const newComments = { ...prevState };
      newComments[postId] = newComments[postId].map((c: any) => c.id === comentarioId ? { ...c, score: c.score + cambioEnScore, userVote: votoActual === tipo ? 0 : tipo } : c).sort((a: any, b: any) => b.score - a.score);
      return newComments;
    });
  };

  const toggleTextoExpandido = (setter: any, id: string) => { setter((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };

  return (
    <main className="max-w-6xl mx-auto pt-6 px-4 flex gap-6">
      <aside className="w-[280px] shrink-0 hidden lg:block">
        <div className="fixed w-[280px]">
          {perfil ? (
            <div className="flex flex-col items-center p-4">
              <Link href="/configurar-perfil" className="group relative block">
                <img src={perfil.avatar_url} className="w-16 h-16 rounded-full border-2 border-white shadow-md group-hover:opacity-80 transition-opacity" alt="avatar"/>
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></div>
              </Link>
              <Link href="/configurar-perfil" className="font-semibold text-[15px] text-gray-800 truncate mt-2 hover:underline">{perfil.username}</Link>
            </div>
          ) : (<Link href="/login" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors mb-1"><div className="w-9 h-9 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">?</div><span className="font-medium text-[15px] text-[#1877F2]">Iniciar Sesion</span></Link>)}
          <hr className="my-2 border-gray-300" />
          <ul>
            <li className="font-semibold text-gray-500 text-[13px] px-2 py-1 uppercase">Tus Grupos</li>
            {grupos.map((grupo) => (<li key={grupo}><Link href={`/grupo/${grupo}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"><div className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-lg">G</div><span className="text-[15px] text-gray-800 font-medium truncate">{grupo}</span></Link></li>))}
            <li><button onClick={() => setMostrarPopup(true)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left"><div className="w-9 h-9 bg-gray-100 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center text-gray-500 text-xl">+</div><span className="text-[15px] text-[#1877F2] font-medium">Crear nuevo grupo</span></button></li>
          </ul>
          {usuario ? (<button onClick={cerrarSesion} className="mt-4 text-sm text-gray-400 hover:text-red-500 cursor-pointer">Cerrar sesion</button>) : null}
        </div>
      </aside>

      <div className="flex-1 max-w-[600px]">
        <div className="flex flex-col gap-4">
          {feedPosts.length === 0 ? (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500"><p className="text-lg font-medium mb-2">Tu inicio esta vacio</p><p className="text-sm">Crea un grupo o unete a uno existente para ver publicaciones aqui.</p></div>) : (
            feedPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img src={post.autor_perfil?.avatar_url || "https://ui-avatars.com/api/?name=A&background=gray&color=fff"} className="w-10 h-10 rounded-full shrink-0" alt="avatar"/>
                  <div className="flex-1"><p className="font-semibold text-[15px] text-gray-900">{post.autor_perfil?.username || post.autor_username || "Anonimo"} <span className="font-normal text-xs text-gray-500 ml-1"><Link href={`/grupo/${post.grupo_nombre}`} className="font-semibold text-[#1877F2] hover:underline">{decodeURIComponent(post.grupo_nombre)}</Link> - {new Date(post.creado_en).toLocaleDateString()}</span></p></div>
                </div>
                <p className="text-[15px] text-gray-800 mb-3 leading-relaxed">{(post.mensaje?.length > 200 && !postsExpandidos.has(post.id)) ? <>{post.mensaje.substring(0, 200)}... <button onClick={() => toggleTextoExpandido(setPostsExpandidos, post.id)} className="text-[#1877F2] font-medium hover:underline text-sm">Ver más</button></> : post.mensaje}{(post.mensaje?.length > 200 && postsExpandidos.has(post.id)) && <button onClick={() => toggleTextoExpandido(setPostsExpandidos, post.id)} className="text-[#1877F2] font-medium hover:underline text-sm ml-1">Ver menos</button>}</p>
                {post.imagen_url ? (<img src={post.imagen_url} className="w-full rounded-lg mb-3 border border-gray-100" alt="Imagen del post" />) : null}
                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-gray-500 text-sm">
                  <span onClick={() => toggleLikePost(post.id)} className={`px-4 py-1 rounded cursor-pointer flex items-center gap-1 transition-colors ${likedPosts.has(post.id) ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-gray-100'}`}>{likedPosts.has(post.id) ? '👍 Liked' : '👍 Like'} ({post.likes || 0})</span>
                  <span onClick={() => toggleComentarios(post.id)} className={`px-4 py-1 rounded cursor-pointer ${postsAbiertos.includes(post.id) ? 'font-bold text-gray-900 bg-gray-100' : 'hover:bg-gray-100'}`}>💬 Comment {Array.isArray(listaComentarios[post.id]) && listaComentarios[post.id].length > 0 ? `(${listaComentarios[post.id].length})` : ""}</span>
                  {post.user_id === usuario?.id ? (<span onClick={() => eliminarPost(post.id)} className="hover:bg-red-100 hover:text-red-600 text-gray-400 px-4 py-1 rounded cursor-pointer">Delete</span>) : null}
                </div>
                {postsAbiertos.includes(post.id) ? (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex gap-2 mb-4">
                      <img src={perfil?.avatar_url || "https://ui-avatars.com/api/?name=U&background=1877F2&color=fff"} className="w-8 h-8 rounded-full shrink-0" alt="avatar"/>
                      <input type="text" maxLength={1000} className="flex-1 bg-gray-100 rounded-full px-4 py-1.5 outline-none text-sm text-gray-700 placeholder-gray-500" placeholder="Escribe un comentario..." value={textosComentarios[post.id] || ""} onChange={(e) => setTextosComentarios(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && publicarComentario(post.id)} />
                    </div>
                    {Array.isArray(listaComentarios[post.id]) && listaComentarios[post.id].length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {listaComentarios[post.id].map((c: any) => (
                          <div key={c.id} className="flex gap-2 items-start">
                            <img src={c.autor_perfil?.avatar_url || "https://ui-avatars.com/api/?name=A&background=gray&color=fff"} className="w-8 h-8 rounded-full shrink-0 mt-0.5" alt="avatar"/>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <p className="font-semibold text-[13px] text-gray-800">{c.autor_perfil?.username || c.autor_username || "Anonimo"} <span className="font-normal text-[11px] text-gray-500">{new Date(c.creado_en).toLocaleDateString()}</span></p>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => votarComentario(post.id, c.id, 1)} className={`hover:text-orange-500 transition-colors ${c.userVote === 1 ? 'text-orange-500' : 'text-gray-400'}`}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button>
                                  <span className={`text-[11px] font-bold ${c.userVote === 1 ? 'text-orange-500' : c.userVote === -1 ? 'text-blue-500' : 'text-gray-500'}`}>{c.score || 0}</span>
                                  <button onClick={() => votarComentario(post.id, c.id, -1)} className={`hover:text-blue-500 transition-colors ${c.userVote === -1 ? 'text-blue-500' : 'text-gray-400'}`}><svg className="w-4 h-4 rotate-180" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button>
                                </div>
                              </div>
                              <p className="text-[15px] text-gray-700 break-words">{(c.mensaje?.length > 200 && !comentariosExpandidos.has(c.id)) ? <>{c.mensaje.substring(0, 200)}... <button onClick={() => toggleTextoExpandido(setComentariosExpandidos, c.id)} className="text-[#1877F2] text-sm font-medium hover:underline">Ver más</button></> : c.mensaje}{(c.mensaje?.length > 200 && comentariosExpandidos.has(c.id)) && <button onClick={() => toggleTextoExpandido(setComentariosExpandidos, c.id)} className="text-[#1877F2] text-sm font-medium hover:underline ml-1">Ver menos</button>}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {mostrarPopup ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-0 rounded-lg shadow-xl text-black max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-[#1877F2] p-4"><h2 className="text-xl font-bold text-white">Crear un grupo</h2><p className="text-sm text-blue-100">Unete a la comunidad</p></div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del grupo</label>
              <input type="text" placeholder="Ej: Amantes del Cafe" className="w-full p-3 border border-gray-300 rounded-md mb-4 text-black focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]" value={nombreGrupo} onChange={(e) => setNombreGrupo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && crearGrupo()} />
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md font-medium cursor-pointer" onClick={() => setMostrarPopup(false)}>Cancelar</button>
                <button className="bg-[#1877F2] hover:bg-[#166FE5] text-white py-2 px-4 rounded-md font-medium cursor-pointer" onClick={crearGrupo}>Crear</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
