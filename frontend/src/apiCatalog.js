const response = (shape) => JSON.stringify(shape, null, 2);

function api(id, name, description, category, baseUrl, authentication, reference, endpoint, testable = false, tags = [], supportTypeOverride = null) {
  const [endpointName, method, path, parameters = "", exampleResponse = { ok: true }] = endpoint;
  const supportType = supportTypeOverride || (testable ? "gateway_live" : (authentication && (authentication.toLowerCase().includes("key") || authentication.toLowerCase().includes("token") || authentication.toLowerCase().includes("credential")) ? "credential_required" : "catalog_reference"));
  return {
    id,
    name,
    description,
    desc: description,
    category,
    baseUrl,
    authentication,
    auth: authentication,
    reference,
    testable,
    supportType,
    tags: [category, ...tags],
    keywords: `${name} ${description} ${category} ${tags.join(" ")}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
    endpoints: [
      {
        name: endpointName,
        method,
        path,
        parameters,
        body: "",
        exampleRequest: `${method} ${baseUrl}${path}`,
        example: response(exampleResponse)
      }
    ]
  };
}

export const apiCatalog = [
  // 1. Weather & Climate
  api(
    "open-meteo",
    "Open-Meteo Weather",
    "High-resolution global weather forecasts, temperature, and atmospheric conditions.",
    "Weather & Climate",
    "https://api.open-meteo.com/v1",
    "None",
    "https://open-meteo.com/en/docs",
    ["Forecast", "GET", "/forecast", "latitude=28.6139\nlongitude=77.2090\ncurrent=temperature_2m", { current: { temperature_2m: 24.5 } }],
    true,
    ["Weather", "Climate", "Forecast"]
  ),
  api(
    "met-no",
    "MET Norway Locationforecast",
    "Official Norwegian Meteorological Institute weather forecast and timeseries.",
    "Weather & Climate",
    "https://api.met.no/weatherapi/locationforecast/2.0",
    "User-Agent identification required",
    "https://api.met.no/weatherapi/locationforecast/2.0/documentation",
    ["Compact forecast", "GET", "/compact", "lat=59.91\nlon=10.75", { properties: { timeseries: [] } }],
    false,
    ["Forecast", "Meteorology"]
  ),
  api(
    "weatherapi",
    "WeatherAPI.com",
    "Current weather, 14-day forecast, air quality and astronomy data.",
    "Weather & Climate",
    "https://api.weatherapi.com/v1",
    "Server-side key required",
    "https://www.weatherapi.com/docs/",
    ["Current conditions", "GET", "/current.json", "q=London", { location: { name: "London" }, current: { temp_c: 18 } }],
    false,
    ["Weather", "Provider"]
  ),

  // 2. Finance, Stocks & Market Data
  api(
    "frankfurter-finance",
    "Central Bank Market Data",
    "Historical financial reference rates and central bank currency benchmarks.",
    "Finance, Stocks & Market Data",
    "https://api.frankfurter.dev/v1",
    "None",
    "https://frankfurter.dev/",
    ["Market benchmarks", "GET", "/latest", "base=USD\nsymbols=EUR,GBP,INR", { base: "USD", rates: { EUR: 0.92, GBP: 0.78, INR: 86.5 } }],
    true,
    ["Markets", "Benchmark", "Finance"]
  ),
  api(
    "alpha-vantage",
    "Alpha Vantage Equities",
    "Real-time and historical stock market quotes, forex and technical indicators.",
    "Finance, Stocks & Market Data",
    "https://www.alphavantage.co/query",
    "Server-side key required",
    "https://www.alphavantage.co/documentation/",
    ["Daily stock data", "GET", "/", "function=TIME_SERIES_DAILY\nsymbol=IBM", { "Meta Data": { "2. Symbol": "IBM" } }],
    false,
    ["Stocks", "Equities", "WallStreet"]
  ),
  api(
    "finnhub",
    "Finnhub Market Data",
    "Real-time institutional stock quotes, earnings, company fundamentals and news.",
    "Finance, Stocks & Market Data",
    "https://finnhub.io/api/v1",
    "Server-side token required",
    "https://finnhub.io/docs/api",
    ["Stock quote", "GET", "/quote", "symbol=AAPL", { c: 230.5, d: 2.1, dp: 0.92 }],
    false,
    ["Stocks", "Market", "Quotes"]
  ),

  // 3. News
  api(
    "hacker-news",
    "Hacker News Live Feed",
    "Official Firebase REST API for top tech stories, articles, and discussions.",
    "News",
    "https://hacker-news.firebaseio.com/v0",
    "None",
    "https://github.com/HackerNews/API",
    ["Top tech stories", "GET", "/topstories.json", "print=pretty", [41000001, 41000002, 41000003]],
    true,
    ["Technology", "Headlines", "Articles"]
  ),
  api(
    "newsapi",
    "NewsAPI Global",
    "Breaking news headlines and search articles from over 80,000 news sources.",
    "News",
    "https://newsapi.org/v2",
    "Server-side key required",
    "https://newsapi.org/docs",
    ["Top headlines", "GET", "/top-headlines", "country=us", { status: "ok", totalResults: 38, articles: [] }],
    false,
    ["Journalism", "Breaking News"]
  ),
  api(
    "guardian",
    "The Guardian Open Platform",
    "Access all Guardian content, sections, investigative reporting and tags.",
    "News",
    "https://content.guardianapis.com",
    "Server-side key required",
    "https://open-platform.theguardian.com/documentation/",
    ["Search content", "GET", "/search", "q=technology", { response: { status: "ok", results: [] } }],
    false,
    ["News", "Journalism"]
  ),

  // 4. AI & Machine Learning
  api(
    "huggingface",
    "Hugging Face Hub Models",
    "Discover open-source AI models, transformers, datasets, and pipelines.",
    "AI & Machine Learning",
    "https://huggingface.co/api",
    "None",
    "https://huggingface.co/docs/hub/api",
    ["List AI models", "GET", "/models", "limit=5", [{ id: "meta-llama/Llama-3.3-70B-Instruct" }, { id: "openai/whisper-large-v3" }]],
    true,
    ["AI", "LLM", "Models", "Transformers"]
  ),
  api(
    "openai",
    "OpenAI Models API",
    "List and inspect available GPT, DALL-E, Whisper, and embedding models.",
    "AI & Machine Learning",
    "https://api.openai.com/v1",
    "Server-side bearer token required",
    "https://platform.openai.com/docs/api-reference",
    ["List models", "GET", "/models", "", { object: "list", data: [{ id: "gpt-4o" }, { id: "o1" }] }],
    false,
    ["OpenAI", "GPT", "Generative AI"]
  ),
  api(
    "gemini",
    "Google Gemini AI",
    "Next-generation multimodal reasoning and language generation models.",
    "AI & Machine Learning",
    "https://generativelanguage.googleapis.com/v1beta",
    "Server-side key required",
    "https://ai.google.dev/gemini-api/docs",
    ["Generate content", "POST", "/models/gemini-2.0-flash:generateContent", "", { candidates: [{ content: { parts: [{ text: "Hello!" }] } }] }],
    false,
    ["Google", "Gemini", "Multimodal"]
  ),

  // 5. Maps & Geolocation
  api(
    "bigdatacloud",
    "BigDataCloud Reverse Geocoding",
    "Fast, accurate client-side reverse geocoding from latitude and longitude coordinates.",
    "Maps & Geolocation",
    "https://api.bigdatacloud.net/data",
    "None",
    "https://www.bigdatacloud.com/docs/api/reverse-geocode-client",
    ["Reverse geocode", "GET", "/reverse-geocode-client", "latitude=28.6139\nlongitude=77.2090\nlocalityLanguage=en", { city: "New Delhi", countryName: "India" }],
    true,
    ["Geocoding", "Coordinates", "Maps"]
  ),
  api(
    "ipapi",
    "ipapi Geolocation",
    "Instant IP address geolocation, ISP lookup, city, region and timezone detection.",
    "Maps & Geolocation",
    "https://ipapi.co",
    "None",
    "https://ipapi.co/api/",
    ["Lookup IP", "GET", "/json/", "", { ip: "8.8.8.8", city: "Mountain View", country_name: "United States" }],
    true,
    ["IP", "Location", "Network"]
  ),
  api(
    "nominatim",
    "OpenStreetMap Nominatim",
    "Open-source worldwide place search, geocoding and address lookup.",
    "Maps & Geolocation",
    "https://nominatim.openstreetmap.org",
    "User-Agent required",
    "https://nominatim.org/release-docs/latest/api/Overview/",
    ["Search places", "GET", "/search", "q=London\nformat=json", [{ place_id: 1, display_name: "London, Greater London, England" }]],
    true,
    ["OpenStreetMap", "Addresses"]
  ),

  // 6. Countries & World Data
  api(
    "rest-countries",
    "REST Countries",
    "Comprehensive country data: capitals, population, borders, currencies, and languages.",
    "Countries & World Data",
    "https://restcountries.com/v3.1",
    "None",
    "https://restcountries.com/",
    ["Find country", "GET", "/name/india", "", [{ name: { common: "India" }, capital: ["New Delhi"], population: 1400000000 }]],
    true,
    ["Geography", "Demographics", "Global"]
  ),
  api(
    "world-bank",
    "World Bank Global Indicators",
    "Socio-economic indicators, GDP, trade, climate and poverty metrics for 200+ countries.",
    "Countries & World Data",
    "https://api.worldbank.org/v2",
    "None",
    "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation",
    ["Country indicators", "GET", "/country/IND", "format=json", [{ page: 1 }, [{ id: "IND", name: "India", region: { value: "South Asia" } }]]],
    true,
    ["Economics", "Indicators", "World Bank"]
  ),
  api(
    "nager-date",
    "Nager.Date Public Holidays",
    "Worldwide public holidays, official country calendars and long weekends.",
    "Countries & World Data",
    "https://date.nager.at/api/v3",
    "None",
    "https://date.nager.at/Api",
    ["Available countries", "GET", "/AvailableCountries", "", [{ countryCode: "US", name: "United States" }, { countryCode: "IN", name: "India" }]],
    true,
    ["Holidays", "Calendar"]
  ),

  // 7. Sports
  api(
    "thesportsdb",
    "TheSportsDB Sports Data",
    "Sports leagues, team rosters, player profiles, stadiums, and event results.",
    "Sports",
    "https://www.thesportsdb.com/api/v1/json/3",
    "None",
    "https://www.thesportsdb.com/api.php",
    ["Search team", "GET", "/searchteams.php", "t=Arsenal", { teams: [{ idTeam: "133604", strTeam: "Arsenal", strLeague: "English Premier League" }] }],
    true,
    ["Football", "Soccer", "Athletics"]
  ),
  api(
    "f1",
    "OpenF1 Motorsport Telemetry",
    "Formula 1 official live timing, race sessions, drivers, lap times, and telemetry.",
    "Sports",
    "https://api.openf1.org/v1",
    "None",
    "https://openf1.org/",
    ["List sessions", "GET", "/sessions", "year=2024", [{ session_name: "Race", country_name: "Monaco", year: 2024 }]],
    true,
    ["Racing", "Motorsport", "F1"]
  ),
  api(
    "football-data",
    "football-data.org",
    "European football leagues, match fixtures, live scores, and tables.",
    "Sports",
    "https://api.football-data.org/v4",
    "Server-side token required",
    "https://www.football-data.org/documentation/quickstart",
    ["Premier League", "GET", "/competitions/PL", "", { id: 2021, name: "Premier League" }],
    false,
    ["Soccer", "Leagues"]
  ),

  // 8. Movies & Entertainment
  api(
    "tvmaze",
    "TVmaze Television Catalog",
    "Television show schedule, cast information, episode guides, and streaming platforms.",
    "Movies & Entertainment",
    "https://api.tvmaze.com",
    "None",
    "https://www.tvmaze.com/api",
    ["Search TV shows", "GET", "/search/shows", "q=office", [{ show: { id: 526, name: "The Office", rating: { average: 8.5 } } }]],
    true,
    ["Shows", "Television", "Streaming"]
  ),
  api(
    "jikan",
    "Jikan Anime Database",
    "Open-source MyAnimeList REST API for anime series, manga, voice actors, and top rankings.",
    "Movies & Entertainment",
    "https://api.jikan.moe/v4",
    "None",
    "https://docs.api.jikan.moe/",
    ["Top anime", "GET", "/top/anime", "", { data: [{ mal_id: 5114, title: "Fullmetal Alchemist: Brotherhood", score: 9.1 }] }],
    true,
    ["Anime", "Manga", "Animation"]
  ),
  api(
    "rickmorty",
    "Rick and Morty Universe",
    "Explore characters, dimensions, planets, and episode lore from Rick and Morty.",
    "Movies & Entertainment",
    "https://rickandmortyapi.com/api",
    "None",
    "https://rickandmortyapi.com/documentation",
    ["List characters", "GET", "/character", "", { info: { count: 826 }, results: [{ id: 1, name: "Rick Sanchez", species: "Human" }] }],
    true,
    ["Entertainment", "Animation", "Characters"]
  ),

  // 9. GitHub & Developer Tools
  api(
    "github",
    "GitHub Public REST API",
    "Repositories, organizations, public gists, commit history, and developer profiles.",
    "GitHub & Developer Tools",
    "https://api.github.com",
    "None",
    "https://docs.github.com/en/rest",
    ["Get user profile", "GET", "/users/octocat", "", { login: "octocat", id: 583231, public_repos: 8 }],
    true,
    ["Git", "Developer", "Code"]
  ),
  api(
    "npm-registry",
    "npm Package Registry",
    "JavaScript package metadata, dependencies, download metrics, and versions.",
    "GitHub & Developer Tools",
    "https://registry.npmjs.org",
    "None",
    "https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md",
    ["Package details", "GET", "/react", "", { name: "react", "dist-tags": { latest: "19.0.0" } }],
    true,
    ["Node", "Packages", "JavaScript"]
  ),
  api(
    "httpbin",
    "httpbin Request Inspector",
    "Developer HTTP request, response, status code, and header testing sandbox.",
    "GitHub & Developer Tools",
    "https://httpbin.org",
    "None",
    "https://httpbin.org/",
    ["Inspect GET", "GET", "/get", "sample=apihub", { args: { sample: "apihub" }, headers: { Host: "httpbin.org" } }],
    true,
    ["HTTP", "Testing", "Tools"]
  ),
  api(
    "gitlab",
    "GitLab Public REST",
    "GitLab open source projects, issues, merge requests, and pipelines.",
    "GitHub & Developer Tools",
    "https://gitlab.com/api/v4",
    "None",
    "https://docs.gitlab.com/api/rest/",
    ["Public projects", "GET", "/projects", "per_page=5", [{ id: 13083, name: "GitLab FOSS" }]],
    true,
    ["Git", "DevOps"]
  ),

  // 10. E-commerce & Products
  api(
    "dummyjson",
    "DummyJSON Products",
    "Sample e-commerce catalog with prices, ratings, inventory, categories, and reviews.",
    "E-commerce & Products",
    "https://dummyjson.com",
    "None",
    "https://dummyjson.com/docs/products",
    ["Get product", "GET", "/products/1", "", { id: 1, title: "Essence Mascara Lash Princess", price: 9.99, stock: 99 }],
    true,
    ["Products", "Catalog", "Shopping"]
  ),
  api(
    "fake-store",
    "Fake Store Products",
    "Mock retail store catalog with electronics, jewelry, clothing, and shopping carts.",
    "E-commerce & Products",
    "https://fakestoreapi.com",
    "None",
    "https://fakestoreapi.com/docs",
    ["Get product item", "GET", "/products/1", "", { id: 1, title: "Fjallraven Backpack", price: 109.95, category: "men's clothing" }],
    true,
    ["Store", "Cart", "Retail"]
  ),

  // 11. Education
  api(
    "poetrydb",
    "PoetryDB Literature",
    "Internet's first open database of poetry, poet biographies, and classical literature.",
    "Education",
    "https://poetrydb.org",
    "None",
    "https://github.com/thundercomb/poetrydb",
    ["Get poem", "GET", "/title/Ozymandias", "", [{ title: "Ozymandias", author: "Percy Bysshe Shelley", lines: ["I met a traveller from an antique land..."] }]],
    true,
    ["Poetry", "Literature", "Books", "Education"]
  ),
  api(
    "wikipedia",
    "Wikipedia REST Knowledge",
    "Official Wikimedia REST API providing summary extracts and article metadata.",
    "Education",
    "https://en.wikipedia.org/api/rest_v1",
    "None",
    "https://www.mediawiki.org/wiki/API_reference",
    ["Page summary", "GET", "/page/summary/Technology", "", { title: "Technology", extract: "Technology is the application of knowledge..." }],
    true,
    ["Encyclopedia", "Reference", "Knowledge"]
  ),
  api(
    "datamuse",
    "Datamuse Thesaurus",
    "Powerful word-finding engine for developers: synonyms, rhymes, and definitions.",
    "Education",
    "https://api.datamuse.com",
    "None",
    "https://www.datamuse.com/api/",
    ["Related words", "GET", "/words", "ml=developer", [{ word: "programmer", score: 95000 }, { word: "architect", score: 85000 }]],
    true,
    ["Language", "Dictionary", "Words"]
  ),

  // 12. Government & Public Data
  api(
    "us-treasury",
    "US Treasury Fiscal Data",
    "Official United States Treasury financial reference data, interest rates, debt, and revenue.",
    "Government & Public Data",
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od",
    "None",
    "https://fiscaldata.treasury.gov/api-documentation/",
    ["Average interest rates", "GET", "/avg_interest_rates", "page[size]=3", { data: [{ record_date: "2024-01-31", avg_interest_rate_amt: "3.12" }] }],
    true,
    ["Treasury", "Finance", "Government", "Fiscal"]
  ),
  api(
    "govuk",
    "GOV.UK Content API",
    "Official digital services and content metadata published across the UK government.",
    "Government & Public Data",
    "https://www.gov.uk/api",
    "None",
    "https://content-api.publishing.service.gov.uk/",
    ["Search content", "GET", "/search.json", "q=passport", { total: 120, results: [] }],
    true,
    ["UK", "PublicServices"]
  ),
  api(
    "census",
    "US Census Demographics",
    "Demographic, socio-economic, housing, and population data from the US Census Bureau.",
    "Government & Public Data",
    "https://api.census.gov/data/2023/acs/acs5",
    "None",
    "https://www.census.gov/data/developers/data-sets.html",
    ["Population estimates", "GET", "/profile", "get=NAME,DP05_0001E\nfor=state:*", [["NAME", "DP05_0001E", "state"], ["California", "39029342", "06"]]],
    true,
    ["Demographics", "Population", "Statistics"]
  ),

  // 13. Social Media
  api(
    "bluesky",
    "Bluesky AT Protocol",
    "Decentralized public social network feeds, actor profiles, and open social graphs.",
    "Social Media",
    "https://public.api.bsky.app/xrpc",
    "None",
    "https://docs.bsky.app/docs/api/",
    ["Get profile", "GET", "/app.bsky.actor.getProfile", "actor=atproto.com", { did: "did:plc:ewvi7nxzyoun6zhxrhs64oiz", handle: "atproto.com" }],
    true,
    ["Decentralized", "Social", "Microblogging"]
  ),
  api(
    "mastodon",
    "Mastodon Public Timeline",
    "ActivityPub federated social network public timeline and community posts.",
    "Social Media",
    "https://mastodon.social/api/v1",
    "Bearer Token required",
    "https://docs.joinmastodon.org/api/",
    ["Public timeline", "GET", "/timelines/public", "limit=5", [{ id: "10982348", content: "<p>Hello Mastodon!</p>" }]],
    false,
    ["Federated", "ActivityPub", "Social"],
    "credential_required"
  ),

  // 14. Crypto & Blockchain
  api(
    "binance",
    "Binance Crypto Market",
    "Global real-time cryptocurrency ticker prices, 24-hour volume, and market statistics.",
    "Crypto & Blockchain",
    "https://api.binance.com/api/v3",
    "None",
    "https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints",
    ["Crypto price ticker", "GET", "/ticker/price", "symbol=BTCUSDT", { symbol: "BTCUSDT", price: "96500.00" }],
    true,
    ["Bitcoin", "Ethereum", "Crypto", "Markets"]
  ),
  api(
    "coinbase",
    "Coinbase Exchange Ticker",
    "Institutional cryptocurrency spot prices, orderbook tickers, and trade volume.",
    "Crypto & Blockchain",
    "https://api.exchange.coinbase.com",
    "None",
    "https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductticker",
    ["BTC-USD ticker", "GET", "/products/BTC-USD/ticker", "", { price: "96500.50", volume: "12450.8", product_id: "BTC-USD" }],
    true,
    ["Coinbase", "Trading", "Crypto"]
  ),
  api(
    "coinpaprika",
    "Coinpaprika Asset Directory",
    "Global directory of thousands of cryptocurrencies, contracts, and market metrics.",
    "Crypto & Blockchain",
    "https://api.coinpaprika.com/v1",
    "None",
    "https://docs.coinpaprika.com/",
    ["List coins", "GET", "/coins", "", [{ id: "btc-bitcoin", name: "Bitcoin", symbol: "BTC", rank: 1 }]],
    true,
    ["Coins", "Assets", "Blockchain"]
  ),
  api(
    "blockchain-info",
    "Blockchain.com Charts",
    "Bitcoin blockchain statistics, transaction volume, hash rates, and difficulty charts.",
    "Crypto & Blockchain",
    "https://api.blockchain.info",
    "None",
    "https://www.blockchain.com/explorer/api/charts_api",
    ["Market price chart", "GET", "/charts/market-price", "timespan=30days\nformat=json", { status: "ok", name: "Market Price (USD)", values: [] }],
    true,
    ["Blockchain", "Bitcoin", "HashRate"]
  ),

  // 15. Travel
  api(
    "zippopotam",
    "Zippopotam Geographic Places",
    "Global travel destinations, city lookup, postal geographic codes and coordinates.",
    "Travel",
    "https://api.zippopotam.us",
    "None",
    "https://www.zippopotam.us/",
    ["City & postal lookup", "GET", "/us/90210", "", { "post code": "90210", country: "United States", places: [{ "place name": "Beverly Hills", state: "California" }] }],
    true,
    ["Cities", "Destinations", "Travel", "Places"]
  ),
  api(
    "geocoding-travel",
    "Travel Geocoding Directory",
    "Instant worldwide city lookup, elevation, country codes, and geographical travel coordinates.",
    "Travel",
    "https://geocoding-api.open-meteo.com/v1",
    "None",
    "https://open-meteo.com/en/docs/geocoding-api",
    ["City search", "GET", "/search", "name=Paris", { results: [{ id: 2988507, name: "Paris", country: "France", latitude: 48.8534, longitude: 2.3488 }] }],
    true,
    ["Cities", "Coordinates", "Tourism"]
  ),

  // 16. Currency & Exchange Rates
  api(
    "frankfurter",
    "Frankfurter FX Exchange Rates",
    "European Central Bank reference foreign exchange rates and daily currency conversion.",
    "Currency & Exchange Rates",
    "https://api.frankfurter.dev/v1",
    "None",
    "https://frankfurter.dev/",
    ["Live exchange rates", "GET", "/latest", "base=USD\nsymbols=EUR,GBP,INR,JPY", { base: "USD", date: "2026-09-14", rates: { EUR: 0.92, GBP: 0.78, INR: 86.5, JPY: 152.4 } }],
    true,
    ["Forex", "Currency", "Conversion", "ECB"]
  ),
  api(
    "exchangerate-host",
    "ExchangeRate.host",
    "Global currency conversion rates covering 170+ fiat and digital currencies.",
    "Currency & Exchange Rates",
    "https://api.exchangerate.host",
    "Server-side key required",
    "https://exchangerate.host/documentation",
    ["Latest currency quotes", "GET", "/live", "source=USD", { success: true, quotes: { USDEUR: 0.92 } }],
    false,
    ["Currencies", "Forex"]
  ),

  // 17. Food & Restaurants
  api(
    "themealdb",
    "TheMealDB Recipes & Food",
    "Open culinary database of worldwide recipes, meal categories, and ingredients.",
    "Food & Restaurants",
    "https://www.themealdb.com/api/json/v1/1",
    "None",
    "https://www.themealdb.com/api.php",
    ["Random recipe", "GET", "/random.php", "", { meals: [{ idMeal: "52772", strMeal: "Teriyaki Chicken Casserole", strCategory: "Chicken" }] }],
    true,
    ["Cooking", "Recipes", "Food", "Culinary"]
  ),
  api(
    "openfoodfacts",
    "Open Food Facts Nutrition",
    "Global collaborative food database with ingredients, allergens, and nutritional scores.",
    "Food & Restaurants",
    "https://world.openfoodfacts.org/api/v2",
    "None",
    "https://openfoodfacts.github.io/api-documentation/",
    ["Product details", "GET", "/product/3017620422003.json", "", { status: 1, product: { product_name: "Nutella Hazelnut Spread", brands: "Ferrero" } }],
    true,
    ["Nutrition", "Ingredients", "Food"]
  ),

  // 18. Random/Fun APIs
  api(
    "jokeapi",
    "JokeAPI Programming Humor",
    "Curated programming and developer jokes, puns, and humorous one-liners.",
    "Random/Fun APIs",
    "https://v2.jokeapi.dev",
    "None",
    "https://jokeapi.dev/",
    ["Programming joke", "GET", "/joke/Programming", "type=single", { category: "Programming", joke: "There are 10 types of people in this world...", safe: true }],
    true,
    ["Humor", "Jokes", "Fun", "Developer"]
  ),
  api(
    "dog-ceo",
    "Dog CEO Canines",
    "Public open API for dog breed photography and canine classifications.",
    "Random/Fun APIs",
    "https://dog.ceo/api",
    "None",
    "https://dog.ceo/dog-api/documentation/",
    ["Random dog photo", "GET", "/breeds/image/random", "", { message: "https://images.dog.ceo/breeds/retriever-golden/n02099601_100.jpg", status: "success" }],
    true,
    ["Animals", "Dogs", "Photography"]
  ),
  api(
    "cat-facts",
    "Cat Facts Ninja",
    "Random facts, biology, and historical trivia about domestic and wild cats.",
    "Random/Fun APIs",
    "https://catfact.ninja",
    "None",
    "https://catfact.ninja/",
    ["Random cat fact", "GET", "/fact", "", { fact: "Cats sleep 70% of their lives.", length: 30 }],
    true,
    ["Animals", "Cats", "Trivia"]
  ),
  api(
    "bored",
    "Bored Activity Engine",
    "Creative suggestions, hobbies, and activities to combat boredom and learn new skills.",
    "Random/Fun APIs",
    "https://bored-api.appbrewery.com",
    "None",
    "https://bored-api.appbrewery.com/",
    ["Suggest activity", "GET", "/random", "", { activity: "Learn a new coding language or framework", type: "education" }],
    true,
    ["Fun", "Activities", "Productivity"]
  ),
  api(
    "numbers",
    "Numbers Trivia",
    "Fascinating mathematical facts, historical date trivia, and number lore.",
    "Random/Fun APIs",
    "http://numbersapi.com",
    "None",
    "http://numbersapi.com/",
    ["Number trivia", "GET", "/42/trivia", "json=true", { text: "42 is the answer to life, the universe, and everything.", number: 42, found: true }],
    true,
    ["Math", "Trivia", "Numbers"]
  )
];

export const categories = [
  "All",
  "Weather & Climate",
  "Finance, Stocks & Market Data",
  "News",
  "AI & Machine Learning",
  "Maps & Geolocation",
  "Countries & World Data",
  "Sports",
  "Movies & Entertainment",
  "GitHub & Developer Tools",
  "E-commerce & Products",
  "Education",
  "Government & Public Data",
  "Social Media",
  "Crypto & Blockchain",
  "Travel",
  "Currency & Exchange Rates",
  "Food & Restaurants",
  "Random/Fun APIs"
];
