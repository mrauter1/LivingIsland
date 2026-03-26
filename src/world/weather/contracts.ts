import type { WeatherState } from "../../types";

export const WEATHER_DURATIONS: Record<WeatherState, [number, number]> = {
  clear: [24, 72],
  cloudy: [24, 48],
  rain: [16, 40],
  storm: [12, 24],
  fog: [12, 24],
};
