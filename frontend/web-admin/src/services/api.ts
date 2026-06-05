export type Weather = {
  date: string;
  temperatureC: number;
  temperatureF: number;
  summary: string;
};

const API_URL = import.meta.env.VITE_API_URL;

export async function getWeather(): Promise<Weather[]> {
  const response = await fetch(`${API_URL}/weatherforecast`);

  if (!response.ok) {
    throw new Error("No se pudieron obtener los datos del clima");
  }

  return response.json();
}
