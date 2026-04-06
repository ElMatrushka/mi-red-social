const API_KEY = "Zhd4ZACWYEpCxX4HFzmFjySU7MlI7d9I";

const getGifs = async (endpoint) => {
  try {
    const res = await fetch(`https://api.giphy.com/v1${endpoint}&api_key=${API_KEY}&limit=21&rating=g`);
    if (!res.ok) throw new Error("Error en la petición");
    const data = await res.json();
    return data.data.map((gif) => ({
      id: gif.id,
      url: gif.images.original.url,
      preview: gif.images.fixed_height.url,
    }));
  } catch (error) {
    console.error("Error al traer GIFs:", error);
    return [];
  }
};

export const buscarGifs = (query) => getGifs(`/gifs/search?q=${encodeURIComponent(query)}`);
export const traerTrending = () => getGifs(`/gifs/trending`);