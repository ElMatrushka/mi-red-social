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

  useEffect(() => { traerPosts(); comprobarMembresia(); }, [idGrupo]);

   const comprobarMembresia = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setEsMibero(false); return; } // <-- LÍNEA 58 ARREGLADA
    const { data } = await supabase.from("miembros").select("id").eq("user_id", session.user.id).eq("grupo_nombre", idGrupo);
    setEsMiembro(data && data.length > 0);
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
      todosLosLikes?.forEach((l: any) => { mapaLikesCount.set(l.post_id, (mapaLikesCount.get(l.post_id) || 0) + 1); });
      const misLikes = new Set(todosLosLikes?.filter((l: any) => l.user_id === session.user.id).map((l: any) => l.post_id) || []);
      setLikedPosts(misLikes);
      const postsCompletos = postsData.map((post: any) => ({ ...post, autor_perfil: mapaPerfiles.get(post.user_id) || null, likes: mapaLikesCount.get(post.id) || 0 }));
      setPosts(postsCompletos);
    } else {
      const postsCompletos = postsData.map((post: any) => ({ ...post, autor_perfil: mapaPerfiles.get(post.user_id) || null, likes: 0 }));
      setPosts(postsCompletos);
    }
  };

  const seleccionarImagenPost = (e: any) => {
    const archivo = e.target.files[0]; if (!archivo) return;
    setImagenPreview(URL.createObjectURL(archivo)); setArchivoASubir(archivo);
    setMostrarBuscadorGif(false); 
  };
  const limpiarMultimedia = () => { setImagenPreview(""); setArchivoASubir(null); };

  const handleBuscarGifs = async (query: string) => {
    if (!query.trim()) { handleTraerTrending(); return; }
    setCargandoGifs(true);
    try {
      const gifs = await buscarGifs(query);
      setResultadosGifs(gifs);
    } catch (error) { console.error(error); alert("Error al buscar GIFs"); }
    setCargandoGifs(false);
  };

  const handleTraerTrending = async () => {
    setCargandoGifs(true);
    try {
      const gifs = await traerTrending();
      setResultadosGifs(gifs);
    } catch (error) { console.error(error); alert("Error al cargar GIFs"); }
    setCargandoGifs(false);
  };

  const seleccionarGif = (url: string) => {
    setImagenPreview(url);
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
    await supabase.from("posts").insert([{ grupo_nombre: idGrupo, mensaje: nuevoPost, user_id: session.user.id, autor_email: session.user.email, autor_username: perfil.username, imagen_url: urlImagen }]);
    setNuevoPost(""); limpiarMultimedia(); traerPosts();
  };

  const toggleComentarios = async (postId: string) => {
    let nuevosAbiertos: string[];    
    if (postsAbiertos.includes(postId)) { nuevosAbiertos = postsAbiertos.filter(id => id !== postId); } 
    else { nuevosAbiertos = [...postsAbiertos, postId]; await traerComentarios(postId); }    
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
      todosLosVotos?.forEach((v: any) => { mapaScores.set(v.comentario_id, (mapaScores.get(v.comentario_id) || 0) + v.tipo_voto); });
      const comentariosConScore = data.map((c: any) => ({ ...c, autor_perfil: mapaPerfiles.get(c.user_id) || null, score: mapaScores.get(c.id) || 0, userVote: votosDelUsuario.get(c.id) || 0 }));
      comentariosConScore.sort((a, b) => b.score - a.score);
      const newState = { ...listaComentarios }; newState[postId] = comentariosConScore; setListaComentarios(newState);
    } else {
      const comentariosConScore = data.map((c: any) => ({ ...c, autor_perfil: mapaPerfiles.get(c.user_id) || null, score: 0, userVote: 0 }));
      const newState = { ...listaComentarios }; newState[postId] = comentariosConScore; setListaComentarios(newState);
    }
  };

  const publicarComentario = async (postId: string) => {
    const textoActual = textosComentarios[postId] || "";
    const { data: { session } } = await supabase.auth.getSession();
    if (textoActual.trim() === "" || !session?.user || !perfil) return;
    const { error } = await supabase.from("comentarios").insert([{ post_id: postId, user_id: session.user.id, autor_username: perfil.username, mensaje: textoActual }]);
    if (error) { alert("ERROR: " + error.message); return; }
    const textosLimpios = { ...textosComentarios }; textosLimpios[postId] = ""; setTextosComentarios(textosLimpios);
    traerComentarios(postId);
  };

  const toggleLikePost = async (postId: string) => {
    if (!usuario) return;
    if (likedPosts.has(postId)) {
      await supabase.from("likes_posts").delete().eq("post_id", postId).eq("user_id", usuario.id);
      setLikedPosts(prev => { const n = new Set(prev); n.delete(postId); return n; });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes - 1 } : p));
    } else {
      await supabase.from("likes_posts").insert([{ post_id: postId, user_id: usuario.id }]);
      setLikedPosts(prev => new Set(prev).add(postId));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
    }
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

  const unirseGrupo = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session?.user) return; await supabase.from("miembros").insert([{ user_id: session.user.id, grupo_nombre: idGrupo }]); setEsMiembro(true); };
  const salirseGrupo = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session?.user) return; if (!window.confirm("Are you sure you want to leave this group?")) return; await supabase.from("miembros").delete().eq("user_id", session.user.id).eq("grupo_nombre", idGrupo); setEsMiembro(false); router.push("/"); };
  const eliminarPost = async (postId: string) => { if (!window.confirm("Are you sure you want to delete this post?")) return; await supabase.from("posts").delete().eq("id", postId); traerPosts(); };
  const toggleTextoExpandido = (setter: any, id: string) => { setter((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };

  return (
    <main className="max-w-6xl mx-auto pt-6 px-4 flex gap-6">
      <aside className="w-[280px] shrink-0 hidden lg:block">
        <div className="fixed w-[280px]" style={{ width: "280px" }}>
          <Link href="/" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors mb-2"><svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg><span className="font-semibold text-[15px] text-gray-800">Volver al inicio</span></Link>
          <hr className="my-2 border-gray-300" />
          <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-100"><div className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-lg">G</div><span className="text-[15px] text-gray-800 font-medium">{idGrupo}</span></div>
        </div>
      </aside>

      <div className="flex-1 max-w-[600px]">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-gray-900">{idGrupo}</h1><p className="text-sm text-gray-500">Grupo privado</p></div>
          {usuario ? (esMiembro ? (<button onClick={salirseGrupo} className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md text-sm font-medium cursor-pointer">Leave Group</button>) : (<button onClick={unirseGrupo} className="bg-[#1877F2] hover:bg-[#166FE5] text-white py-2 px-4 rounded-md text-sm font-medium cursor-pointer">Join Group</button>)) : null}
        </div>

        {esMiembro ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex gap-3">
              <img src={perfil?.avatar_url || "https://ui-avatars.com/api/?name=U&background=1877F2&color=fff"} className="w-10 h-10 rounded-full shrink-0" alt="avatar"/>
              <input type="text" maxLength={1000} className="flex-1 bg-gray-100 rounded-full px-4 py-2 outline-none text-sm text-gray-700 placeholder-gray-500" placeholder={`Escribe algo en ${idGrupo}...`} value={nuevoPost} onChange={(e) => setNuevoPost(e.target.value)} onKeyDown={(e) => e.key === "Enter" && publicarPost()} />
              <div className="flex gap-2">
                <div className="relative">
                  <input type="file" accept="image/png, image/jpeg" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={seleccionarImagenPost} />
                  <div className="bg-gray-100 hover:bg-gray-200 text-green-600 h-10 w-10 rounded-full flex items-center justify-center cursor-pointer"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                </div>
                <button onClick={() => { setMostrarBuscadorGif(true); handleTraerTrending(); }} className="bg-gray-100 hover:bg-gray-200 text-purple-600 h-10 w-10 rounded-full flex items-center justify-center cursor-pointer font-bold text-sm">GIF</button>
              </div>
            </div>
            
            {imagenPreview ? (
              imagenPreview.endsWith('.gif') ? (
                <div className="mt-3 relative">
                  <img src={imagenPreview} className="w-full max-h-80 object-contain rounded-lg bg-black/5" alt="GIF Preview" />
                  <button onClick={limpiarMultimedia} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 cursor-pointer"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              ) : (
                <div className="mt-3 relative">
                  <img src={imagenPreview} className="w-full max-h-80 object-cover rounded-lg" alt="Preview" />
                  <button onClick={limpiarMultimedia} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 cursor-pointer"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              )
            ) : null}

            {(nuevoPost.trim() !== "" || imagenPreview) ? (<div className="mt-3 flex justify-between items-center border-t border-gray-200 pt-3"><span className="text-xs text-gray-400">{nuevoPost.length}/1000</span><button className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-2 px-6 rounded-md text-sm cursor-pointer" onClick={publicarPost}>Publicar</button></div>) : null}
          </div>
        ) : (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 text-center text-gray-500">Debes unirte al grupo para poder publicar.</div>)}

        <div className="flex flex-col gap-4">
          {posts.length === 0 ? (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500"><p className="text-lg font-medium mb-2">No hay publicaciones todavia</p><p className="text-sm">Se el primero en compartir algo en este grupo.</p></div>) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img src={post.autor_perfil?.avatar_url || "https://ui-avatars.com/api/?name=Anonimo&background=gray&color=fff"} className="w-10 h-10 rounded-full shrink-0" alt="avatar"/>
                  <div><p className="font-semibold text-[15px] text-gray-900">{post.autor_perfil?.username || post.autor_username || "Anonimo"} <span className="font-normal text-xs text-gray-500 ml-1">{new Date(post.creado_en).toLocaleDateString()} - {new Date(post.creado_en).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</span></p></div>
                </div>
                <p className="text-[15px] text-gray-800 mb-3 leading-relaxed">{(post.mensaje?.length > 200 && !postsExpandidos.has(post.id)) ? <>{post.mensaje.substring(0, 200)}... <button onClick={() => toggleTextoExpandido(setPostsExpandidos, post.id)} className="text-[#1877F2] font-medium hover:underline text-sm">Ver más</button></> : post.mensaje}{(post.mensaje?.length > 200 && postsExpandidos.has(post.id)) && <button onClick={() => toggleTextoExpandido(setPostsExpandidos, post.id)} className="text-[#1877F2] font-medium hover:underline text-sm ml-1">Ver menos</button>}</p>
                
                {post.imagen_url ? (post.imagen_url.endsWith('.gif') ? (<img src={post.imagen_url} className="w-full rounded-lg mb-3 border border-gray-100 object-contain bg-black/5" alt="GIF" />) : (<img src={post.imagen_url} className="w-full rounded-lg mb-3 border border-gray-100" alt="Imagen del post" />)) : null}

                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-gray-500 text-sm">
                  <span onClick={() => toggleLikePost(post.id)} className={`px-4 py-1 rounded cursor-pointer flex items-center gap-1 transition-colors ${likedPosts.has(post.id) ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-gray-100'}`}>{likedPosts.has(post.id) ? '👍 Liked' : '👍 Like'} ({post.likes || 0})</span>
                  <span onClick={() => toggleComentarios(post.id)} className={`px-4 py-1 rounded cursor-pointer ${postsAbiertos.includes(post.id) ? "font-bold text-gray-900 bg-gray-100" : "hover:bg-gray-100"}`}>💬 Comment {Array.isArray(listaComentarios[post.id]) && listaComentarios[post.id].length > 0 ? `(${listaComentarios[post.id].length})` : ""}</span>
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

      {mostrarBuscadorGif ? (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl text-black w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex gap-3 bg-white">
              <button onClick={() => setMostrarBuscadorGif(false)} className="text-gray-500 hover:text-black font-bold text-xl cursor-pointer">✕</button>
              <input type="text" className="flex-1 bg-gray-100 rounded-full px-4 py-2 outline-none text-sm text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-purple-500" placeholder="Buscar GIFs..." value={busquedaGif} onChange={(e) => setBusquedaGif(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleBuscarGifs(busquedaGif)} autoFocus />
              <button onClick={() => handleBuscarGifs(busquedaGif)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-full font-medium text-sm cursor-pointer">Buscar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {cargandoGifs ? (
                <div className="flex items-center justify-center h-full text-gray-500 font-medium">Cargando GIFs...</div>
              ) : resultadosGifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <p className="text-lg font-bold mb-2">Sin resultados</p>
                  <p className="text-sm">Prueba buscando "feliz" o "gato"</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {resultadosGifs.map((gif) => (
                    <div key={gif.id} onClick={() => seleccionarGif(gif.url)} className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 hover:scale-105 transition-transform border border-gray-200 bg-white">
                      <img src={gif.preview} alt="GIF" className="w-full h-full object-cover" loading="lazy"/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
