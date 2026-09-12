/**
 * APIHub Gateway - Server-Side Provider Secret Configuration
 *
 * Provider secrets are sourced exclusively from server-side environment variables.
 * They are never hardcoded, never exposed to the frontend, and never returned in API responses.
 */

export const PROVIDER_CONFIGS = {
  weatherapi: {
    envVar: "WEATHER_PROVIDER_KEY",
    description: "WeatherAPI.com current conditions and forecasts",
    inject: (options, url, secret) => {
      url.searchParams.set("key", secret);
    }
  },
  openweather: {
    envVar: "OPENWEATHER_KEY",
    description: "OpenWeather API forecast and current weather",
    inject: (options, url, secret) => {
      url.searchParams.set("appid", secret);
    }
  },
  finnhub: {
    envVar: "FINNHUB_KEY",
    description: "Finnhub market data and quotes",
    inject: (options, url, secret) => {
      options.headers["X-Finnhub-Token"] = secret;
    }
  },
  newsapi: {
    envVar: "NEWS_PROVIDER_KEY",
    description: "NewsAPI headlines and articles",
    inject: (options, url, secret) => {
      options.headers["X-Api-Key"] = secret;
    }
  },
  openai: {
    envVar: "AI_PROVIDER_KEY",
    description: "OpenAI API completions and models",
    inject: (options, url, secret) => {
      options.headers["Authorization"] = `Bearer ${secret}`;
    }
  },
  "alpha-vantage": {
    envVar: "ALPHAVANTAGE_KEY",
    description: "Alpha Vantage stock and financial data",
    inject: (options, url, secret) => {
      url.searchParams.set("apikey", secret);
    }
  },
  mapbox: {
    envVar: "MAPBOX_ACCESS_TOKEN",
    description: "Mapbox Geocoding and Places",
    inject: (options, url, secret) => {
      url.searchParams.set("access_token", secret);
    }
  },
  here: {
    envVar: "HERE_API_KEY",
    description: "HERE Location Services and Geocoding",
    inject: (options, url, secret) => {
      url.searchParams.set("apiKey", secret);
    }
  },
  opencage: {
    envVar: "OPENCAGE_API_KEY",
    description: "OpenCage Geocoding API",
    inject: (options, url, secret) => {
      url.searchParams.set("key", secret);
    }
  }
};

/**
 * Look up provider config by slug
 */
export function getProviderConfig(apiSlug) {
  if (!apiSlug || typeof apiSlug !== "string") return null;
  return PROVIDER_CONFIGS[apiSlug.toLowerCase()] || null;
}

/**
 * Check whether a credentialed provider has its secret configured in process.env
 */
export function isProviderConfigured(apiSlug) {
  const config = getProviderConfig(apiSlug);
  if (!config) return true; // Keyless / open APIs require no server-side secret
  return Boolean(process.env[config.envVar]);
}
