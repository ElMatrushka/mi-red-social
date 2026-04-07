export const dynamic = 'force-dynamic';
export const API_KEY = "Zhd4ZACWYEpCxX4HFzmFjySU7MlI7d9I";

async function getGifs(endpoint) {
  try {
    const res = await fetch(`https://api.giphy.com/v1${endpoint}&api_key=${API_KEY}&limit=21&rating=g`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data.map(function(gif) {
      return {
        id: gif.id,
        url: gif.images.original.url,
        preview: gif.images.fixed_height.url
      };
    });
  } catch (error) {
    return [];
  }
}

export async function buscarGifs(query) {
  return getGifs(`/gifs/search?q=${encodeURIComponent(query)}`);
}

export async function traerTrending() {
  return getGifs(`/gifs/trending`);
}
