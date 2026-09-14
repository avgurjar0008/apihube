import { useEffect, useMemo, useRef, useState } from "react";
import { apiCatalog, categories as CATEGORIES } from "./apiCatalog";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const NAV = ["Home", "APIs", "Tester", "Documentation", "Explore", "AI Assistant", "Learn", "History"];
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

export function getPublicGatewayBaseUrl() {
  if (typeof window !== "undefined") {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      if (import.meta.env.VITE_API_BASE_URL && !import.meta.env.VITE_API_BASE_URL.includes("localhost")) {
        return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");
      }
      return window.location.origin;
    }
  }
  return API_BASE_URL;
}

export function getAuthToken() {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("apihub_token") || "";
  }
  return "";
}

export function setAuthToken(token) {
  if (typeof localStorage !== "undefined") {
    if (token) localStorage.setItem("apihub_token", token);
    else localStorage.removeItem("apihub_token");
  }
}

export function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = { ...(options.headers || {}) };
  if (token && !headers["Authorization"] && !headers["authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, {
    ...options,
    credentials: "include",
    headers
  });
}

function readLocal(key) { try { const value=JSON.parse(localStorage.getItem(key)||"[]"); return Array.isArray(value)?value:[]; } catch { return []; } }
function writeLocal(key,value) { localStorage.setItem(key,JSON.stringify(value)); }

function parseHeaders(text) {
  const result = {};
  text.split("\n").forEach(line => {
    const i = line.indexOf(":");
    if (i < 1) return;
    result[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return result;
}

function Icon({ name }) {
  const icons = {
    home: "⌂", api: "◈", tester: "⌁", docs: "▤", explore: "◎", ai: "✦", learn: "◉", history: "↺", collection: "▦", settings: "⚙", plus: "+", arrow: "→", menu: "☰", star: "★"
  };
  return <span className="iconGlyph" aria-hidden="true">{icons[name] || "•"}</span>;
}

export function appendQueryParams(url, paramsStr = "") {
  if (!paramsStr || typeof paramsStr !== "string") return url;
  const lines = paramsStr.split("\n").map(s => s.trim()).filter(Boolean);
  if (!lines.length) return url;
  try {
    const u = new URL(url);
    for (const line of lines) {
      const [k, ...rest] = line.split("=");
      if (k && !u.searchParams.has(k.trim())) {
        u.searchParams.set(k.trim(), rest.join("=").trim());
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function isHintDismissed(hintId) {
  try {
    const raw = sessionStorage.getItem("apihub_dismissed_ai_hints");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) && arr.includes(hintId);
  } catch {
    return false;
  }
}

export function dismissHintInStorage(hintId) {
  try {
    const raw = sessionStorage.getItem("apihub_dismissed_ai_hints");
    const arr = raw ? JSON.parse(raw) : [];
    if (!arr.includes(hintId)) {
      arr.push(hintId);
      sessionStorage.setItem("apihub_dismissed_ai_hints", JSON.stringify(arr));
    }
  } catch {}
}

export function formatUserGreetingName(user) {
  if (!user) return "Developer";
  const name = (user.name || "").trim();
  if (name) {
    return name
      .split(/\s+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  // Safe fallback if name is unavailable: NEVER expose email domain or raw email
  if (user.email && typeof user.email === "string") {
    const local = user.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").trim();
    if (local && local.length >= 2) {
      return local
        .split(/\s+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
    }
  }
  return "Developer";
}

export function getRouteFromUrl() {
  if (typeof window === "undefined") return { page: "Home" };
  try {
    const sp = new URLSearchParams(window.location.search);
    const page = sp.get("page") || "Home";
    const catalogId = sp.get("catalogId") || null;
    const apiId = sp.get("apiId") || null;
    const method = sp.get("method") || null;
    const url = sp.get("url") || null;
    return { page, catalogId, apiId, method, url };
  } catch {
    return { page: "Home" };
  }
}

export function buildRouteUrl(page, data = null) {
  try {
    const sp = new URLSearchParams();
    if (page && page !== "Home") {
      sp.set("page", page);
    }
    const catalogId = data?.catalogId || (page === "API Details" || page === "Catalog Details" ? data?.catalogId : null);
    const apiId = data?.apiId || (page === "API Details" || page === "Create Endpoint" ? data?.apiId : null);
    if (catalogId) sp.set("catalogId", catalogId);
    if (apiId) sp.set("apiId", apiId);
    if (page === "Tester" && data?.url) {
      sp.set("url", data.url);
      if (data.method) sp.set("method", data.method);
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : window.location.pathname;
  } catch {
    return window.location.pathname;
  }
}

export function AiHintTrigger({
  hintId,
  title = "AI Insight",
  text,
  aiPrompt,
  onLearnMore,
  align = "right",
  position = "bottom",
  label = "AI Tip",
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => isHintDismissed(hintId));
  const hoverTimerRef = useRef(null);

  const handleMouseEnter = () => {
    if (isDismissed) return;
    hoverTimerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsOpen(false);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    e.preventDefault();
    dismissHintInStorage(hintId);
    setIsDismissed(true);
    setIsOpen(false);
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(v => !v);
  };

  const handleLearnMoreAction = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
    if (onLearnMore && aiPrompt) {
      onLearnMore(aiPrompt);
    }
  };

  return (
    <div
      className="aiHintContainer"
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className={`aiHintBadge ${isOpen ? "active" : ""}`}
        onClick={handleToggleClick}
        aria-label={`AI suggestion: ${title}`}
        title="AI Assistant Suggestion"
      >
        <span className="aiHintDot">✦</span>
        {label && <span className="aiHintLabel">{label}</span>}
      </button>

      {isOpen && (
        <div
          className={`aiHintPopup pos-${position} align-${align}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="aiHintHeader">
            <div className="aiHintTitle">
              <span className="aiHintIcon">✦</span>
              <strong>{title}</strong>
            </div>
            <button
              type="button"
              className="aiHintClose"
              onClick={handleDismiss}
              aria-label="Dismiss this tip for the session"
              title="Dismiss tip"
            >
              ×
            </button>
          </div>
          <div className="aiHintBody">
            <p>{text}</p>
          </div>
          <div className="aiHintFooter">
            <button
              type="button"
              className="aiHintLearnMoreBtn"
              onClick={handleLearnMoreAction}
            >
              Learn more with AI →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function generateJsCode(method = "GET", fullUrl = "", body = null) {
  const m = String(method).toUpperCase();
  const isGetOrHead = ["GET", "HEAD"].includes(m);
  const headerLines = [
    '    "X-API-Key": "YOUR_APIHUB_API_KEY"'
  ];
  if (body && !isGetOrHead) {
    headerLines.push('    "Content-Type": "application/json"');
  }

  if (isGetOrHead || !body) {
    return `fetch("${fullUrl}", {\n  method: "${m}",\n  headers: {\n${headerLines.join(",\n")}\n  }\n})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
  }

  let bodyStr = "null";
  try {
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    bodyStr = JSON.stringify(parsed, null, 2)
      .split("\n")
      .map((line, i) => (i === 0 ? line : `  ${line}`))
      .join("\n");
  } catch {
    bodyStr = JSON.stringify(body);
  }

  return `fetch("${fullUrl}", {\n  method: "${m}",\n  headers: {\n${headerLines.join(",\n")}\n  },\n  body: JSON.stringify(${bodyStr})\n})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
}

export function generatePythonCode(method = "GET", fullUrl = "", body = null) {
  const m = String(method).toLowerCase();
  const hasBody = !["get", "head"].includes(m) && body;

  let bodyArg = "";
  if (hasBody) {
    try {
      const parsed = typeof body === "string" ? JSON.parse(body) : body;
      const formatted = JSON.stringify(parsed, null, 4)
        .replace(/: null/g, ": None")
        .replace(/: true/g, ": True")
        .replace(/: false/g, ": False");
      bodyArg = `,\n    json=${formatted.split("\n").map((line, i) => (i === 0 ? line : `    ${line}`)).join("\n")}`;
    } catch {
      bodyArg = `,\n    data=${JSON.stringify(body)}`;
    }
  }

  return `import requests\n\nurl = "${fullUrl}"\nheaders = {\n    "X-API-Key": "YOUR_APIHUB_API_KEY"\n}\n\nresponse = requests.${m}(\n    url,\n    headers=headers${bodyArg}\n)\n\nprint(response.status_code)\nprint(response.json())`;
}

export function generateCurlCode(method = "GET", fullUrl = "", body = null) {
  const upper = String(method).toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(upper) && body;

  let bodySnippet = "";
  if (hasBody) {
    const minified = typeof body === "string" ? body.trim() : JSON.stringify(body);
    bodySnippet = ` \\\n  -H "Content-Type: application/json" \\\n  -d '${minified.replace(/'/g, "'\\''")}'`;
  }

  return `curl -X ${upper} \\\n  "${fullUrl}" \\\n  -H "X-API-Key: YOUR_APIHUB_API_KEY"${bodySnippet}`;
}

export default function App() {
  const initialRoute = typeof window !== "undefined" ? getRouteFromUrl() : { page: "Home" };
  const [page, setPage] = useState(initialRoute.page || "Home");
  const [selectedApiId, setSelectedApiId] = useState(initialRoute.apiId || null);
  const [selectedCatalogId, setSelectedCatalogId] = useState(initialRoute.catalogId || null);
  const [method, setMethod] = useState(initialRoute.method || "GET");
  const [url, setUrl] = useState(initialRoute.url || "https://jsonplaceholder.typicode.com/posts/1");
  const [headers, setHeaders] = useState("Content-Type: application/json");
  const [body, setBody] = useState("");
  const [params, setParams] = useState([{ key: "", value: "", enabled: true }]);
  const [tab, setTab] = useState("Params");
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [savedRequests, setSavedRequests] = useState(() => {
    try {
      return readLocal("apihub_saved_requests");
    } catch {
      return [];
    }
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", text: "Hi! I’m your API Assistant. I can explain requests, responses, errors, headers and help you build an API call." }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userApis, setUserApis] = useState(() => readLocal("apihub_apis"));
  const [userEndpoints, setUserEndpoints] = useState(() => readLocal("apihub_endpoints"));
  const [toast, setToast] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function copyToClipboard(text, label = "Copied to clipboard!") {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast(label);
  }

  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/auth/me`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
          setAuthToken("");
        }
      })
      .catch(() => {
        setCurrentUser(null);
        setAuthToken("");
      });
  }, []);

  useEffect(() => {
    function handlePopState(e) {
      const state = e.state || getRouteFromUrl();
      applyNavigation(state.page || "Home", state, { skipHistory: true });
    }
    window.addEventListener("popstate", handlePopState);

    const initial = getRouteFromUrl();
    const currentUrl = buildRouteUrl(initial.page, initial);
    window.history.replaceState(
      {
        page: initial.page,
        catalogId: initial.catalogId,
        apiId: initial.apiId,
        method: initial.method,
        url: initial.url
      },
      "",
      currentUrl
    );

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (currentUser) {
      authFetch(`${API_BASE_URL}/api/my-apis`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.data)) {
            setUserApis(data.data);
            writeLocal("apihub_apis", data.data);
          }
        })
        .catch(() => {});

      authFetch(`${API_BASE_URL}/api/saved-requests`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.data)) {
            setSavedRequests(data.data);
            writeLocal("apihub_saved_requests", data.data);
          }
        })
        .catch(() => {});

      authFetch(`${API_BASE_URL}/api/requests/history`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.data)) {
            setHistory(data.data);
          }
        })
        .catch(() => {});
    } else {
      setUserApis(readLocal("apihub_apis"));
      setUserEndpoints(readLocal("apihub_endpoints"));
      setSavedRequests(readLocal("apihub_saved_requests"));
    }
  }, [currentUser]);

  async function signOut() {
    try {
      await authFetch(`${API_BASE_URL}/api/auth/signout`, { method: "POST" });
    } catch {}
    setAuthToken("");
    setCurrentUser(null);
    setUserApis(readLocal("apihub_apis"));
    setUserEndpoints(readLocal("apihub_endpoints"));
    navigate("Home");
  }

  async function handleDeleteApi(idToDelete) {
    if (!window.confirm("Delete this API and all its endpoints? This action cannot be undone.")) return;

    if (currentUser) {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/my-apis/${idToDelete}`, {
          method: "DELETE"
        });
        const d = await res.json();
        if (!res.ok) {
          alert(d.message || "Unable to delete API from server.");
          return;
        }
      } catch {
        // Fallback to local delete
      }
    }

    const updatedApis = userApis.filter(a => a.id !== idToDelete);
    setUserApis(updatedApis);
    writeLocal("apihub_apis", updatedApis);

    const updatedEndpoints = userEndpoints.filter(e => e.apiId !== idToDelete);
    setUserEndpoints(updatedEndpoints);
    writeLocal("apihub_endpoints", updatedEndpoints);

    navigate("APIs");
  }

  const responseText = useMemo(() => {
    if (!response) return "// Send a request to inspect the response here.";
    return typeof response.body === "string" ? response.body : JSON.stringify(response.body, null, 2);
  }, [response]);

  function applyNavigation(next, data = null, options = {}) {
    setPage(next);
    setMobileOpen(false);

    if (next === "API Details") {
      setSelectedApiId(data?.apiId ?? null);
      setSelectedCatalogId(data?.catalogId ?? null);
    }
    if (next === "Create Endpoint") {
      setSelectedApiId(data?.apiId ?? null);
    }
    if (next === "Catalog Details") {
      setSelectedCatalogId(data?.catalogId ?? null);
      setSelectedApiId(null);
    }

    if (next === "AI Assistant") {
      setAiOpen(true);
    }

    let effectiveUrl = data?.url;

    if (next === "Tester" && data) {
      if (data.savedRequest) {
        const request = data.savedRequest;
        setMethod(request.method || "GET");
        setUrl(request.url || "");
        effectiveUrl = request.url || "";
        setHeaders(typeof request.headers === "string" ? request.headers : "");
        setBody(typeof request.body === "string" ? request.body : "");
        setParams(Array.isArray(request.params)
          ? request.params.map(param => ({
              key: String(param?.key || ""),
              value: String(param?.value || ""),
              enabled: param?.enabled !== false
            }))
          : []);
      } else {
        if (data.method) setMethod(data.method);

        const baseUrl = (data.baseUrl || "").trim().replace(/\/+$/, "");
        const path = (data.path || "").trim().replace(/^\/+/, "");
        const fullUrl = data.url
          ? data.url
          : (baseUrl && path ? `${baseUrl}/${path}` : (baseUrl || (path ? `/${path}` : "")));

        if (fullUrl) {
          setUrl(fullUrl);
          effectiveUrl = fullUrl;
        }

        if (data.parameters) {
          const paramsList = data.parameters
            .split("\n")
            .map(item => item.trim())
            .filter(Boolean)
            .map(item => {
              const [key, ...valueParts] = item.split("=");
              return {
                key: key.trim(),
                value: valueParts.join("=").trim(),
                enabled: true
              };
            });

          setParams(paramsList);
          if (paramsList.length > 0) {
            setTab("Params");
          }
        } else if (Array.isArray(data.params)) {
          setParams(data.params);
        } else {
          setParams([]);
        }

        const reqBody = Object.prototype.hasOwnProperty.call(data, "body")
          ? data.body
          : (Object.prototype.hasOwnProperty.call(data, "requestBody") ? data.requestBody : "");

        const formattedBody = typeof reqBody === "string" ? reqBody : (reqBody ? JSON.stringify(reqBody, null, 2) : "");
        setBody(formattedBody);

        if (formattedBody && ["POST", "PUT", "PATCH"].includes((data.method || "").toUpperCase())) {
          setTab("Body");
        }
      }
    }

    if (!options.skipHistory && typeof window !== "undefined") {
      const historyData = {
        ...data,
        url: effectiveUrl || data?.url,
        method: data?.method || (next === "Tester" ? method : undefined)
      };
      const routeUrl = buildRouteUrl(next, historyData);
      const stateObj = {
        page: next,
        catalogId: data?.catalogId ?? null,
        apiId: data?.apiId ?? null,
        method: historyData.method ?? null,
        url: historyData.url ?? null
      };
      window.history.pushState(stateObj, "", routeUrl);
    }
  }

  function navigate(next, data = null) {
    applyNavigation(next, data, { skipHistory: false });
  }

  function openAiWithPrompt(prompt) {
    if (!prompt) return;
    setAiOpen(true);
    askAI(prompt);
  }

  function buildUrl() {
    try {
      const u = new URL(url);
      params.filter(p => p.enabled && p.key.trim()).forEach(p => u.searchParams.set(p.key.trim(), p.value));
      return u.toString();
    } catch { return url; }
  }

  async function sendRequest() {
    setLoading(true); setError(""); setResponse(null);
    try {
      const finalUrl = buildUrl();
      const r = await authFetch(`${API_BASE_URL}/api/requests/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, url: finalUrl, headers: parseHeaders(headers), body })
      });
      const payload = await r.json();
      if (!payload.success) throw new Error(payload.message || "Request failed.");
      setResponse(payload.data);
      setHistory(h => [{ id: crypto.randomUUID(), method, url: finalUrl, status: payload.data.status, time: payload.data.responseTimeMs }, ...h].slice(0, 12));
    } catch (e) { setError(e.message || "Something went wrong."); }
    finally { setLoading(false); }
  }
  async function saveRequest() {
    const newReq = {
      id: crypto.randomUUID(),
      method,
      url,
      headers,
      body,
      params
    };

    if (currentUser) {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/saved-requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newReq)
        });
        const d = await res.json();
        if (d.success && d.data) {
          const saved = [d.data, ...savedRequests.filter(r => r.id !== d.data.id)];
          writeLocal("apihub_saved_requests", saved);
          setSavedRequests(saved);
          showToast("Request saved to your account!");
          return;
        }
      } catch {
        // Fallback to local
      }
    }

    const saved = [newReq, ...savedRequests];
    writeLocal("apihub_saved_requests", saved);
    setSavedRequests(saved);
    showToast("Request saved locally!");
  }

  function openSavedRequest(request) {
    navigate("Tester", { savedRequest: request });
  }

  async function deleteSavedRequest(index) {
    const itemToDelete = savedRequests[index];
    if (currentUser && itemToDelete?.id) {
      try {
        await authFetch(`${API_BASE_URL}/api/saved-requests/${itemToDelete.id}`, {
          method: "DELETE"
        });
      } catch {
        // Fallback
      }
    }

    const updated = savedRequests.filter((_, requestIndex) => requestIndex !== index);
    writeLocal("apihub_saved_requests", updated);
    setSavedRequests(updated);
    showToast("Saved request deleted.");
  }

  async function clearSavedRequests() {
    if (!window.confirm("Clear all saved requests? This cannot be undone.")) return;
    if (currentUser) {
      try {
        await authFetch(`${API_BASE_URL}/api/saved-requests`, {
          method: "DELETE"
        });
      } catch {
        // Fallback
      }
    }
    localStorage.removeItem("apihub_saved_requests");
    setSavedRequests([]);
    showToast("All saved requests cleared.");
  }
  async function askAI(text = aiInput) {
    const q = (text || aiInput).trim();
    if (!q) return;
    setAiMessages(m => [...m, { role: "user", text: q }]);
    setAiInput("");
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          context: { method, url, headers, body },
          lastResponse: response ? {
            status: response.status,
            statusText: response.statusText,
            responseTimeMs: response.responseTimeMs,
            data: response.data
          } : null
        })
      });
      const data = await res.json();
      if (data && data.success && data.text) {
        setAiMessages(m => [...m, { role: "assistant", text: data.text }]);
      } else {
        setAiMessages(m => [...m, { role: "assistant", text: data?.message || "Could not retrieve response from AI assistant." }]);
      }
    } catch (err) {
      setAiMessages(m => [...m, { role: "assistant", text: "Error contacting AI Assistant service: " + err.message }]);
    } finally {
      setAiLoading(false);
    }
  }

  return <div className="appShell">
    <header className="topbar">
      <div className="brand" onClick={() => navigate("Home")}><div className="logoMark"><span>API</span></div><div><strong>APIHub</strong><small>Build · Test · Understand APIs</small></div></div>
      <nav className="desktopNav">{NAV.map(item => <button key={item} className={page === item ? "navItem active" : "navItem"} onClick={() => navigate(item)}>{item}</button>)}</nav>
      <div className="topActions"><button className="aiTop" onClick={() => setAiOpen(true)}><Icon name="ai"/> AI Assistant</button>{currentUser ? <><button className="signin" onClick={() => navigate("Dashboard")}>Dashboard</button><button className="signin" onClick={signOut}>Sign out</button></> : <button className="signin" onClick={() => navigate("Sign In")}>Sign in</button>}<button className="mobileMenu" onClick={() => setMobileOpen(v => !v)}><Icon name="menu"/></button></div>
    </header>
    {mobileOpen && (
      <div className="mobileNav">
        {NAV.map(item => (
          <button key={item} className={page === item ? "active" : ""} onClick={() => navigate(item)}>
            {item}
          </button>
        ))}
        <div style={{ height: "1px", background: "var(--line)", margin: "8px 0" }} />
        {currentUser ? (
          <>
            <button onClick={() => navigate("Dashboard")}>
              <Icon name="settings" /> Dashboard ({currentUser.email})
            </button>
            <button onClick={signOut} style={{ color: "var(--danger)" }}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate("Sign In")}>Sign In</button>
            <button onClick={() => navigate("Sign Up")} style={{ color: "var(--cyan)", fontWeight: "bold" }}>
              Create Free Account →
            </button>
          </>
        )}
      </div>
    )}

    {(() => {
      switch (page) {
        case "Home": return <Home navigate={navigate} apiCatalog={apiCatalog} onLearnMore={openAiWithPrompt} onOpenReview={() => setReviewModalOpen(true)} reviewRefreshKey={reviewRefreshKey} />;
        case "Tester": return <Tester {...{method,setMethod,url,setUrl,headers,setHeaders,body,setBody,tab,setTab,response,error,loading,sendRequest,responseText,params,setParams,history,navigate,setAiOpen,saveRequest,onLearnMore:openAiWithPrompt}}/>;
        case "APIs": return <Apis navigate={navigate} catalog={apiCatalog} myApis={userApis} currentUser={currentUser} onDeleteApi={handleDeleteApi} showToast={showToast} copyToClipboard={copyToClipboard} onLearnMore={openAiWithPrompt} />;
        case "API Details": return <APIDetails navigate={navigate} apiId={selectedApiId} catalogId={selectedCatalogId} currentUser={currentUser} userApis={userApis} onDeleteApi={handleDeleteApi} showToast={showToast} copyToClipboard={copyToClipboard} onLearnMore={openAiWithPrompt} />;
        case "Create API": return <CreateAPI navigate={navigate} currentUser={currentUser} onApiCreated={api => setUserApis(prev => [api, ...prev.filter(x => x.id !== api.id)])} />;
        case "Sign In": return <AccountPage navigate={navigate} mode="signin" onAuthenticated={setCurrentUser} showToast={showToast}/>;
        case "Sign Up": return <AccountPage navigate={navigate} mode="signup" onAuthenticated={setCurrentUser} showToast={showToast}/>;
        case "Dashboard": return <Dashboard navigate={navigate} user={currentUser} showToast={showToast} copyToClipboard={copyToClipboard} onLearnMore={openAiWithPrompt} />;
        case "Create Endpoint": return <CreateEndpoint navigate={navigate} apiId={selectedApiId} currentUser={currentUser} userApis={userApis} onEndpointCreated={ep => setUserEndpoints(prev => [ep, ...prev.filter(x => x.id !== ep.id)])} />;
        case "Explore": return <Apis navigate={navigate} catalog={apiCatalog} myApis={userApis} currentUser={currentUser} onDeleteApi={handleDeleteApi} showToast={showToast} copyToClipboard={copyToClipboard} explore={true} onLearnMore={openAiWithPrompt} />;
        case "Catalog Details": return <APIDetails navigate={navigate} apiId={selectedApiId} catalogId={selectedCatalogId} currentUser={currentUser} userApis={userApis} onDeleteApi={handleDeleteApi} showToast={showToast} copyToClipboard={copyToClipboard} onLearnMore={openAiWithPrompt} />;
        case "Documentation": return <Documentation navigate={navigate} currentUser={currentUser} showToast={showToast} copyToClipboard={copyToClipboard} onLearnMore={openAiWithPrompt} />;
        case "Learn": return <Learn navigate={navigate} askAI={askAI} onLearnMore={openAiWithPrompt} />;
        case "History": return <History savedRequests={savedRequests} onOpenRequest={openSavedRequest} onDeleteRequest={deleteSavedRequest} onClearRequests={clearSavedRequests}/>;
        case "AI Assistant": return <AssistantPage navigate={navigate} askAI={askAI} aiMessages={aiMessages} aiInput={aiInput} setAiInput={setAiInput} aiLoading={aiLoading}/>;
        case "Privacy": return <Privacy navigate={navigate}/>;
        default: return <Placeholder title={page} navigate={navigate}/>;
      }
    })()}

    {aiOpen && <aside className="aiPanel">
      <div className="aiPanelHead"><div><span className="eyebrow">APIHUB INTELLIGENCE</span><h3><Icon name="ai"/> API Assistant</h3></div><button className="close" onClick={() => setAiOpen(false)}>×</button></div>
      <div className="aiStatus"><span className="onlineDot"/> Ready to help with your API workflow</div>
      <div className="aiChat">
        {aiMessages.map((m,i)=><div key={i} className={m.role === "user" ? "bubble user" : "bubble assistant"}>{m.text}</div>)}
        {aiLoading && <div className="bubble assistant" style={{ fontStyle: "italic", opacity: 0.7 }}>Thinking…</div>}
      </div>
      <div className="aiSuggestions"><button onClick={() => askAI("Explain my current request")}>Explain request</button><button onClick={() => askAI("Explain the response")}>Explain response</button><button onClick={() => askAI("How do I add headers?")}>Headers help</button></div>
      <div className="aiInput"><input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()} placeholder="Ask anything about this API..."/><button onClick={() => askAI()}><Icon name="arrow"/></button></div>
    </aside>}

    {toast && <div className="toastNotification"><span>✓</span> {toast}</div>}

    <Footer navigate={navigate} currentUser={currentUser} signOut={signOut} onOpenReview={() => setReviewModalOpen(true)} />

    <ReviewModal
      isOpen={reviewModalOpen}
      onClose={() => setReviewModalOpen(false)}
      currentUser={currentUser}
      navigate={navigate}
      onReviewSubmitted={() => {
        setReviewRefreshKey(k => k + 1);
        showToast("Review submitted successfully!");
      }}
      showToast={showToast}
    />
  </div>;
}

function renderStars(rating, max = 5) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    stars.push(
      <span key={i} style={{ color: i <= rating ? "#ffc233" : "#324359" }}>
        ★
      </span>
    );
  }
  return stars;
}

function ReviewModal({ isOpen, onClose, currentUser, navigate, onReviewSubmitted, showToast }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [feature, setFeature] = useState("Overall APIHub");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const currentActiveRating = hoverRating || rating;
  const ratingLabels = {
    5: "5 - Exceptional",
    4: "4 - Very Good",
    3: "3 - Good",
    2: "2 - Fair",
    1: "1 - Needs Improvement"
  };

  const authorDisplayName = currentUser?.name
    ? currentUser.name
    : (currentUser?.email ? currentUser.email.split("@")[0] : "Developer");

  async function handleSubmit(e) {
    e?.preventDefault();
    const cleanText = review.trim();
    if (cleanText.length < 10) {
      setError("Review must be at least 10 characters.");
      return;
    }
    if (cleanText.length > 1000) {
      setError("Review cannot exceed 1000 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await authFetch(`${API_BASE_URL}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review: cleanText, feature })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Unable to submit your review. Please try again.");
      }
      setSuccess(true);
      if (onReviewSubmitted) onReviewSubmitted();
      setTimeout(() => {
        setSuccess(false);
        setReview("");
        setRating(5);
        onClose();
      }, 1400);
    } catch (err) {
      setError(err.message || "Unable to submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modalOverlay" onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="reviewModalCard" role="dialog" aria-modal="true" aria-labelledby="modalReviewTitle">
        <button className="modalClose" onClick={onClose} aria-label="Close review dialog" disabled={submitting}>×</button>

        {!currentUser ? (
          <div className="reviewAuthNotice">
            <span className="authNoticeBadge">✦ Verified Developer Reviews</span>
            <h2 id="modalReviewTitle">Sign in to share your review</h2>
            <p>
              To keep APIHub reviews genuine, authenticated accounts are required to submit ratings and feedback.
            </p>
            <div className="reviewAuthBtns">
              <button
                className="primaryBtn"
                onClick={() => {
                  onClose();
                  navigate("Sign In");
                }}
              >
                Sign In
              </button>
              <button
                className="secondaryBtn"
                onClick={() => {
                  onClose();
                  navigate("Sign Up");
                }}
              >
                Create Free Account <Icon name="arrow" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 id="modalReviewTitle">Write a Developer Review</h2>
            <p className="reviewModalSubtitle">
              Share your experience with APIHub to help other engineers evaluate and build faster.
            </p>

            {success ? (
              <div className="successBox" style={{ margin: "20px 0", textAlign: "center", padding: "20px" }}>
                <strong>✓ Review submitted successfully!</strong>
                <p style={{ margin: "8px 0 0", color: "#8be4c6", fontSize: "11px" }}>
                  Thank you for contributing to the APIHub developer community.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="reviewFormRow">
                  <label id="ratingLabel">Your Rating</label>
                  <div
                    className="interactiveStarsRow"
                    role="radiogroup"
                    aria-labelledby="ratingLabel"
                  >
                    <div className="starPicker">
                      {[1, 2, 3, 4, 5].map(starNum => (
                        <button
                          key={starNum}
                          type="button"
                          role="radio"
                          aria-checked={rating === starNum}
                          aria-label={`${starNum} star${starNum > 1 ? "s" : ""}`}
                          className={`starBtn ${starNum <= currentActiveRating ? "active" : ""}`}
                          onClick={() => setRating(starNum)}
                          onMouseEnter={() => setHoverRating(starNum)}
                          onMouseLeave={() => setHoverRating(0)}
                          onKeyDown={e => {
                            if (e.key === "ArrowRight" && starNum < 5) setRating(starNum + 1);
                            if (e.key === "ArrowLeft" && starNum > 1) setRating(starNum - 1);
                          }}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <span className="ratingDescriptor">
                      {ratingLabels[currentActiveRating] || `${currentActiveRating} Stars`}
                    </span>
                  </div>
                </div>

                <div className="reviewFormRow">
                  <label htmlFor="reviewFeatureSelect">Feature / Workflow Area</label>
                  <select
                    id="reviewFeatureSelect"
                    value={feature}
                    onChange={e => setFeature(e.target.value)}
                  >
                    <option value="Overall APIHub">Overall APIHub</option>
                    <option value="API Gateway">API Gateway</option>
                    <option value="API Tester">API Tester</option>
                    <option value="API Documentation">API Documentation</option>
                    <option value="Learn">Learning Center</option>
                    <option value="AI Assistant">AI Assistant</option>
                    <option value="API Marketplace">API Marketplace</option>
                    <option value="API Key Management">API Key Management</option>
                  </select>
                </div>

                <div className="reviewFormRow">
                  <label htmlFor="reviewTextarea">Your Review</label>
                  <textarea
                    id="reviewTextarea"
                    value={review}
                    onChange={e => {
                      setReview(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="What did you build? How did APIHub help with latency, testing, gateway keys, or API documentation?"
                    maxLength={1000}
                  />
                  <div className={`charCountRow ${review.trim().length >= 10 ? "valid" : (review.length > 0 ? "invalid" : "")}`}>
                    <span>Minimum 10 characters</span>
                    <span>{review.length} / 1000</span>
                  </div>
                </div>

                <div className="identityCallout">
                  Posting publicly as: <strong>{authorDisplayName}</strong> · Verified Developer
                  <br />
                  <span style={{ color: "#5d7088", fontSize: "8.5px" }}>
                    Your private email address is never stored in reviews or shown publicly.
                  </span>
                </div>

                {error && <div className="errorBox" style={{ marginBottom: "16px" }}>{error}</div>}

                <div className="reviewModalActions">
                  <button
                    type="button"
                    className="secondaryBtn"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primaryBtn"
                    disabled={submitting || review.trim().length < 10}
                  >
                    {submitting ? "Submitting..." : "Submit Review"} <Icon name="arrow" />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewsSection({ onOpenReview, refreshKey }) {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    percentages: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch(`${API_BASE_URL}/api/reviews?page=1&limit=6&sort=newest`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!isMounted) return;
        if (data?.success) {
          setReviews(data.reviews || []);
          if (data.summary) setSummary(data.summary);
          setHasMore(Boolean(data.pagination?.hasMore));
          setPage(1);
        }
      })
      .catch(() => {
        // Graceful error fallback - do not crash page
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [refreshKey]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews?page=${nextPage}&limit=6&sort=newest`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.reviews)) {
        setReviews(prev => [...prev, ...data.reviews]);
        setPage(nextPage);
        setHasMore(Boolean(data.pagination?.hasMore));
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoadingMore(false);
    }
  }

  const scoreDisplay = summary.averageRating > 0 ? summary.averageRating.toFixed(1) : "5.0";

  return (
    <section className="reviewsSection" aria-label="Developer Reviews & Ratings">
      <div className="reviewsSectionHeader">
        <div>
          <div className="eyebrow">DEVELOPER REVIEWS</div>
          <h2>What developers say about APIHub</h2>
          <p>
            Real feedback from developers using APIHub for API discovery, automated testing, gateway key management, and documentation.
          </p>
        </div>
        <button className="primaryBtn" onClick={onOpenReview}>
          <Icon name="star" /> Write a Review
        </button>
      </div>

      <div className="ratingSummaryCard">
        <div className="ratingScoreCol">
          <div className="bigScoreNum">{scoreDisplay}</div>
          <div className="starsDisplay">{renderStars(Math.round(summary.averageRating || 5))}</div>
          <div className="ratingCountSub">
            {summary.totalReviews > 0
              ? `Based on ${summary.totalReviews} developer review${summary.totalReviews === 1 ? "" : "s"}`
              : "No reviews yet — be the first!"}
          </div>
        </div>

        <div className="ratingBarsCol">
          {[5, 4, 3, 2, 1].map(starNum => (
            <div key={starNum} className="ratingBarRow">
              <span>{starNum} ★</span>
              <div className="ratingBarTrack">
                <div
                  className="ratingBarFill"
                  style={{ width: `${summary.percentages?.[starNum] || 0}%` }}
                />
              </div>
              <span className="ratingBarCount">({summary.distribution?.[starNum] || 0})</span>
            </div>
          ))}
        </div>

        <div className="ratingCtaCol">
          <p>Help other developers build better by sharing your experience.</p>
          <button className="secondaryBtn" onClick={onOpenReview} style={{ width: "100%", justifyContent: "center" }}>
            Share Your Experience
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#8293aa", fontSize: "11px" }}>
          Loading reviews...
        </div>
      ) : reviews.length === 0 ? (
        <div className="emptyReviewsCard">
          <span className="emptyReviewsIcon">★</span>
          <h3>No reviews yet</h3>
          <p>Be the first developer to share your experience with APIHub.</p>
          <button className="primaryBtn" onClick={onOpenReview}>
            <Icon name="star" /> Write the First Review
          </button>
        </div>
      ) : (
        <>
          <div className="reviewsGrid">
            {reviews.map(item => {
              const initials = (item.name || "D")
                .split(" ")
                .map(s => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              const formattedDate = item.created_at
                ? new Date(item.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })
                : "Recently";

              return (
                <article key={item.id} className="reviewCard">
                  <div>
                    <div className="reviewCardTop">
                      <div className="starsDisplay">{renderStars(item.rating)}</div>
                      <span className="reviewFeatureBadge">{item.feature || "Overall APIHub"}</span>
                    </div>
                    <p className="reviewBodyText">"{item.review}"</p>
                  </div>

                  <div className="reviewerMeta">
                    <div className="reviewerAvatar">{initials}</div>
                    <div className="reviewerDetails">
                      <div className="reviewerNameRow">
                        <strong>{item.name}</strong>
                        <span className="verifiedDevBadge">✓ Verified Dev</span>
                      </div>
                      <span className="reviewDate">{formattedDate}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {hasMore && (
            <div className="loadMoreReviewsWrap">
              <button
                className="loadMoreBtn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load More Reviews ↓"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Home({navigate, apiCatalog, onLearnMore, onOpenReview, reviewRefreshKey}) {
  return <main className="homePage">
    <section className="heroHome"><div className="heroCopy"><div className="eyebrow">THE API WORKSPACE FOR BUILDERS</div><h1>Build, explore & <span>test APIs</span> in one place.</h1><p>Discover APIs, test endpoints, create your own API documentation and use AI to understand what is happening behind every request.</p><div className="heroButtons"><button className="primaryBtn" onClick={() => navigate("Create API")}>Start Testing <Icon name="arrow"/></button><button className="secondaryBtn" onClick={() => navigate("Explore")}>Explore APIs</button></div><div className="trustLine"><span>● No setup required</span><span>● Developer focused</span><span>● Student friendly</span></div></div><div className="heroVisual"><div className="orb orbOne"/><div className="orb orbTwo"/><div className="miniTerminal"><div className="terminalTop"><span/> <span/> <span/><b>API Request</b></div><div className="requestLine"><em>GET</em><code>/api/users?limit=5</code><strong>200 OK</strong></div><div className="codeLine">{`{ "users": [ ... ] }`}</div><div className="terminalStats"><span>124 ms</span><span>1.8 KB</span><span>JSON</span></div></div></div></section>
    <section className="featureGrid"><Feature icon="api" title="API Provider" text="Create, manage and publish APIs with endpoints, responses, authentication and documentation."/><Feature icon="tester" title="API Testing" text="Build requests with params, headers and bodies, then inspect status, timing and response data."/><Feature icon="docs" title="Documentation" text="Turn every endpoint into clear developer documentation with examples and a Try API flow."/><Feature icon="explore" title="API Explorer" text="Discover useful APIs by category and open them directly in the testing workspace."/></section>
    <section className="workflowSection"><div><div className="eyebrow">HOW APIHUB CONNECTS THE WORKFLOW</div><h2>From API discovery to a working request.</h2><p>APIHub keeps the core developer workflow together. Explore an API, understand its docs, test it, then use the response in your project.</p></div><div className="workflow"><Step n="01" title="Discover" text="Find an API or create your own."/><Step n="02" title="Understand" text="Read endpoints, parameters and examples."/><Step n="03" title="Test" text="Send requests and inspect responses."/><Step n="04" title="Build" text="Take the API into your application."/></div></section>
    <section className="showcase"><div><div className="eyebrow">POWERFUL BY DESIGN</div><h2>Your API workbench, without the clutter.</h2><p>Keep requests, collections, history, documentation and AI guidance close to the work you are doing.</p><button className="textBtn" onClick={() => navigate("Tester")}>Open API Tester <Icon name="arrow"/></button></div><div className="darkCard"><div className="darkCardHeader"><span>REQUEST</span><span className="successBadge">200 OK</span></div><div className="darkUrl"><b>GET</b> https://api.example.com/users</div><div className="darkTabs"><span className="selected">Params</span><span>Headers</span><span>Body</span><span>Auth</span></div><div className="darkRows"><div><span>userId</span><b>1</b></div><div><span>limit</span><b>5</b></div></div></div></section>
    <section className="catalogPreview"><div className="sectionHead"><div><div className="eyebrow">EXPLORE</div><h2>Start with an API.</h2></div><button className="textBtn" onClick={() => navigate("Explore")}>View all <Icon name="arrow"/></button></div><div className="catalogGrid">{apiCatalog.map(api => <ApiCard key={api.name} api={api} navigate={navigate} onLearnMore={onLearnMore}/>)}</div></section>
    <ReviewsSection onOpenReview={onOpenReview} refreshKey={reviewRefreshKey} />
  </main>;
}

function Feature({icon,title,text}) { return <article className="featureCard"><div className="featureIcon"><Icon name={icon}/></div><h3>{title}</h3><p>{text}</p><span className="featureArrow">→</span></article>; }
function Step({n,title,text}) { return <div className="step"><b>{n}</b><div><h3>{title}</h3><p>{text}</p></div></div>; }

function Tester(p) {
  return <main className="pageWrap testerPage"><div className="pageIntro"><div><div className="eyebrow">API TESTER</div><h1>Test an API from one focused workspace.</h1><p>Configure a request, send it through the APIHub backend, and inspect the response.</p></div><button className="aiAction" onClick={() => p.setAiOpen(true)}><Icon name="ai"/> Ask AI</button></div>
    <section className="testerShell">
      <div className="requestbar">
        <select value={p.method} onChange={e => p.setMethod(e.target.value)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select>
        <input value={p.url} onChange={e => p.setUrl(e.target.value)} placeholder="https://api.example.com/endpoint"/>
        <button className="sendBtn" onClick={p.sendRequest} disabled={p.loading}>{p.loading ? "Sending…" : "Send Request"} <Icon name="arrow"/></button>
        <AiHintTrigger
          hintId="hint_tester_execute"
          title="Safe Proxy Execution"
          text="Tester sends requests through APIHub's backend gateway proxy to eliminate CORS restrictions and benchmark latency."
          aiPrompt="How does APIHub execute API requests without triggering browser CORS restrictions or leaking tokens?"
          onLearnMore={p.onLearnMore}
          position="bottom"
          align="right"
        />
      </div>
      <div className="testerPanels"><div className="requestPanel"><div className="panelTop"><div className="tabs">{["Params","Headers","Body"].map(t => <button key={t} className={p.tab === t ? "tab active" : "tab"} onClick={() => p.setTab(t)}>{t}</button>)}</div><button className="tinyAction" onClick={p.saveRequest}>+ Save</button></div>
        {p.tab === "Params" && <div className="paramBox"><div className="paramHeader"><span>Query parameters</span><button onClick={() => p.setParams([...p.params,{key:"",value:"",enabled:true}])}>+ Add parameter</button></div>{p.params.map((row,i)=><div className="paramRow" key={i}><input type="checkbox" checked={row.enabled} onChange={e => p.setParams(p.params.map((x,j)=>j===i?{...x,enabled:e.target.checked}:x))}/><input value={row.key} onChange={e=>p.setParams(p.params.map((x,j)=>j===i?{...x,key:e.target.value}:x))} placeholder="Key"/><input value={row.value} onChange={e=>p.setParams(p.params.map((x,j)=>j===i?{...x,value:e.target.value}:x))} placeholder="Value"/><button onClick={()=>p.setParams(p.params.filter((_,j)=>j!==i))}>×</button></div>)}</div>}
        {p.tab === "Headers" && <div className="fieldBox"><label>Request headers</label><textarea value={p.headers} onChange={e => p.setHeaders(e.target.value)} placeholder={'Content-Type: application/json\nAuthorization: Bearer YOUR_TOKEN'}/><small>One header per line. Keep private credentials out of screenshots.</small></div>}
        {p.tab === "Body" && <div className="fieldBox"><label>Request body</label><textarea className="bodyArea" value={p.body} onChange={e => p.setBody(e.target.value)} placeholder={'{\n  "name": "APIHub"\n}'}/></div>}
        {p.error && <div className="errorBox">{p.error}</div>}
      </div><div className="responsePanel"><div className="responseHead"><div><div className="eyebrow">RESPONSE</div><h2>{p.response ? "API response" : "Waiting for request"}</h2></div>{p.response && <div className="responseMeta"><b>{p.response.status} {p.response.statusText}</b><span>{p.response.responseTimeMs} ms</span><span>{p.response.responseSizeBytes} B</span></div>}</div><pre>{p.responseText}</pre>{p.response && <details><summary>Response headers</summary><pre>{JSON.stringify(p.response.headers,null,2)}</pre></details>}</div></div></section>
    <div className="testerBottom"><div className="infoCard"><div className="featureIcon"><Icon name="history"/></div><div><b>Recent requests</b><p>Requests from this browser session are kept here for quick re-runs.</p></div><span className="count">{p.history.length}</span></div><div className="infoCard aiInfo"><div className="featureIcon"><Icon name="ai"/></div><div><b>Need help?</b><p>Open API Assistant to explain your request, response or error.</p></div><span>✦</span></div></div>
  </main>;
}
function Apis({ navigate, catalog = [], explore = false, myApis = [], currentUser, onDeleteApi, showToast, copyToClipboard, onLearnMore }) {
  const [tab, setTab] = useState(explore ? "curated" : "curated");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filteredCatalog = useMemo(() => {
    const q = query.toLowerCase().trim();
    return catalog.filter(api => {
      const matchesCategory = category === "All" || api.category === category || api.tags?.includes(category);
      if (!matchesCategory) return false;
      if (!q) return true;
      const text = [api.name, api.desc || api.description, api.category, ...(api.tags || []), ...(api.keywords || [])].join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [catalog, query, category]);

  const filteredMyApis = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return myApis;
    return myApis.filter(api => (api.name || "").toLowerCase().includes(q) || (api.baseUrl || "").toLowerCase().includes(q));
  }, [myApis, query]);

  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">API MARKETPLACE</div>
          <h1>Discover & connect to APIs.</h1>
          <p>
            Explore verified catalog APIs or manage your own private APIs. Authenticate requests with APIHub-issued keys and execute through the APIHub Gateway.
          </p>
        </div>

        <button
          className="primaryBtn"
          onClick={() => navigate("Create API")}
        >
          <Icon name="plus" /> Create API
        </button>
      </div>

      <div className="marketplaceNavTabs">
        <button
          className={`marketTabBtn ${tab === "curated" ? "active" : ""}`}
          onClick={() => { setTab("curated"); setCategory("All"); }}
        >
          Curated Marketplace ({catalog.length})
        </button>
        <button
          className={`marketTabBtn ${tab === "myApis" ? "active" : ""}`}
          onClick={() => setTab("myApis")}
        >
          My Workspace APIs ({myApis.length})
        </button>
      </div>

      <div className="toolbar exploreToolbar">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={tab === "curated" ? "Search name, description, category, or keyword..." : "Search my APIs by name or base URL..."}
        />
        <button onClick={() => { setQuery(""); setCategory("All"); }}>Reset</button>
      </div>

      {tab === "curated" ? (
        <>
          <div className="filterBar">
            {CATEGORIES.map(item => (
              <button
                key={item}
                className={category === item ? "filter active" : "filter"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <p className="exploreCount">
            Showing {filteredCatalog.length} of {catalog.length} curated APIs
          </p>

          {filteredCatalog.length ? (
            <div className="catalogGrid">
              {filteredCatalog.map(api => (
                <ApiCard key={api.id || api.name} api={api} navigate={navigate} onLearnMore={onLearnMore} />
              ))}
            </div>
          ) : (
            <div className="emptyState">
              <p>No APIs match those filters.</p>
              <button className="primaryBtn" onClick={() => { setQuery(""); setCategory("All"); }}>
                Clear filters
              </button>
            </div>
          )}
        </>
      ) : (
        <section className="providerTable" style={{ marginTop: "0" }}>
          <div className="sectionHead">
            <div>
              <div className="eyebrow">MY WORKSPACE</div>
              <h2>Private APIs</h2>
            </div>
            <span className="tableBadge">{filteredMyApis.length} APIs</span>
          </div>

          {filteredMyApis.length === 0 ? (
            <div className="emptyState">
              <p>{query ? "No private APIs match your search." : "No private APIs created yet."}</p>
              <button className="primaryBtn" onClick={() => navigate("Create API")}>
                Create an API
              </button>
            </div>
          ) : (
            filteredMyApis.map((api, i) => (
              <div className="apiTableRow" key={api.id}>
                <div className="apiDot">{i + 1}</div>
                <div>
                  <b>{api.name}</b>
                  <small>{api.baseUrl}</small>
                </div>
                <span className="liveBadge">{api.type || "REST"}</span>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                  {onDeleteApi && (
                    <button
                      className="secondaryBtn"
                      style={{ padding: "6px 10px", fontSize: "9px", color: "var(--danger)", borderColor: "rgba(255, 130, 150, 0.3)" }}
                      onClick={(e) => { e.stopPropagation(); onDeleteApi(api.id); }}
                      title="Delete API"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    className="rowArrow"
                    onClick={() => navigate("API Details", { apiId: api.id })}
                    title="View API Details"
                  >
                    →
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </main>
  );
}

function ApiCard({ api, navigate, onLearnMore }) {
  const isTestable = Boolean(api.testable);
  const endpointCount = api.endpoints?.length || 1;

  return (
    <article className="apiCard">
      <div className="apiCardTop">
        <div className="apiLogo">
          {api.name.charAt(0)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className={isTestable ? "liveBadge" : "requiresBadge"}>
            {isTestable ? "Gateway Ready" : "Credentials needed"}
          </span>
          <AiHintTrigger
            hintId={`hint_card_${api.id || api.name.toLowerCase().replace(/\s+/g, "_")}`}
            title={`${api.name} Gateway`}
            text={`Proxy requests through /api/gateway/${api.id || "..."}. Rate limits and key verification are applied automatically.`}
            aiPrompt={`Explain how APIHub routes requests to the ${api.name} (${api.category}) API and how to use it in code.`}
            onLearnMore={onLearnMore}
            position="bottom"
            align="right"
          />
        </div>
      </div>

      <h3>{api.name}</h3>
      <p>{api.desc || api.description}</p>

      <div className="apiTags">
        <span>{api.category || "Public"}</span>
        <span style={{ color: "var(--cyan)", borderColor: "rgba(78, 226, 197, 0.3)" }}>
          {endpointCount} {endpointCount === 1 ? "endpoint" : "endpoints"}
        </span>
        {api.authentication && <span>{api.authentication}</span>}
      </div>

      <div className="apiCardActions">
        <button onClick={() => navigate("API Details", { catalogId: api.id })}>
          View API & Docs
        </button>
        <button
          className="cardPrimary"
          disabled={!isTestable}
          onClick={() => {
            const e = api.endpoints?.[0] || {};
            navigate("Tester", {
              method: e.method || "GET",
              baseUrl: api.baseUrl,
              path: e.path || "",
              parameters: e.parameters || "",
              body: e.body || ""
            });
          }}
        >
          {isTestable ? "Try in Tester" : "View Docs"}
        </button>
      </div>
    </article>
  );
}
function Documentation({ navigate, currentUser, showToast, copyToClipboard, onLearnMore }) {
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [docLang, setDocLang] = useState("javascript");
  const [selectedApiSlug, setSelectedApiSlug] = useState("open-meteo");

  const sampleApis = [
    {
      slug: "open-meteo",
      name: "Open-Meteo Weather",
      path: "/forecast?latitude=40.71&longitude=-74.00&current=temperature_2m",
      method: "GET",
      description: "Global weather forecast & current conditions"
    },
    {
      slug: "jsonplaceholder",
      name: "JSONPlaceholder Posts",
      path: "/posts/1",
      method: "GET",
      description: "Mock REST resources for testing"
    },
    {
      slug: "cat-facts",
      name: "Cat Facts",
      path: "/fact",
      method: "GET",
      description: "Random cat facts in JSON format"
    },
    {
      slug: "dummyjson",
      name: "DummyJSON Products",
      path: "/products/1",
      method: "GET",
      description: "Mock e-commerce catalog API"
    }
  ];

  const currentSample = sampleApis.find(a => a.slug === selectedApiSlug) || sampleApis[0];
  const gatewayHost = getPublicGatewayBaseUrl();
  const sampleUrl = `${gatewayHost}/api/gateway/${currentSample.slug}${currentSample.path}`;

  const jsSample = `// JavaScript (Fetch / Node.js 18+)
// Store your API key in an environment variable or config file
const response = await fetch("${sampleUrl}", {
  method: "${currentSample.method}",
  headers: {
    "X-API-Key": "YOUR_APIHUB_API_KEY",
    "Content-Type": "application/json"
  }
});

const data = await response.json();
console.log(data);`;

  const pythonSample = `# Python (requests)
# pip install requests
import requests
import os

# Use environment variable: os.getenv("APIHUB_API_KEY")
url = "${sampleUrl}"
headers = {
    "X-API-Key": "YOUR_APIHUB_API_KEY"
}

response = requests.${currentSample.method.toLowerCase()}(url, headers=headers)
print("Status:", response.status_code)
print("Data:", response.json())`;

  const curlSample = `curl -X ${currentSample.method} "${sampleUrl}" \\
  -H "X-API-Key: YOUR_APIHUB_API_KEY"`;

  const activeSnippet = docLang === "javascript"
    ? jsSample
    : (docLang === "python" ? pythonSample : curlSample);

  const sections = [
    ["Gateway Quickstart", "Access any curated or user-defined API using your single APIHub API Key through our reverse proxy gateway.", sampleUrl],
    ["Authentication & Keys", "Authenticate every gateway request by passing your APIHub API key in the X-API-Key header. We verify the key's SHA-256 hash server-side.", "X-API-Key: YOUR_APIHUB_API_KEY"],
    ["Where to Put Your Key", "Best practices for storing and referencing your APIHub API key in client or backend projects without leaking secrets.", "APIHUB_API_KEY=YOUR_APIHUB_API_KEY\n# In backend code: headers['X-API-Key'] = process.env.APIHUB_API_KEY"],
    ["Beginner Step-by-Step Flow", "Complete 8-step journey for developers from account creation to production integration.", "1. Sign Up / Sign In to your APIHub developer account.\n2. Browse the 18-category Marketplace and select an API.\n3. Click 'Get API Key' to generate a real scoped or global key.\n4. Copy your raw key immediately (shown once; stored as SHA-256 hash).\n5. Store in your project's .env file: APIHUB_API_KEY=ah_live_...\n6. Send requests to the APIHub Gateway with header: X-API-Key: YOUR_KEY\n7. Inspect live response metrics and track usage in Dashboard.\n8. Revoke keys instantly anytime to invalidate compromised access."],
    ["Common Errors & Troubleshooting", "Diagnostic matrix for 401, 403, 404, 429, and 500 status codes returned by the gateway.", "• 401 Unauthorized: Missing or invalid X-API-Key header, or revoked key.\n  Fix: Verify X-API-Key header name and generate an active key from Dashboard.\n\n• 403 Forbidden: Scope mismatch (e.g. key scoped to Weather used for Crypto).\n  Fix: Generate a Global Key or one scoped to the target API.\n\n• 404 Not Found: Target API slug or endpoint path does not exist on gateway.\n  Fix: Check API Catalog for the exact slug (e.g. /api/gateway/open-meteo/forecast).\n\n• 429 Too Many Requests: Gateway limit of 60 requests/minute exceeded for this key.\n  Fix: Implement client backoff/retry with a 60-second delay or local caching.\n\n• 502 Bad Gateway: Upstream provider is temporarily unreachable or timed out.\n  Fix: Check provider status or retry shortly."],
    ["Getting Started", "Open Explore, choose a public API, then use Try API to load its selected endpoint into Tester.", "GET https://jsonplaceholder.typicode.com/posts/1"],
    ["API Basics", "An API lets one application request data or actions from another. A base URL identifies a service; an endpoint identifies an operation.", "Base URL: https://api.example.com\nEndpoint: /users"],
    ["REST APIs", "REST commonly uses resource URLs and HTTP methods to describe operations.", "GET /users\nPOST /users"],
    ["HTTP Methods", "GET reads, POST creates, PUT replaces, PATCH changes part, and DELETE removes.", "PATCH /users/42"],
    ["Status Codes", "2xx is success; 4xx usually means input or permission trouble; 5xx is server-side.", "200 OK · 400 Bad Request · 401 Unauthorized · 404 Not Found · 429 Too Many Requests"],
    ["Headers", "Headers carry metadata such as content type and authorization. Enter one Name: value pair per line.", "Content-Type: application/json\nX-API-Key: YOUR_APIHUB_API_KEY"],
    ["Query Parameters", "Query parameters refine a request after a question mark.", "GET /search?q=api&page=1"],
    ["Request Body", "POST, PUT, and PATCH often send a body. Use JSON when the API expects it.", '{\n  "name": "APIHub"\n}'],
    ["Rate Limiting", "APIHub Gateway applies a per-key limit of 60 requests/minute. When exceeded, the gateway responds with HTTP 429.", "429 Too Many Requests: Rate limit exceeded. Try again in a minute."]
  ];

  const [active, setActive] = useState(0);
  const item = sections[active];

  return (
    <main className="docsPage">
      <ApiKeyModal
        isOpen={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        currentUser={currentUser}
        navigate={navigate}
        showToast={showToast}
        onLearnMore={onLearnMore}
      />

      <aside className="docsSide">
        <button className="textBtn" onClick={() => navigate("Home")}>
          ← Back home
        </button>
        <div style={{ margin: "10px 0 16px" }}>
          <button
            className="primaryBtn"
            style={{ width: "100%", justifyContent: "center", padding: "10px 12px", fontSize: "10px" }}
            onClick={() => setKeyModalOpen(true)}
          >
            <Icon name="settings" /> Get API Key
          </button>
        </div>
        <h3>Documentation</h3>
        {sections.map(([title], i) => (
          <button
            key={title}
            className={active === i ? "docActive" : ""}
            onClick={() => setActive(i)}
          >
            {title}
          </button>
        ))}
      </aside>

      <section className="docsContent">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow">APIHUB DEVELOPER GUIDES</div>
            <h1>{item[0]}</h1>
            <p className="lead">{item[1]}</p>
          </div>
          <button className="primaryBtn" onClick={() => setKeyModalOpen(true)}>
            <Icon name="settings" /> Get API Key
          </button>
        </div>

        {/* Dedicated Gateway Developer Interactive Guide on top-level topics */}
        {active <= 2 && (
          <div style={{ marginTop: "24px" }}>
            {/* Step-by-step project integration box */}
            <div style={{ background: "rgba(100, 220, 203, 0.06)", border: "1px solid rgba(100, 220, 203, 0.3)", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
              <b style={{ color: "#64dccb", fontSize: "13px", display: "block", marginBottom: "8px" }}>
                🔑 How to use your APIHub API Key in your project:
              </b>
              <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "#dbe8f7", lineHeight: "1.9" }}>
                <li>
                  Click the <b>Get API Key</b> button to generate your live key (format: <code>ah_live_...</code>).
                </li>
                <li>
                  In your own application, create a <code>.env</code> file and add:
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "6px 0" }}>
                    <code style={{ background: "#050b13", padding: "6px 10px", borderRadius: "6px", border: "1px solid #1c2e46", color: "#64dccb", fontSize: "11px" }}>
                      APIHUB_API_KEY=YOUR_APIHUB_API_KEY
                    </code>
                    <button
                      className="copySnippetBtn"
                      onClick={() => copyToClipboard ? copyToClipboard("APIHUB_API_KEY=YOUR_APIHUB_API_KEY", "Env placeholder copied!") : navigator.clipboard?.writeText("APIHUB_API_KEY=YOUR_APIHUB_API_KEY")}
                    >
                      Copy
                    </button>
                  </div>
                </li>
                <li>
                  Attach the header <code>X-API-Key: YOUR_APIHUB_API_KEY</code> to all requests targeting the APIHub Gateway URL.
                </li>
                <li>
                  The APIHub Gateway verifies your key, validates rate limits, and proxies the request to the target API.
                </li>
              </ol>
            </div>

            {/* Live interactive code generator for sample APIs */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                <b style={{ fontSize: "12px", color: "#a9bed8" }}>Select an API to generate code:</b>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {sampleApis.map(s => (
                    <button
                      key={s.slug}
                      className={`filter ${selectedApiSlug === s.slug ? "active" : ""}`}
                      style={{ fontSize: "9px", padding: "6px 10px" }}
                      onClick={() => setSelectedApiSlug(s.slug)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gatewayUrlBar" style={{ marginBottom: "12px" }}>
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <span style={{ color: "var(--muted)", marginRight: "8px" }}>Gateway URL:</span>
                  <code>{sampleUrl}</code>
                </div>
                <button
                  className="copySnippetBtn"
                  onClick={() => copyToClipboard ? copyToClipboard(sampleUrl, "Gateway URL copied!") : navigator.clipboard?.writeText(sampleUrl)}
                >
                  Copy URL
                </button>
              </div>

              <div className="codeSnippetWrap">
                <div className="snippetHeader">
                  <div className="langTabs">
                    <button
                      className={`langTab ${docLang === "javascript" ? "active" : ""}`}
                      onClick={() => setDocLang("javascript")}
                    >
                      JavaScript (fetch)
                    </button>
                    <button
                      className={`langTab ${docLang === "python" ? "active" : ""}`}
                      onClick={() => setDocLang("python")}
                    >
                      Python (requests)
                    </button>
                    <button
                      className={`langTab ${docLang === "curl" ? "active" : ""}`}
                      onClick={() => setDocLang("curl")}
                    >
                      cURL
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <AiHintTrigger
                      hintId="hint_doc_code"
                      title="Client & Server Integration"
                      text="Never expose API keys in client-side bundles. Store APIHUB_API_KEY in backend environment variables and forward headers."
                      aiPrompt="Show me how to securely configure environment variables for APIHub API keys in Node.js and Python."
                      onLearnMore={onLearnMore}
                      position="bottom"
                      align="right"
                    />
                    <button
                      className="copySnippetBtn"
                      onClick={() => copyToClipboard ? copyToClipboard(activeSnippet, `${docLang.toUpperCase()} code copied!`) : navigator.clipboard?.writeText(activeSnippet)}
                    >
                      Copy Code
                    </button>
                  </div>
                </div>
                <pre className="snippetBody">{activeSnippet}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Section specific example with copy button */}
        <div className="docCode" style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span>EXAMPLE SPECIFICATION</span>
            <button
              className="copySnippetBtn"
              onClick={() => copyToClipboard ? copyToClipboard(item[2], "Example copied!") : navigator.clipboard?.writeText(item[2])}
            >
              Copy
            </button>
          </div>
          <pre>{item[2]}</pre>
        </div>

        <div className="contentNav">
          <button className="secondaryBtn" disabled={!active} onClick={() => setActive(active - 1)}>
            ← Previous
          </button>
          <button className="secondaryBtn" disabled={active === sections.length - 1} onClick={() => setActive(active + 1)}>
            Next →
          </button>
        </div>
      </section>
    </main>
  );
}
function History({ savedRequests, onOpenRequest, onDeleteRequest, onClearRequests }) {
  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">REQUEST HISTORY</div>
          <h1>Saved Requests</h1>
          <p>View the API requests you have saved in APIHub.</p>
        </div>

        {savedRequests.length > 0 && (
          <button className="secondaryBtn" onClick={onClearRequests}>
            Clear all
          </button>
        )}
      </div>

      <section className="createApiCard">
        {savedRequests.length === 0 ? (
          <p>No saved requests yet. Save a request from API Tester to rerun it here.</p>
        ) : (
          savedRequests.map((request, index) => (
            <div key={request.id || `saved-request-${index}`} className="historyRow">
              <strong>{request.method || "GET"}</strong>
              <span>{request.url || "Untitled request"}</span>
              <button className="secondaryBtn" onClick={() => onOpenRequest(request)}>
                Open
              </button>
              <button className="secondaryBtn" onClick={() => onDeleteRequest(index)}>
                Delete
              </button>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
const LEARN_TOPICS = [
  {
    id: 1,
    title: "1. What is an API?",
    category: "Fundamentals",
    icon: "◈",
    summary: "An API (Application Programming Interface) defines formal contracts and protocols for software components to communicate and exchange data securely.",
    takeaway: "APIs abstract implementation details behind clean endpoints (URLs) and structured payloads (JSON).",
    testerUrl: null
  },
  {
    id: 2,
    title: "2. How REST APIs Work",
    category: "Fundamentals",
    icon: "⌁",
    summary: "REST (Representational State Transfer) is a stateless architectural style utilizing standard HTTP methods and resource-oriented URIs.",
    takeaway: "Client issues HTTP request (Method + URL + Headers + Body) → Server processes → Server returns HTTP response (Status + Headers + Body).",
    testerUrl: "https://jsonplaceholder.typicode.com/posts/1"
  },
  {
    id: 3,
    title: "3. HTTP Methods",
    category: "Fundamentals",
    icon: "▦",
    summary: "GET (read), POST (create), PUT (complete replacement), PATCH (partial update), DELETE (remove resource).",
    takeaway: "GET, PUT, and DELETE are idempotent (repeating identical requests yields the same system state). POST creates new resources.",
    testerUrl: "https://jsonplaceholder.typicode.com/posts"
  },
  {
    id: 4,
    title: "4. HTTP Status Codes",
    category: "Fundamentals",
    icon: "◎",
    summary: "Three-digit codes indicating outcomes: 2xx (Success), 3xx (Redirection), 4xx (Client Error), 5xx (Server/Upstream Error).",
    takeaway: "Key codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Rate Limit, 500 Server Error.",
    testerUrl: null
  },
  {
    id: 5,
    title: "5. Headers & Content-Type",
    category: "Fundamentals",
    icon: "▤",
    summary: "HTTP headers convey metadata for authentication, caching, content negotiation, and payloads.",
    takeaway: "Standard headers include 'Content-Type: application/json', 'Accept: application/json', and 'X-API-Key: YOUR_KEY'.",
    testerUrl: null
  },
  {
    id: 6,
    title: "6. Query Parameters vs Path vs Body",
    category: "Fundamentals",
    icon: "✦",
    summary: "Path params identify specific entities (/users/42). Query params filter or paginate (/users?page=2). Body carries structured data for POST/PUT.",
    takeaway: "Never pass sensitive credentials in URL query strings because URLs are recorded in browser histories and proxy logs.",
    testerUrl: "https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.00&current=temperature_2m"
  },
  {
    id: 7,
    title: "7. API Authentication Mechanisms",
    category: "Security",
    icon: "⚙",
    summary: "Mechanisms to establish caller identity: API Keys (like APIHub's X-API-Key), Bearer JWT tokens, HTTP Basic Auth, and OAuth 2.0 flows.",
    takeaway: "APIHub verifies keys using SHA-256 hashes against PostgreSQL without ever storing or logging raw keys.",
    testerUrl: null
  },
  {
    id: 8,
    title: "8. Rate Limiting & 429 Handling",
    category: "Security",
    icon: "↺",
    summary: "Algorithms like Token Bucket and Sliding Window throttle excessive requests to guard against abuse and denial-of-service.",
    takeaway: "The APIHub Gateway applies a default 60 req/min quota. When exceeded, the gateway returns HTTP 429 with Retry-After guidance.",
    testerUrl: null
  },
  {
    id: 9,
    title: "9. CORS & Browser Security",
    category: "Security",
    icon: "◈",
    summary: "Cross-Origin Resource Sharing is a browser sandbox policy preventing client-side scripts from reading responses from foreign origins without permission.",
    takeaway: "The APIHub Gateway acts as a trusted reverse proxy, handling upstream communication server-to-server and bypassing browser CORS blocks.",
    testerUrl: null
  },
  {
    id: 10,
    title: "10. Webhooks vs REST APIs",
    category: "Architecture",
    icon: "⌁",
    summary: "REST APIs require client polling. Webhooks push event payloads directly to a subscriber URL in real time as events happen.",
    takeaway: "Use REST for synchronous user-driven requests and Webhooks for asynchronous notifications (e.g. payment confirmations).",
    testerUrl: null
  },
  {
    id: 11,
    title: "11. GraphQL vs REST",
    category: "Architecture",
    icon: "▦",
    summary: "REST exposes multiple distinct endpoints. GraphQL exposes a single /graphql endpoint allowing clients to query specific fields.",
    takeaway: "GraphQL prevents over-fetching and under-fetching but adds query complexity and makes HTTP-level edge caching harder.",
    testerUrl: null
  },
  {
    id: 12,
    title: "12. gRPC vs REST",
    category: "Architecture",
    icon: "◎",
    summary: "gRPC uses Protocol Buffers over HTTP/2 for high-throughput, low-latency microservice RPCs with strict typing.",
    takeaway: "REST + JSON is standard for public developer platforms; gRPC is ideal for high-throughput internal microservice meshes.",
    testerUrl: null
  },
  {
    id: 13,
    title: "13. API Versioning Strategies",
    category: "Architecture",
    icon: "▤",
    summary: "Strategies to introduce changes without breaking existing consumers: URI versioning (/v1), Query param (?v=1), or Accept headers.",
    takeaway: "URI versioning (/v1/..., /v2/...) is the clearest, most cache-friendly, and most developer-friendly approach.",
    testerUrl: null
  },
  {
    id: 14,
    title: "14. Caching & ETags",
    category: "Architecture",
    icon: "✦",
    summary: "Drastically reduce latency and server compute using Cache-Control directives, ETags, and conditional 304 Not Modified responses.",
    takeaway: "ETags allow clients to validate whether cached representations match current server state using 'If-None-Match'.",
    testerUrl: null
  },
  {
    id: 15,
    title: "15. Pagination Patterns",
    category: "Architecture",
    icon: "⚙",
    summary: "Techniques for chunking large datasets: Limit/Offset (?limit=20&offset=40), Page-based, and Cursor-based pagination.",
    takeaway: "Cursor-based pagination is recommended for frequently mutating datasets to prevent skipped or duplicate items.",
    testerUrl: null
  },
  {
    id: 16,
    title: "16. Error Handling Best Practices",
    category: "Best Practices",
    icon: "↺",
    summary: "Providing predictable, consistent error payloads with machine-readable error codes and actionable human-readable messages.",
    takeaway: "Standardize on consistent error schemas: { success: false, code: 'INVALID_API_KEY', message: '...' } with appropriate HTTP status codes.",
    testerUrl: null
  },
  {
    id: 17,
    title: "17. API Security Best Practices",
    category: "Best Practices",
    icon: "◈",
    summary: "Essential defenses: mandatory TLS, strict input validation, rate limiting, SQL injection defense, SSRF prevention, and secret segregation.",
    takeaway: "Never embed API secrets in frontend bundles or commit them to source control. Always inject them via server-side environment variables.",
    testerUrl: null
  }
];

const ROADMAP_STEPS = [
  {
    num: "01",
    title: "Marketplace Discovery",
    desc: "Browse 18 live API categories with verified endpoint schemas, interactive documentation, and testing tools."
  },
  {
    num: "02",
    title: "SHA-256 Key Issuance",
    desc: "Generate an APIHub key with 32 bytes of secure random entropy. PostgreSQL stores only the cryptographic SHA-256 hash."
  },
  {
    num: "03",
    title: "Project Configuration",
    desc: "Store your raw key once in your application's .env file (APIHUB_API_KEY=ah_live_...). Never expose it in client code."
  },
  {
    num: "04",
    title: "Gateway Dispatch",
    desc: "Send requests to /api/gateway/:slug with header X-API-Key: YOUR_KEY. Works across cURL, Node.js, Python, and any HTTP client."
  },
  {
    num: "05",
    title: "Rate Limiting & Auth",
    desc: "APIHub Gateway validates the 60 req/min quota and authenticates your hashed key and tenant permissions in milliseconds."
  },
  {
    num: "06",
    title: "Secure Reverse Proxy",
    desc: "The gateway injects required provider credentials server-side and forwards requests with SSRF protection to upstream providers."
  },
  {
    num: "07",
    title: "Usage & Revocation",
    desc: "Track request volume and latency in the Developer Dashboard. Revoke keys with immediate real-time effect if needed."
  }
];

function Learn({ navigate, askAI, onLearnMore }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = ["All", "Fundamentals", "Security", "Architecture", "Best Practices"];

  const filteredTopics = LEARN_TOPICS.filter(topic => {
    const matchesCategory = activeCategory === "All" || topic.category === activeCategory;
    const matchesSearch = !searchQuery || 
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.takeaway.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">APIHUB DEVELOPER ACADEMY</div>
          <h1>Learn APIs & Architecture</h1>
          <p>Master REST design, HTTP protocols, gateway architectures, and API security. Interactive guidance powered by the APIHub AI Assistant.</p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="primaryBtn"
            onClick={() => {
              if (askAI) askAI("Give me an API knowledge quiz!");
              navigate("AI Assistant");
            }}
          >
            <Icon name="ai" /> Take API Quiz
          </button>
          <button
            className="secondaryBtn"
            onClick={() => navigate("Home")}
          >
            ← Back to Home
          </button>
        </div>
      </div>

      {/* Learn APIHub: Developer Journey & Gateway Roadmap */}
      <section style={{ background: "linear-gradient(180deg, rgba(16, 28, 48, 0.6) 0%, rgba(9, 17, 30, 0.8) 100%)", border: "1px solid #1a2c47", borderRadius: "14px", padding: "24px", marginBottom: "36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <div className="eyebrow" style={{ color: "#64dccb", margin: 0 }}>ARCHITECTURAL ROADMAP</div>
              <AiHintTrigger
                hintId="hint_learn_roadmap"
                title="Zero-Secret Architecture"
                text="APIHub stores only cryptographic SHA-256 hashes of developer keys. Provider secrets never leave the server."
                aiPrompt="Walk me through APIHub's 4-phase architecture: Discovery, Key Issuance, Gateway Proxying, and Usage Tracking."
                onLearnMore={onLearnMore || (askAI ? (p) => { askAI(p); navigate("AI Assistant"); } : null)}
                position="bottom"
                align="left"
              />
            </div>
            <h2 style={{ margin: "4px 0 8px", fontSize: "18px", color: "#eef4ff" }}>How APIHub Works: The Developer Journey</h2>
            <p style={{ margin: 0, color: "#8ca0bb", fontSize: "12px", maxWidth: "680px", lineHeight: "1.6" }}>
              From initial discovery in our 18-category marketplace to production reverse proxy dispatch, see how APIHub handles authentication, tenant isolation, rate limiting, and zero-secret persistence.
            </p>
          </div>
          <button className="secondaryBtn" onClick={() => navigate("Documentation")} style={{ fontSize: "11px" }}>
            View Full Docs →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
          {ROADMAP_STEPS.map((step) => (
            <div key={step.num} style={{ background: "#060d19", border: "1px solid #14233a", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontFamily: "'Space Grotesk'", fontWeight: "700", color: "#64dccb", fontSize: "14px" }}>{step.num}</span>
                  <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(100, 220, 203, 0.1)", color: "#64dccb" }}>Phase</span>
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: "13px", color: "#fff" }}>{step.title}</h4>
                <p style={{ margin: 0, color: "#8ca0bb", fontSize: "11px", lineHeight: "1.6" }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 17 Topics Curriculum */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`filter ${activeCategory === cat ? "active" : ""}`}
                style={{ fontSize: "11px", padding: "7px 14px" }}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === "All" ? "All 17 Topics" : cat}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search API concepts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "240px", background: "#060e1a", border: "1px solid #1c2e46", color: "#fff", padding: "7px 12px", borderRadius: "8px", fontSize: "11px" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "18px" }}>
          {filteredTopics.map(topic => (
            <article key={topic.id} style={{ background: "#08101e", border: "1px solid #16263d", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "9px", textTransform: "uppercase", padding: "3px 8px", borderRadius: "5px", background: "rgba(111, 126, 255, 0.12)", color: "#9aa6ff", fontWeight: "600" }}>
                    {topic.category}
                  </span>
                  <span style={{ fontSize: "16px", color: "#64dccb" }}>{topic.icon}</span>
                </div>

                <h3 style={{ margin: "0 0 8px", fontSize: "15px", color: "#eef4ff" }}>{topic.title}</h3>
                <p style={{ margin: "0 0 14px", color: "#8ca0bb", fontSize: "11px", lineHeight: "1.6" }}>{topic.summary}</p>

                <div style={{ background: "#050a12", border: "1px solid #121e30", borderRadius: "8px", padding: "10px 12px", marginBottom: "16px" }}>
                  <span style={{ display: "block", fontSize: "9px", color: "#64dccb", textTransform: "uppercase", fontWeight: "700", marginBottom: "4px" }}>Key Takeaway:</span>
                  <p style={{ margin: 0, color: "#d2dbe8", fontSize: "11px", lineHeight: "1.5" }}>{topic.takeaway}</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "12px", borderTop: "1px solid #121e30" }}>
                <button
                  className="secondaryBtn"
                  style={{ flex: 1, fontSize: "10px", padding: "6px 10px", justifyContent: "center" }}
                  onClick={() => {
                    if (askAI) askAI(`Explain in depth with code examples and best practices: ${topic.title}`);
                    navigate("AI Assistant");
                  }}
                >
                  <Icon name="ai" /> Explain with AI
                </button>

                {topic.testerUrl && (
                  <button
                    className="primaryBtn"
                    style={{ fontSize: "10px", padding: "6px 12px", justifyContent: "center" }}
                    onClick={() => navigate("Tester", { url: topic.testerUrl, method: "GET" })}
                  >
                    Try in Tester →
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function AssistantPage({ navigate, askAI, aiMessages, aiInput, setAiInput, aiLoading }) {
  const quickPrompts = [
    { label: "Take a Quiz", prompt: "Give me an API knowledge quiz!" },
    { label: "401 vs 403", prompt: "What is the difference between 401 Unauthorized and 403 Forbidden?" },
    { label: "Secure API Keys", prompt: "Where should I store and how should I use my API key in Node.js or Python?" },
    { label: "Explain Status Codes", prompt: "Explain the common HTTP status codes: 200, 201, 400, 401, 403, 404, 429, 500." },
    { label: "Analyze Last Request", prompt: "Explain the response from my last API Tester execution." }
  ];

  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">APIHUB INTELLIGENCE</div>
          <h1>AI Learning & Diagnostic Assistant</h1>
          <p>Ask questions about API protocols, test your knowledge with quizzes, debug status codes, or analyze requests.</p>
        </div>

        <button
          className="secondaryBtn"
          onClick={() => navigate("Home")}
        >
          ← Back to Home
        </button>
      </div>

      <section style={{ background: "#070d18", border: "1px solid #16263c", borderRadius: "14px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #16263c", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="onlineDot" />
            <strong style={{ color: "#fff", fontSize: "13px" }}>API Assistant Active</strong>
            <span style={{ fontSize: "10px", color: "#6b809b" }}>· Powered by APIHub Core Engine</span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {quickPrompts.map(qp => (
              <button
                key={qp.label}
                className="filter"
                style={{ fontSize: "9px", padding: "4px 8px" }}
                onClick={() => askAI(qp.prompt)}
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message stream */}
        <div style={{ padding: "20px", maxHeight: "480px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {aiMessages.map((msg, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start"
              }}
            >
              <div style={{ fontSize: "10px", color: "#6b809b", marginBottom: "4px", paddingLeft: "4px", paddingRight: "4px" }}>
                {msg.role === "user" ? "You" : "API Assistant"}
              </div>
              <div
                style={{
                  maxWidth: "85%",
                  padding: "14px 18px",
                  borderRadius: "12px",
                  background: msg.role === "user" ? "#1e3a5f" : "#0c1524",
                  border: msg.role === "user" ? "1px solid #2e5488" : "1px solid #18283e",
                  color: "#e2ecfa",
                  fontSize: "12px",
                  lineHeight: "1.7",
                  whiteSpace: "pre-wrap"
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {aiLoading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontSize: "10px", color: "#6b809b", marginBottom: "4px" }}>API Assistant</div>
              <div style={{ padding: "12px 18px", borderRadius: "12px", background: "#0c1524", border: "1px solid #18283e", color: "#64dccb", fontSize: "11px", fontStyle: "italic" }}>
                Thinking & generating explanation…
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #16263c", background: "#050a12", display: "flex", gap: "10px" }}>
          <input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !aiLoading) askAI();
            }}
            placeholder="Ask about status codes, headers, CORS, or request a quiz..."
            style={{ flex: 1, background: "#08111e", border: "1px solid #1a2c44", color: "#fff", padding: "12px 16px", borderRadius: "8px", fontSize: "12px" }}
          />

          <button
            className="primaryBtn"
            onClick={() => askAI()}
            disabled={aiLoading}
            style={{ padding: "12px 20px" }}
          >
            {aiLoading ? "Thinking…" : "Send"}
          </button>
        </div>
      </section>
    </main>
  );
}
function ApiKeyModal({ isOpen, onClose, currentUser, navigate, showToast, defaultApi = null, onLearnMore }) {
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("all");
  const [newSecret, setNewSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadKeys = () => {
    if (!currentUser) return;
    authFetch(`${API_BASE_URL}/api/api-keys`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.success && Array.isArray(d.data)) setKeys(d.data); })
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen && currentUser) {
      loadKeys();
      setNewSecret("");
      setErrorMsg("");
      if (defaultApi?.slug) {
        setSelectedSlug(defaultApi.slug);
        setName(defaultApi.name ? `${defaultApi.name} Key` : "");
      } else {
        setSelectedSlug("all");
        setName("");
      }
    }
  }, [isOpen, currentUser, defaultApi]);

  if (!isOpen) return null;

  async function handleCreateKey() {
    setLoading(true);
    setErrorMsg("");
    try {
      const target = selectedSlug === "all" ? null : apiCatalog.find(a => a.id === selectedSlug);
      const payload = {
        name: name.trim() || (target ? `${target.name} Key` : "Global Developer Key"),
        apiSlug: target ? target.id : "all",
        apiName: target ? target.name : "All APIs (Full Access)",
        category: target ? target.category : "All Categories"
      };

      const res = await authFetch(`${API_BASE_URL}/api/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Failed to generate key.");
        setLoading(false);
        return;
      }
      setNewSecret(data.secret);
      setName("");
      loadKeys();
      if (showToast) showToast("New API key generated!");
    } catch {
      setErrorMsg("Failed to generate key due to network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(keyId) {
    if (!window.confirm("Revoke this API key? Requests using it will fail immediately.")) return;
    try {
      await authFetch(`${API_BASE_URL}/api/api-keys/${keyId}/revoke`, {
        method: "POST"
      });
      loadKeys();
      if (showToast) showToast("API key revoked.");
    } catch {}
  }

  const selectedTarget = selectedSlug === "all" ? null : apiCatalog.find(a => a.id === selectedSlug);

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard" style={{ maxWidth: "660px", width: "95%" }} onClick={e => e.stopPropagation()}>
        <button className="modalClose" onClick={onClose}>×</button>
        <div className="eyebrow">APIHUB GATEWAY DEVELOPER ACCESS</div>
        <h2 style={{ fontFamily: "'Space Grotesk'", margin: "8px 0 4px" }}>
          {selectedTarget ? `Get API Key for ${selectedTarget.name}` : "API Keys & Access"}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "11px", lineHeight: "1.6", margin: "0 0 16px" }}>
          Generate a scoped key for a specific API or create a full-access key valid across all 18 catalog categories through the APIHub Gateway.
        </p>

        {!currentUser ? (
          <div className="emptyState" style={{ padding: "24px 16px" }}>
            <p style={{ color: "#d2dbe8", marginBottom: "6px" }}>Sign in to generate and manage APIHub API keys.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "14px" }}>
              <button className="primaryBtn" onClick={() => { onClose(); navigate("Sign In"); }}>Sign In</button>
              <button className="secondaryBtn" onClick={() => { onClose(); navigate("Sign Up"); }}>Sign Up</button>
            </div>
          </div>
        ) : (
          <div>
            {newSecret ? (
              <div style={{ background: "rgba(78, 226, 197, 0.08)", border: "1px solid rgba(78, 226, 197, 0.4)", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                <b style={{ color: "#4ee2c5", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", fontSize: "13px" }}>
                  ✓ API Key Generated Successfully!
                </b>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#050b14", padding: "10px 12px", borderRadius: "8px", border: "1px solid #1c2e46" }}>
                  <code style={{ color: "#fff", flex: 1, wordBreak: "break-all", font: "12px monospace" }}>{newSecret}</code>
                  <button
                    className="primaryBtn"
                    style={{ padding: "8px 14px", fontSize: "11px", whiteSpace: "nowrap" }}
                    onClick={() => {
                      if (navigator.clipboard) navigator.clipboard.writeText(newSecret);
                      if (showToast) showToast("API Key copied to clipboard!");
                    }}
                  >
                    Copy Key
                  </button>
                </div>
                <small style={{ display: "block", color: "#f1bd7c", marginTop: "10px", lineHeight: "1.5" }}>
                  ⚠️ <b>Save this key now!</b> For security, APIHub only stores the SHA-256 hash. This raw key cannot be viewed again after closing this window.
                </small>
                <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                  <button className="secondaryBtn" style={{ fontSize: "11px", padding: "6px 12px" }} onClick={() => setNewSecret("")}>
                    + Generate Another Key
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: "#091322", border: "1px solid #1b2d45", borderRadius: "10px", padding: "16px", marginBottom: "18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ display: "block", fontSize: "10px", color: "#8fa3be", margin: 0 }}>API SCOPE</label>
                      <AiHintTrigger
                        hintId="hint_scope_selector"
                        title="Scoped vs Global Keys"
                        text="Scoped keys restrict access to only a single API category for least-privilege security. Global keys work across all 18 categories."
                        aiPrompt="What is the difference between scoped and global API keys in APIHub, and which should I use?"
                        onLearnMore={onLearnMore}
                        position="bottom"
                        align="right"
                      />
                    </div>
                    <select
                      style={{ width: "100%", background: "#050c17", border: "1px solid #223751", color: "#fff", padding: "8px 10px", borderRadius: "7px", fontSize: "11px" }}
                      value={selectedSlug}
                      onChange={e => {
                        setSelectedSlug(e.target.value);
                        if (e.target.value !== "all") {
                          const t = apiCatalog.find(a => a.id === e.target.value);
                          if (t) setName(`${t.name} Key`);
                        } else {
                          setName("Global Access Key");
                        }
                      }}
                    >
                      <option value="all">⚡ All APIs (Full Access - 18 Categories)</option>
                      {CATEGORIES.map(cat => (
                        <optgroup key={cat} label={`📂 ${cat}`}>
                          {apiCatalog.filter(a => a.category === cat).map(api => (
                            <option key={api.id} value={api.id}>{api.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "10px", color: "#8fa3be", marginBottom: "4px" }}>KEY NAME / LABEL</label>
                    <input
                      style={{ width: "100%", boxSizing: "border-box", background: "#050c17", border: "1px solid #223751", color: "#fff", padding: "8px 10px", borderRadius: "7px", fontSize: "11px" }}
                      placeholder="e.g. Production Client"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleCreateKey()}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                  <span style={{ fontSize: "10px", color: "#6e839e" }}>
                    Scope: <b style={{ color: "#8c9aff" }}>{selectedTarget ? `${selectedTarget.name} (${selectedTarget.category})` : "All APIs (Full Access)"}</b>
                  </span>
                  <button className="primaryBtn" onClick={handleCreateKey} disabled={loading} style={{ padding: "8px 16px" }}>
                    {loading ? "Generating…" : "Generate API Key"}
                  </button>
                </div>
              </div>
            )}

            {errorMsg && <p className="errorBox" style={{ margin: "0 0 14px" }}>{errorMsg}</p>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 8px" }}>
              <h4 style={{ margin: 0, fontSize: "12px", color: "#a9bed8" }}>Your Active Keys ({keys.length})</h4>
              <button className="textBtn" style={{ fontSize: "10px", padding: 0 }} onClick={() => { onClose(); navigate("Dashboard"); }}>
                Open Dashboard →
              </button>
            </div>

            {keys.length === 0 ? (
              <p style={{ color: "#62748d", fontSize: "10px", margin: "12px 0" }}>No API keys created yet. Generate one above to access the APIHub Gateway.</p>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #142337", borderRadius: "8px" }}>
                {keys.map(k => (
                  <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #142337", fontSize: "10px", background: "#060e19" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong style={{ color: "#eef4ff" }}>{k.name}</strong>
                        <span style={{ fontSize: "8px", padding: "2px 6px", borderRadius: "4px", background: k.apiSlug === "all" ? "#312e81" : "#132b3f", color: k.apiSlug === "all" ? "#c7d2fe" : "#7dd3fc" }}>
                          {k.apiSlug === "all" ? "All APIs" : (k.apiName || k.apiSlug)}
                        </span>
                      </div>
                      <span style={{ color: "#62748d", fontFamily: "monospace", fontSize: "9px" }}>
                        {k.prefix}•••• · {k.usage || 0} reqs · {new Date(k.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {k.status === "Active" ? (
                        <>
                          <span style={{ color: "#4ee2c5", fontSize: "9px", fontWeight: "600" }}>Active</span>
                          <button
                            className="secondaryBtn"
                            style={{ padding: "4px 8px", fontSize: "8px", color: "var(--danger)", borderColor: "rgba(255, 130, 150, 0.3)" }}
                            onClick={() => handleRevoke(k.id)}
                          >
                            Revoke
                          </button>
                        </>
                      ) : (
                        <span className="requiresBadge" style={{ fontSize: "8px" }}>Revoked</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const GATEWAY_PROVIDER_SLUGS = new Set([
  "weatherapi", "openweather", "finnhub", "newsapi", "openai", "alpha-vantage", "mapbox", "here", "opencage"
]);

function APIDetails({
  navigate,
  apiId,
  catalogId,
  currentUser,
  userApis = [],
  onDeleteApi,
  showToast,
  copyToClipboard,
  onLearnMore
}) {
  const catalogApi = (catalogId || apiId) ? apiCatalog.find(c => c.id === (catalogId || apiId)) : null;
  const localApis = userApis.length > 0 ? userApis : readLocal("apihub_apis");
  const userApi = apiId ? localApis.find(u => u.id === apiId) : null;
  const api = catalogApi || userApi;
  const isCatalog = Boolean(catalogApi);
  const isGatewaySupported = !isCatalog || Boolean(catalogApi?.testable) || GATEWAY_PROVIDER_SLUGS.has(catalogApi?.id);

  const [activeTab, setActiveTab] = useState("endpoints");
  const [selectedEpIndex, setSelectedEpIndex] = useState(0);
  const [codeLang, setCodeLang] = useState("javascript");
  const [keyModalOpen, setKeyModalOpen] = useState(false);

  // Endpoints state for user APIs
  const [userEndpointsState, setUserEndpointsState] = useState(() => {
    if (isCatalog) return [];
    return readLocal("apihub_endpoints").filter(endpoint => endpoint.apiId === apiId);
  });

  useEffect(() => {
    if (!isCatalog && currentUser && apiId) {
      authFetch(`${API_BASE_URL}/api/my-apis/${apiId}/endpoints`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.data)) {
            setUserEndpointsState(data.data);
            const others = readLocal("apihub_endpoints").filter(e => e.apiId !== apiId);
            writeLocal("apihub_endpoints", [...data.data, ...others]);
          }
        })
        .catch(() => {});
    }
  }, [isCatalog, currentUser, apiId]);

  const endpoints = isCatalog ? (catalogApi.endpoints || []) : userEndpointsState;

  function formatEndpointUrl(baseUrl, path) {
    const cleanBase = (baseUrl || "").trim().replace(/\/+$/, "");
    const cleanPath = (path || "").trim().replace(/^\/+/, "");
    if (!cleanBase) return cleanPath ? `/${cleanPath}` : "";
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
  }

  function openInTester(endpoint) {
    const fullUrl = formatEndpointUrl(api?.baseUrl, endpoint.path);
    navigate("Tester", {
      method: endpoint.method || "GET",
      url: fullUrl,
      baseUrl: api?.baseUrl,
      path: endpoint.path,
      parameters: endpoint.parameters || "",
      body: endpoint.requestBody || endpoint.body || ""
    });
  }

  async function deleteEndpoint(endpointId) {
    if (!window.confirm("Delete this endpoint?")) return;
    if (currentUser && apiId) {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/my-apis/${apiId}/endpoints/${endpointId}`, {
          method: "DELETE"
        });
        const d = await res.json();
        if (!res.ok) {
          alert(d.message || "Failed to delete endpoint from server.");
          return;
        }
      } catch {
        // Fallback to local delete
      }
    }
    const updated = userEndpointsState.filter(e => e.id !== endpointId);
    setUserEndpointsState(updated);
    const allLocal = readLocal("apihub_endpoints").filter(e => e.id !== endpointId);
    writeLocal("apihub_endpoints", allLocal);
    if (showToast) showToast("Endpoint deleted.");
  }

  if (!api) {
    return (
      <main className="pageWrap">
        <h1>API not found</h1>
        <p style={{ color: "var(--muted)" }}>This API could not be located in the marketplace or your workspace.</p>
        <button className="secondaryBtn" onClick={() => navigate("APIs")}>
          ← Back to Marketplace
        </button>
      </main>
    );
  }

  const gatewaySlug = isCatalog ? catalogApi.id : (userApi ? userApi.id : "");
  const gatewayBaseUrl = `${getPublicGatewayBaseUrl()}/api/gateway/${gatewaySlug}`;
  const selectedEp = endpoints[selectedEpIndex] || endpoints[0] || {};
  const fullEndpointGatewayUrl = `${gatewayBaseUrl}${selectedEp.path || ""}`;
  const fullEndpointUrlWithParams = appendQueryParams(fullEndpointGatewayUrl, selectedEp.parameters);

  const epBody = selectedEp.requestBody || selectedEp.body || "";
  const jsSnippet = generateJsCode(selectedEp.method || "GET", fullEndpointUrlWithParams, epBody);
  const pythonSnippet = generatePythonCode(selectedEp.method || "GET", fullEndpointUrlWithParams, epBody);
  const curlSnippet = generateCurlCode(selectedEp.method || "GET", fullEndpointUrlWithParams, epBody);

  const currentSnippet = codeLang === "javascript"
    ? jsSnippet
    : (codeLang === "python" ? pythonSnippet : curlSnippet);

  return (
    <main className="pageWrap">
      <ApiKeyModal
        isOpen={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        currentUser={currentUser}
        navigate={navigate}
        showToast={showToast}
        defaultApi={api ? { slug: api.id, name: api.name, category: api.category } : null}
        onLearnMore={onLearnMore}
      />

      <div className="pageIntro">
        <div>
          <div className="eyebrow">
            {isCatalog ? `CURATED API · ${api.category || "PUBLIC"}` : `PRIVATE USER API · ${api.type || "REST"}`}
          </div>
          <h1>{api.name}</h1>
          <p>{api.description || "No description provided."}</p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button className="primaryBtn" onClick={() => setKeyModalOpen(true)}>
            <Icon name="settings" /> Get API Key
          </button>
          {!isCatalog && onDeleteApi && (
            <button
              className="secondaryBtn"
              style={{ color: "var(--danger)", borderColor: "rgba(255, 130, 150, 0.4)" }}
              onClick={() => onDeleteApi(api.id)}
            >
              Delete API
            </button>
          )}
          <button className="secondaryBtn" onClick={() => navigate("APIs")}>
            ← Back to Marketplace
          </button>
        </div>
      </div>

      {!isGatewaySupported ? (
        <div className="gatewayUrlBar" style={{ borderColor: "rgba(241, 189, 124, 0.4)", background: "rgba(241, 189, 124, 0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
            <span style={{ color: "#f1bd7c", fontWeight: "600", flexShrink: 0 }}>Reference API:</span>
            <span style={{ color: "#dbe7f7", fontSize: "11px" }}>External provider credentials required</span>
            <span className="requiresBadge" style={{ marginLeft: "4px" }}>Credentials needed</span>
          </div>
          <span style={{ fontSize: "10px", color: "var(--muted)", whiteSpace: "nowrap" }}>Catalog Reference</span>
        </div>
      ) : (
        <div className="gatewayUrlBar">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
            <span style={{ color: "var(--muted)", flexShrink: 0 }}>APIHub Gateway URL:</span>
            <code>{gatewayBaseUrl}</code>
            <span className="gatewayBadge">GATEWAY</span>
          </div>
          <button
            className="copySnippetBtn"
            onClick={() => copyToClipboard(gatewayBaseUrl, "Gateway URL copied!")}
          >
            Copy URL
          </button>
        </div>
      )}

      <div className="detailTabs">
        <button
          className={`detailTab ${activeTab === "endpoints" ? "active" : ""}`}
          onClick={() => setActiveTab("endpoints")}
        >
          Endpoints ({endpoints.length})
        </button>
        <button
          className={`detailTab ${activeTab === "documentation" ? "active" : ""}`}
          onClick={() => setActiveTab("documentation")}
        >
          Documentation & Code Examples
        </button>
      </div>

      {activeTab === "endpoints" ? (
        <section className="providerTable" style={{ marginTop: "0" }}>
          <div className="sectionHead">
            <div>
              <div className="eyebrow">OPERATIONS</div>
              <h2>Available Endpoints</h2>
            </div>
            {!isCatalog && (
              <button
                className="primaryBtn"
                onClick={() => navigate("Create Endpoint", { apiId: api.id })}
              >
                + Add Endpoint
              </button>
            )}
          </div>

          {endpoints.length === 0 ? (
            <div className="emptyState">
              <p>No endpoints defined yet for this API.</p>
              {!isCatalog && (
                <button
                  className="primaryBtn"
                  onClick={() => navigate("Create Endpoint", { apiId: api.id })}
                >
                  Create Endpoint
                </button>
              )}
            </div>
          ) : (
            endpoints.map((endpoint, i) => {
              const endpointUrl = formatEndpointUrl(api.baseUrl, endpoint.path);
              const m = (endpoint.method || "GET").toLowerCase();
              return (
                <div
                  className="apiTableRow endpointTableRow"
                  key={endpoint.id || `${endpoint.method}-${endpoint.path}-${i}`}
                  onClick={() => openInTester(endpoint)}
                  title="Click to open in Tester"
                >
                  <div className="apiDot">{endpoint.method}</div>
                  <div>
                    <b>{endpoint.name || endpoint.path}</b>
                    <small>{endpointUrl}</small>
                  </div>
                  <span className={`methodBadge ${m}`}>{endpoint.method}</span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {!isCatalog && (
                      <button
                        className="secondaryBtn"
                        style={{ padding: "7px 10px", fontSize: "9px", color: "var(--danger)", borderColor: "rgba(255, 130, 150, 0.3)" }}
                        onClick={(e) => { e.stopPropagation(); deleteEndpoint(endpoint.id); }}
                        title="Delete Endpoint"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      className="secondaryBtn"
                      style={{ padding: "7px 10px", fontSize: "9px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEpIndex(i);
                        setActiveTab("documentation");
                      }}
                      title="View Docs & Code"
                    >
                      Docs & Code
                    </button>
                    <button
                      className="secondaryBtn testEndpointBtn"
                      onClick={(e) => { e.stopPropagation(); openInTester(endpoint); }}
                      title={isGatewaySupported ? "Test in API Tester" : "Test endpoint in Tester (Requires custom credentials)"}
                    >
                      {isGatewaySupported ? "Test Endpoint →" : "Test with Custom Key →"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      ) : (
        <section className="providerTable" style={{ marginTop: "0" }}>
          {/* Section A: Overview */}
          <div className="sectionHead">
            <div>
              <div className="eyebrow">API DOCUMENTATION</div>
              <h2>Developer Guide</h2>
            </div>
            <button className="primaryBtn" onClick={() => setKeyModalOpen(true)}>
              Get API Key
            </button>
          </div>

          {!isGatewaySupported && (
            <div style={{ background: "rgba(241, 189, 124, 0.08)", border: "1px solid rgba(241, 189, 124, 0.35)", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
              <b style={{ color: "#f1bd7c", display: "block", marginBottom: "6px", fontSize: "12px" }}>
                ⚠️ Reference API — External provider credentials required
              </b>
              <p style={{ color: "#d2dbe8", fontSize: "11px", lineHeight: "1.7", margin: 0 }}>
                This API is currently available in APIHub for documentation and discovery. To use it directly through the APIHub Gateway, provider integration and valid server-side credentials are required.
              </p>
            </div>
          )}

          <div style={{ background: "#070e19", border: "1px solid #1c2e46", borderRadius: "10px", padding: "18px", marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "14px" }}>Authentication</h3>
            <p style={{ color: "var(--muted)", fontSize: "11px", lineHeight: "1.7", margin: "0 0 12px" }}>
              Authenticate external requests to the APIHub Gateway by passing your APIHub API key in the <code>X-API-Key</code> request header.
            </p>
            <div className="docCode" style={{ margin: "0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span>REQUEST HEADER FORMAT</span>
                <button
                  className="copySnippetBtn"
                  onClick={() => copyToClipboard ? copyToClipboard("X-API-Key: YOUR_APIHUB_API_KEY", "Header format copied!") : navigator.clipboard?.writeText("X-API-Key: YOUR_APIHUB_API_KEY")}
                >
                  Copy Header
                </button>
              </div>
              <pre>X-API-Key: YOUR_APIHUB_API_KEY</pre>
            </div>
          </div>

          <div style={{ background: "rgba(100, 220, 203, 0.06)", border: "1px solid rgba(100, 220, 203, 0.25)", borderRadius: "10px", padding: "16px", marginBottom: "24px" }}>
            <b style={{ color: "#64dccb", fontSize: "12px", display: "block", marginBottom: "6px" }}>
              💡 Where to put this API key in your own project:
            </b>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: "#c8d9ed", lineHeight: "1.8" }}>
              <li><b>Step 1:</b> Click <b>Get API Key</b> above to generate your secret key (starts with <code>ah_live_...</code>).</li>
              <li><b>Step 2:</b> In your project root, add it to your <code>.env</code> file: <code>APIHUB_API_KEY=YOUR_APIHUB_API_KEY</code>.</li>
              <li><b>Step 3:</b> Pass <code>X-API-Key: YOUR_APIHUB_API_KEY</code> in your HTTP request headers (e.g. <code>headers: &#123; "X-API-Key": process.env.APIHUB_API_KEY &#125;</code>).</li>
              <li><b>Step 4:</b> Send requests directly to the <b>APIHub Gateway Endpoint</b> below. APIHub verifies your key and safely proxies the request.</li>
            </ul>
          </div>

          {/* Section B: Endpoint details & Code Generator */}
          {endpoints.length > 0 && (
            <div>
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "16px" }}>
                {endpoints.map((ep, idx) => (
                  <button
                    key={idx}
                    className={`filter ${selectedEpIndex === idx ? "active" : ""}`}
                    onClick={() => setSelectedEpIndex(idx)}
                  >
                    <span className={`methodBadge ${(ep.method || "GET").toLowerCase()}`} style={{ marginRight: "6px" }}>
                      {ep.method || "GET"}
                    </span>
                    {ep.path}
                  </button>
                ))}
              </div>

              <article className="docEndpoint" style={{ marginTop: "0" }}>
                <div className="endpointTitle">
                  <div>
                    <span className={`methodBadge ${(selectedEp.method || "GET").toLowerCase()}`}>
                      {selectedEp.method || "GET"}
                    </span>
                    <code>{selectedEp.path}</code>
                  </div>
                  <button onClick={() => openInTester(selectedEp)}>
                    Try in Tester <Icon name="arrow" />
                  </button>
                </div>

                <p style={{ margin: "12px 0 6px", fontSize: "12px", color: "#dbe7f7", fontWeight: "600" }}>
                  {selectedEp.name}
                </p>
                {selectedEp.description && (
                  <p style={{ color: "var(--muted)", fontSize: "11px", margin: "0 0 12px" }}>
                    {selectedEp.description}
                  </p>
                )}

                <div className="gatewayUrlBar" style={{ margin: "12px 0" }}>
                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <span style={{ color: "var(--muted)", marginRight: "8px" }}>Full Gateway Endpoint:</span>
                    <code>{fullEndpointUrlWithParams}</code>
                  </div>
                  <button
                    className="copySnippetBtn"
                    onClick={() => copyToClipboard ? copyToClipboard(fullEndpointUrlWithParams, "Endpoint URL copied!") : navigator.clipboard?.writeText(fullEndpointUrlWithParams)}
                  >
                    Copy Endpoint
                  </button>
                </div>

                {selectedEp.parameters && (
                  <div className="docCode" style={{ margin: "14px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span>QUERY PARAMETERS</span>
                      <button
                        className="copySnippetBtn"
                        onClick={() => copyToClipboard ? copyToClipboard(selectedEp.parameters, "Query parameters copied!") : navigator.clipboard?.writeText(selectedEp.parameters)}
                      >
                        Copy
                      </button>
                    </div>
                    <pre>{selectedEp.parameters}</pre>
                  </div>
                )}

                {epBody && (
                  <div className="docCode" style={{ margin: "14px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span>REQUEST BODY EXAMPLE</span>
                      <button
                        className="copySnippetBtn"
                        onClick={() => copyToClipboard ? copyToClipboard(typeof epBody === "string" ? epBody : JSON.stringify(epBody, null, 2), "Request body copied!") : navigator.clipboard?.writeText(typeof epBody === "string" ? epBody : JSON.stringify(epBody, null, 2))}
                      >
                        Copy
                      </button>
                    </div>
                    <pre>{typeof epBody === "string" ? epBody : JSON.stringify(epBody, null, 2)}</pre>
                  </div>
                )}

                {/* Interactive Code Generator */}
                <div className="codeSnippetWrap">
                  <div className="snippetHeader">
                    <div className="langTabs">
                      <button
                        className={`langTab ${codeLang === "javascript" ? "active" : ""}`}
                        onClick={() => setCodeLang("javascript")}
                      >
                        JavaScript (fetch)
                      </button>
                      <button
                        className={`langTab ${codeLang === "python" ? "active" : ""}`}
                        onClick={() => setCodeLang("python")}
                      >
                        Python (requests)
                      </button>
                      <button
                        className={`langTab ${codeLang === "curl" ? "active" : ""}`}
                        onClick={() => setCodeLang("curl")}
                      >
                        cURL
                      </button>
                    </div>

                    <button
                      className="copySnippetBtn"
                      onClick={() => copyToClipboard ? copyToClipboard(currentSnippet, `${codeLang.toUpperCase()} code copied!`) : navigator.clipboard?.writeText(currentSnippet)}
                    >
                      Copy Code
                    </button>
                  </div>
                  <pre className="snippetBody">{currentSnippet}</pre>
                </div>

                {(selectedEp.responseExample || selectedEp.example) && (
                  <div className="docCode" style={{ margin: "14px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span>EXPECTED RESPONSE EXAMPLE</span>
                      <button
                        className="copySnippetBtn"
                        onClick={() => copyToClipboard ? copyToClipboard(typeof (selectedEp.responseExample || selectedEp.example) === "string" ? (selectedEp.responseExample || selectedEp.example) : JSON.stringify(selectedEp.responseExample || selectedEp.example, null, 2), "Response example copied!") : navigator.clipboard?.writeText(typeof (selectedEp.responseExample || selectedEp.example) === "string" ? (selectedEp.responseExample || selectedEp.example) : JSON.stringify(selectedEp.responseExample || selectedEp.example, null, 2))}
                      >
                        Copy
                      </button>
                    </div>
                    <pre>{typeof (selectedEp.responseExample || selectedEp.example) === "string" ? (selectedEp.responseExample || selectedEp.example) : JSON.stringify(selectedEp.responseExample || selectedEp.example, null, 2)}</pre>
                  </div>
                )}
              </article>
            </div>
          )}

          {/* Section C: Errors & Rate Limits */}
          <div style={{ marginTop: "32px" }}>
            <div className="sectionHead">
              <div>
                <div className="eyebrow">SPECIFICATION</div>
                <h2>Common Gateway Errors & Rate Limits</h2>
              </div>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "11px", lineHeight: "1.7" }}>
              APIHub Gateway enforces a standard rate limit of <b>60 requests per minute</b> per active APIHub key. The gateway returns standard HTTP status codes:
            </p>

            <table className="errorRefTable">
              <thead>
                <tr>
                  <th>Status Code</th>
                  <th>Error Code</th>
                  <th>Meaning & Recovery</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>401</code></td>
                  <td>Unauthorized</td>
                  <td>Missing, invalid, or revoked APIHub API key. Check <code>X-API-Key</code> header.</td>
                </tr>
                <tr>
                  <td><code>403</code></td>
                  <td>Forbidden</td>
                  <td>Attempting to access a private API belonging to another user.</td>
                </tr>
                <tr>
                  <td><code>404</code></td>
                  <td>Not Found</td>
                  <td>API identifier slug or endpoint path was not recognized.</td>
                </tr>
                <tr>
                  <td><code>405</code></td>
                  <td>Method Not Allowed</td>
                  <td>HTTP method (e.g. TRACE) is not permitted. Use GET, POST, PUT, PATCH, or DELETE.</td>
                </tr>
                <tr>
                  <td><code>429</code></td>
                  <td>Too Many Requests</td>
                  <td>Rate limit exceeded. Default limit: 60 requests/minute per API key. The server may use a different configured limit. Wait 60 seconds before retrying.</td>
                </tr>
                <tr>
                  <td><code>503</code></td>
                  <td>Provider Not Configured</td>
                  <td>Upstream third-party credentials must be set in server environment variables.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
function Placeholder({ title, navigate }) {
  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">APIHUB</div>
          <h1>{title}</h1>
          <p>This section is ready for the next APIHub feature.</p>
        </div>

        <button
          className="secondaryBtn"
          onClick={() => navigate("Home")}
        >
          ← Back to Home
        </button>
      </div>
    </main>
  );
}
function CreateAPI({ navigate, currentUser, onApiCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [type, setType] = useState("REST");
  const [saving, setSaving] = useState(false);

  async function saveAPI() {
    if (!name.trim() || !baseUrl.trim()) {
      alert("API Name and Base URL are required.");
      return;
    }

    setSaving(true);
    const localApis = readLocal("apihub_apis");
    const newApi = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      baseUrl: baseUrl.trim(),
      type,
      createdAt: new Date().toISOString()
    };

    if (currentUser) {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/my-apis`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newApi)
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.message || "Failed to create API on server.");
          setSaving(false);
          return;
        }
        const created = data.data || newApi;
        writeLocal("apihub_apis", [created, ...localApis.filter(x => x.id !== created.id)]);
        if (onApiCreated) onApiCreated(created);
        alert("API created successfully!");
        navigate("APIs");
        return;
      } catch {
        // Fallback to local save
      }
    }

    writeLocal("apihub_apis", [newApi, ...localApis]);
    if (onApiCreated) onApiCreated(newApi);
    alert("API created successfully!");
    navigate("APIs");
  }

  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">API PROVIDER</div>
          <h1>Create API</h1>
          <p>Create and manage your own API.</p>
        </div>

        <button
          className="secondaryBtn"
          onClick={() => navigate("APIs")}
        >
          ← Back
        </button>
      </div>

      <section className="createApiCard">

        <div className="formGroup">
          <label>API Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Student API"
          />
        </div>

        <div className="formGroup">
          <label>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe your API..."
          />
        </div>

        <div className="formGroup">
          <label>Base URL</label>
          <input
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://example.com/api"
          />
        </div>

        <div className="formGroup">
          <label>API Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
          >
            <option value="REST">REST</option>
            <option value="Testing">Testing</option>
          </select>
        </div>

        <button
          className="primaryBtn"
          onClick={saveAPI}
          disabled={saving}
        >
          {saving ? "Creating…" : "Create API"}
        </button>

      </section>
    </main>
  );
}
function CreateEndpoint({ navigate, apiId, currentUser, userApis = [], onEndpointCreated }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parameters, setParameters] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [responseExample, setResponseExample] = useState("");
  const [saving, setSaving] = useState(false);

  const apis = userApis.length > 0 ? userApis : readLocal("apihub_apis");

  const [selectedParentId, setSelectedParentId] = useState(() => {
    if (apiId && apis.some(api => api.id === apiId)) return apiId;
    return apis[0]?.id || "";
  });

  const parentApi = apis.find(api => api.id === selectedParentId);

  async function saveEndpoint() {
    if (!parentApi || !parentApi.id) {
      alert("Please select a valid parent API before creating an endpoint.");
      return;
    }

    if (!name.trim()) {
      alert("Endpoint Name is required.");
      return;
    }

    if (!path.trim()) {
      alert("Endpoint Path is required.");
      return;
    }

    setSaving(true);
    const localEndpoints = readLocal("apihub_endpoints");

    const endpoint = {
      id: crypto.randomUUID(),
      apiId: parentApi.id,
      method,
      path: path.trim(),
      name: name.trim(),
      description: description.trim(),
      parameters: parameters.trim(),
      requestBody: requestBody.trim(),
      responseExample: responseExample.trim(),
      createdAt: new Date().toISOString()
    };

    if (currentUser) {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/my-apis/${parentApi.id}/endpoints`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpoint)
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.message || "Failed to create endpoint on server.");
          setSaving(false);
          return;
        }
        const created = data.data || endpoint;
        writeLocal("apihub_endpoints", [created, ...localEndpoints.filter(x => x.id !== created.id)]);
        if (onEndpointCreated) onEndpointCreated(created);
        alert("Endpoint created successfully!");
        navigate("API Details", { apiId: parentApi.id });
        return;
      } catch {
        // Fallback to local save
      }
    }

    writeLocal("apihub_endpoints", [endpoint, ...localEndpoints]);
    if (onEndpointCreated) onEndpointCreated(endpoint);

    alert("Endpoint created successfully!");
    navigate("API Details", { apiId: parentApi.id });
  }

  if (apis.length === 0) {
    return (
      <main className="pageWrap">
        <div className="pageIntro">
          <div>
            <div className="eyebrow">API PROVIDER</div>
            <h1>Create Endpoint</h1>
            <p>You need to create an API first before defining endpoints.</p>
          </div>
          <button className="secondaryBtn" onClick={() => navigate("APIs")}>
            ← Back to APIs
          </button>
        </div>
        <section className="createApiCard emptyState">
          <p>No APIs found in your workspace. Please create an API first.</p>
          <button className="primaryBtn" onClick={() => navigate("Create API")}>
            Create an API
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="pageWrap">

      <div className="pageIntro">
        <div>
          <div className="eyebrow">API PROVIDER</div>
          <h1>Create Endpoint</h1>
          <p>
            Define an endpoint, its request data and expected response.
          </p>
        </div>

        <button
          className="secondaryBtn"
          onClick={() => parentApi ? navigate("API Details", { apiId: parentApi.id }) : navigate("APIs")}
        >
          {parentApi ? "← Back to API" : "← Back to APIs"}
        </button>
      </div>

      <section className="createApiCard">

        <div className="formGroup">
          <label>
            Parent API
            {parentApi && (
              <span className="parentApiBadge">
                ◈ {parentApi.name} ({parentApi.type || "REST"})
              </span>
            )}
          </label>
          <select
            value={selectedParentId}
            onChange={e => setSelectedParentId(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "9px" }}
          >
            <option value="">-- Choose Parent API --</option>
            {apis.map(api => (
              <option key={api.id} value={api.id}>
                {api.name} ({api.baseUrl})
              </option>
            ))}
          </select>
          {parentApi && (
            <small style={{ display: "block", color: "#62738a", marginTop: "6px", fontFamily: "monospace" }}>
              Base URL: {parentApi.baseUrl}
            </small>
          )}
        </div>

        <div className="formGroup">
          <label>Endpoint Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Get All Students"
          />
        </div>

        <div className="formGroup">
          <label>HTTP Method</label>
          <select
            value={method}
            onChange={e => setMethod(e.target.value)}
          >
            {METHODS.map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="formGroup">
          <label>Endpoint Path</label>
          <input
            value={path}
            onChange={e => setPath(e.target.value)}
            placeholder="/students"
          />
        </div>

        <div className="formGroup">
          <label>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what this endpoint does..."
          />
        </div>

        <div className="formGroup">
          <label>Parameters</label>
          <textarea
            value={parameters}
            onChange={e => setParameters(e.target.value)}
            placeholder="page=1&#10;limit=10"
          />
        </div>

        <div className="formGroup">
          <label>Request Body</label>
          <textarea
            value={requestBody}
            onChange={e => setRequestBody(e.target.value)}
            placeholder={'{\n  "name": "John"\n}'}
          />
        </div>

        <div className="formGroup">
          <label>Response Example</label>
          <textarea
            value={responseExample}
            onChange={e => setResponseExample(e.target.value)}
            placeholder={'{\n  "id": 1,\n  "name": "John"\n}'}
          />
        </div>

        <button
          className="primaryBtn"
          onClick={saveEndpoint}
          disabled={saving}
        >
          {saving ? "Creating…" : "Create Endpoint"}
        </button>

      </section>
    </main>
  );
}

function Explore({ navigate, catalog }) {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("All");
  const filtered = catalog.filter(api => { const text=[api.name,api.desc,api.category,...(api.keywords||[])].join(" ").toLowerCase(); return text.includes(query.toLowerCase().trim()) && (category === "All" || api.category === category || api.tags?.includes(category)); });
  return <main className="pageWrap"><div className="pageIntro"><div><div className="eyebrow">API EXPLORER</div><h1>Discover APIs built for real workflows.</h1><p>Search public APIs and load only verified keyless examples directly into Tester.</p></div></div><div className="toolbar exploreToolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, description, category, or keyword..."/><button onClick={()=>{setQuery("");setCategory("All");}}>Reset</button></div><div className="filterBar">{CATEGORIES.map(item=><button key={item} className={category===item?"filter active":"filter"} onClick={()=>setCategory(item)}>{item}</button>)}</div><p className="exploreCount">{filtered.length} APIs found</p>{filtered.length ? <div className="catalogGrid">{filtered.map(api=><ApiCard key={api.id} api={api} navigate={navigate}/>)}</div> : <div className="emptyState"><p>No APIs match those filters.</p><button className="primaryBtn" onClick={()=>{setQuery("");setCategory("All");}}>Clear filters</button></div>}</main>;
}
function CatalogDetails({ api, navigate }) {
  if (!api) return <main className="pageWrap"><div className="emptyState"><p>This catalog API is unavailable.</p><button className="primaryBtn" onClick={()=>navigate("Explore")}>Back to Explore</button></div></main>;
  return <main className="pageWrap"><div className="pageIntro"><div><div className="eyebrow">API LIBRARY</div><h1>{api.name}</h1><p>{api.description}</p></div><button className="secondaryBtn" onClick={()=>navigate("Explore")}>← Back to Explore</button></div><section className="providerTable"><p><b>Category:</b> {api.category}</p><p><b>Authentication:</b> {api.authentication}</p><p><b>Base URL:</b> <code>{api.baseUrl}</code></p><a className="textBtn" href={api.reference} target="_blank" rel="noreferrer">Official documentation ↗</a></section><section className="providerTable"><div className="sectionHead"><div><div className="eyebrow">DOCUMENTED ENDPOINTS</div><h2>{api.endpoints.length} endpoint{api.endpoints.length === 1 ? "" : "s"}</h2></div></div>{api.endpoints.map(endpoint=><article className="docEndpoint" key={`${api.id}-${endpoint.method}-${endpoint.path}`}><div className="endpointTitle"><div><span className={`methodBadge ${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><code>{endpoint.path}</code></div>{api.testable && <button onClick={()=>navigate("Tester",{method:endpoint.method,baseUrl:api.baseUrl,path:endpoint.path,parameters:endpoint.parameters,body:endpoint.body})}>Try API <Icon name="arrow"/></button>}</div><p>{endpoint.name}</p><div className="docCode"><span>EXAMPLE REQUEST</span><pre>{endpoint.exampleRequest}</pre><span>QUERY PARAMETERS</span><pre>{endpoint.parameters || "No query parameters."}</pre><span>EXAMPLE RESPONSE</span><pre>{endpoint.example}</pre></div></article>)}{!api.testable && <div className="docNotice">This API is documented here but not directly testable because it needs credentials or provider-specific setup. APIHub never supplies or stores a key for it.</div>}</section></main>;
}
function AccountPage({ navigate, mode, onAuthenticated, showToast }) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const isEmailValid = /^\S+@\S+\.\S+$/.test(email);
  const isLengthValid = password.length >= 8;
  const isMatchValid = confirm.length > 0 && password === confirm;

  useEffect(() => {
    setMessage("");
    setSuccessMsg("");
    setShowPassword(false);
    setShowConfirm(false);
  }, [mode]);

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    setSuccessMsg("");

    if (!isEmailValid) {
      return setMessage("Please enter a valid email address.");
    }
    if (!isLengthValid) {
      return setMessage("Password must contain at least 8 characters.");
    }
    if (isSignup && password !== confirm) {
      return setMessage("Passwords do not match. Please verify your confirm password.");
    }

    setLoading(true);
    try {
      const endpoint = isSignup ? `${API_BASE_URL}/api/auth/signup` : `${API_BASE_URL}/api/auth/signin`;
      const bodyPayload = isSignup
        ? { email, password, name: name.trim() || undefined }
        : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (isSignup ? "Unable to create account." : "Invalid email or password."));
      }

      if (data.token) {
        setAuthToken(data.token);
      }

      if (isSignup) {
        setSuccessMsg(`Welcome to APIHub${name.trim() ? `, ${name.trim()}` : ""}! Account created successfully.`);
        if (showToast) showToast("Account created successfully!");
        setTimeout(() => {
          onAuthenticated(data.user);
          navigate("Dashboard");
        }, 900);
      } else {
        if (showToast) showToast("Signed in successfully!");
        onAuthenticated(data.user);
        navigate("Dashboard");
      }
    } catch (error) {
      setMessage(error.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authContainer">
      <div className="authCard">
        <div className="authBadge">
          <span>◈</span> {isSignup ? "DEVELOPER REGISTRATION" : "AUTHENTICATED ACCESS"}
        </div>
        <h1>{isSignup ? "Create Developer Account" : "Sign In to APIHub"}</h1>
        <p className="authSubtitle">
          {isSignup
            ? "Join developers testing, cataloging, and building with the APIHub Gateway."
            : "Welcome back! Enter your credentials to manage your API keys, saved requests, and custom endpoints."}
        </p>

        {message && (
          <div className="authErrorBanner" style={{ marginBottom: "16px" }}>
            <span>⚠️</span> {message}
          </div>
        )}

        {successMsg && (
          <div className="authSuccessBanner" style={{ marginBottom: "16px" }}>
            <span>✓</span> {successMsg}
          </div>
        )}

        <form onSubmit={submit} className="authForm">
          {isSignup && (
            <div className="authFormGroup">
              <label htmlFor="auth-name">Full Name (Optional)</label>
              <div className="authInputWrap">
                <input
                  id="auth-name"
                  type="text"
                  className="authInput authInputNoToggle"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex Hunter"
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="authFormGroup">
            <label htmlFor="auth-email">Email Address</label>
            <div className="authInputWrap">
              <input
                id="auth-email"
                type="email"
                className="authInput authInputNoToggle"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="developer@example.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="authFormGroup">
            <label htmlFor="auth-pwd">Password</label>
            <div className="authInputWrap">
              <input
                id="auth-pwd"
                type={showPassword ? "text" : "password"}
                className="authInput"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
                required
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className="authToggleBtn"
                onClick={() => setShowPassword(v => !v)}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {isSignup && (
            <div className="authFormGroup">
              <label htmlFor="auth-confirm">Confirm Password</label>
              <div className="authInputWrap">
                <input
                  id="auth-confirm"
                  type={showConfirm ? "text" : "password"}
                  className="authInput"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="authToggleBtn"
                  onClick={() => setShowConfirm(v => !v)}
                  title={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>

              <div className="pwdValidationBox">
                <div className={`valItem ${isLengthValid ? "valid" : (password ? "invalid" : "")}`}>
                  <span>{isLengthValid ? "✓" : "○"}</span> At least 8 characters
                </div>
                {confirm && (
                  <div className={`valItem ${isMatchValid ? "valid" : "invalid"}`}>
                    <span>{isMatchValid ? "✓" : "○"}</span> {isMatchValid ? "Passwords match" : "Passwords do not match"}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="authSubmitBtn"
            disabled={loading || !!successMsg}
          >
            {loading ? (
              <span>Working…</span>
            ) : isSignup ? (
              <><span>Create Free Account</span> <Icon name="arrow" /></>
            ) : (
              <><span>Sign In to Dashboard</span> <Icon name="arrow" /></>
            )}
          </button>
        </form>

        <div className="authFooterLinks">
          <button
            type="button"
            className="authSwitchBtn"
            onClick={() => navigate(isSignup ? "Sign In" : "Sign Up")}
          >
            {isSignup ? "Already have an account?" : "Need an account?"}{" "}
            <strong>{isSignup ? "Sign In" : "Sign Up free"} →</strong>
          </button>
          <button
            type="button"
            className="authBackHome"
            onClick={() => navigate("Home")}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
function Dashboard({ navigate, user, showToast, copyToClipboard, onLearnMore }) {
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("all");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [dashLang, setDashLang] = useState("curl");
  const [sampleApiSlug, setSampleApiSlug] = useState("open-meteo");

  const load = () => authFetch(`${API_BASE_URL}/api/api-keys`)
    .then(r => r.json())
    .then(d => { if (d.success) setKeys(d.data); else setMessage(d.message); })
    .catch(() => setMessage("Unable to load API keys."));

  useEffect(() => { if (user) load(); }, [user]);

  async function create() {
    setMessage("");
    setLoading(true);
    try {
      const target = selectedSlug === "all" ? null : apiCatalog.find(a => a.id === selectedSlug);
      const payload = {
        name: name.trim() || (target ? `${target.name} Key` : "Global Developer Key"),
        apiSlug: target ? target.id : "all",
        apiName: target ? target.name : "All APIs (Full Access)",
        category: target ? target.category : "All Categories"
      };
      const r = await authFetch(`${API_BASE_URL}/api/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (!r.ok) {
        setMessage(d.message || "Failed to create key.");
        setLoading(false);
        return;
      }
      setSecret(d.secret);
      setName("");
      load();
      if (showToast) showToast("API Key created successfully!");
    } catch {
      setMessage("Network error creating key.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id) {
    if (!window.confirm("Are you sure you want to revoke this API key? Requests using it will fail immediately.")) return;
    const r = await authFetch(`${API_BASE_URL}/api/api-keys/${id}/revoke`, {
      method: "POST"
    });
    if (!r.ok) {
      const d = await r.json();
      setMessage(d.message);
    } else {
      if (showToast) showToast("API key revoked.");
    }
    load();
  }

  if (!user) return (
    <main className="pageWrap">
      <div className="emptyState">
        <p>Sign in to manage APIHub API keys.</p>
        <button className="primaryBtn" onClick={() => navigate("Sign In")}>Sign in</button>
      </div>
    </main>
  );

  const sampleApi = apiCatalog.find(a => a.id === sampleApiSlug) || apiCatalog[0];
  const sampleEp = sampleApi.endpoints?.[0] || { method: "GET", path: "" };
  const gatewayHost = getPublicGatewayBaseUrl();
  const sampleUrl = `${gatewayHost}/api/gateway/${sampleApi.id}${sampleEp.path || ""}`;
  const codeSnippets = {
    curl: generateCurlCode(sampleEp.method || "GET", sampleUrl, sampleEp.body),
    javascript: generateJsCode(sampleEp.method || "GET", sampleUrl, sampleEp.body),
    python: generatePythonCode(sampleEp.method || "GET", sampleUrl, sampleEp.body)
  };

  const activeKeysCount = keys.filter(k => k.status === "Active").length;
  const totalRequests = keys.reduce((sum, k) => sum + (k.usage || 0), 0);

  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">DEVELOPER PLATFORM DASHBOARD</div>
          <h1>Welcome, {formatUserGreetingName(user)}!</h1>
          <p>Generate, manage, and monitor your APIHub-issued developer API keys across 18 real API categories.</p>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="dashMetricsGrid">
        <div className="metricCard">
          <div className="metricLabel">ACTIVE KEYS</div>
          <div className="metricVal" style={{ color: "#4ee2c5" }}>{activeKeysCount}</div>
          <div className="metricSub">of {keys.length} total generated</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">GATEWAY CALLS</div>
          <div className="metricVal" style={{ color: "#8c9aff" }}>{totalRequests}</div>
          <div className="metricSub">processed through APIHub Gateway</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">SUPPORTED CATEGORIES</div>
          <div className="metricVal" style={{ color: "#f1bd7c" }}>{CATEGORIES.length}</div>
          <div className="metricSub">100% verified real upstream APIs</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">PLATFORM RATE LIMIT</div>
          <div className="metricVal" style={{ color: "#64dccb" }}>60/min</div>
          <div className="metricSub">per active API key</div>
        </div>
      </div>

      {/* Key Generation Panel */}
      <section className="providerTable">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">KEY DISTRIBUTION</div>
            <h2>Generate New API Key</h2>
          </div>
        </div>
        <p className="docNotice">
          Issue scoped keys for specific APIs (e.g. Weather, Finance, AI) or create a global key with access across all 18 categories.
        </p>

        <div className="keyGenForm">
          <div className="formGroup">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={{ display: "block", fontSize: "10px", color: "#8fa3be", margin: 0 }}>API Scope / Target</label>
              <AiHintTrigger
                hintId="hint_dash_scope"
                title="Key Scoping"
                text="Scoped keys restrict access to a specific service. Global keys provide access across all 18 categories."
                aiPrompt="Explain how APIHub API key scopes work and how the gateway enforces tenant isolation."
                onLearnMore={onLearnMore}
                position="bottom"
                align="right"
              />
            </div>
            <select
              value={selectedSlug}
              onChange={e => {
                const val = e.target.value;
                setSelectedSlug(val);
                if (val !== "all") {
                  const t = apiCatalog.find(a => a.id === val);
                  if (t) setName(`${t.name} Key`);
                } else {
                  setName("Global Developer Key");
                }
              }}
            >
              <option value="all">⚡ All APIs (Full Access - All 18 Categories)</option>
              {CATEGORIES.map(cat => (
                <optgroup key={cat} label={`📂 ${cat}`}>
                  {apiCatalog.filter(a => a.category === cat).map(api => (
                    <option key={api.id} value={api.id}>{api.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="formGroup">
            <label style={{ display: "block", fontSize: "10px", color: "#8fa3be", marginBottom: "4px" }}>Key Name / Client</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Production Weather App"
              onKeyDown={e => e.key === "Enter" && create()}
            />
          </div>

          <div className="formGroup" style={{ alignSelf: "flex-end" }}>
            <button className="primaryBtn" onClick={create} disabled={loading} style={{ height: "42px", padding: "0 22px" }}>
              {loading ? "Generating…" : "Generate API Key"}
            </button>
          </div>
        </div>

        {secret && (
          <div className="successBox" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", background: "rgba(100, 220, 203, 0.12)", border: "1px solid rgba(100, 220, 203, 0.35)", padding: "16px", borderRadius: "10px", margin: "20px 0" }}>
            <div>
              <b style={{ color: "#64dccb", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", fontSize: "13px" }}>
                ✓ API Key Created: Copy it now
              </b>
              <code style={{ display: "block", marginTop: "4px", fontSize: "13px", wordBreak: "break-all", color: "#fff", fontFamily: "monospace" }}>
                {secret}
              </code>
              <small style={{ color: "#f1bd7c", display: "block", marginTop: "8px", fontSize: "10px" }}>
                ⚠️ <b>Save this key immediately!</b> APIHub never stores raw keys. This secret cannot be recovered after leaving this page.
              </small>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="primaryBtn"
                style={{ padding: "8px 16px", fontSize: "12px" }}
                onClick={() => copyToClipboard ? copyToClipboard(secret, "API Key copied to clipboard!") : navigator.clipboard?.writeText(secret)}
              >
                Copy API Key
              </button>
              <button
                className="secondaryBtn"
                style={{ padding: "8px 12px", fontSize: "12px" }}
                onClick={() => setSecret("")}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {message && <div className="errorBox" style={{ margin: "14px 0" }}>{message}</div>}
      </section>

      {/* "My API Keys" Table */}
      <section className="providerTable">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">DEVELOPER ACCESS</div>
            <h2>My API Keys ({keys.length})</h2>
          </div>
          <span style={{ fontSize: "11px", color: "#687c96" }}>
            {activeKeysCount} Active · {keys.length - activeKeysCount} Revoked
          </span>
        </div>

        {keys.length === 0 ? (
          <div className="emptyState" style={{ margin: "16px 0", padding: "36px" }}>
            <p style={{ color: "#a8bad0" }}>No API keys yet.</p>
            <p style={{ fontSize: "11px", color: "#607289", margin: "4px 0 14px" }}>Generate your first key above to start making authenticated calls to the APIHub Gateway.</p>
          </div>
        ) : (
          <div className="keyTableWrap">
            <table className="keysTable">
              <thead>
                <tr>
                  <th>API Scope</th>
                  <th>Category</th>
                  <th>Key Name & Prefix</th>
                  <th>Usage</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "#f0f5ff" }}>
                        {k.apiSlug === "all" ? "⚡ All APIs (Full Access)" : (k.apiName || k.apiSlug)}
                      </div>
                    </td>
                    <td>
                      <span className={`categoryPill ${k.apiSlug === "all" ? "globalPill" : ""}`}>
                        {k.category || (k.apiSlug === "all" ? "All Categories" : "General")}
                      </span>
                    </td>
                    <td>
                      <div style={{ color: "#d1def0", fontWeight: 500 }}>{k.name}</div>
                      <code style={{ fontSize: "10px", color: "#71859f" }}>{k.prefix}••••</code>
                    </td>
                    <td>
                      <span className="usageBadge">{k.usage || 0} reqs</span>
                    </td>
                    <td style={{ fontSize: "11px", color: "#8fa3bd" }}>
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={k.status === "Active" ? "statusActive" : "statusRevoked"}>
                        {k.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          className="actionBtn"
                          title="Copy Prefix"
                          onClick={() => copyToClipboard ? copyToClipboard(k.prefix, "Key prefix copied!") : navigator.clipboard?.writeText(k.prefix)}
                        >
                          Copy
                        </button>
                        {k.status === "Active" && (
                          <button
                            className="actionBtn danger"
                            onClick={() => revoke(k.id)}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Developer Quickstart & Code Generator */}
      <section className="providerTable">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">INTEGRATION GUIDE</div>
            <h2>Connect Your Project to the Gateway</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "#8fa3be" }}>API Preview:</span>
            <select
              style={{ background: "#050c17", border: "1px solid #223751", color: "#fff", padding: "6px 10px", borderRadius: "6px", fontSize: "11px" }}
              value={sampleApiSlug}
              onChange={e => setSampleApiSlug(e.target.value)}
            >
              {apiCatalog.map(a => (
                <option key={a.id} value={a.id}>[{a.category}] {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <p style={{ color: "var(--muted)", fontSize: "12px", lineHeight: "1.6" }}>
          All requests are routed through the APIHub Gateway using your <code>X-API-Key: ah_live_...</code>.
        </p>

        <div style={{ background: "rgba(100, 220, 203, 0.06)", border: "1px solid rgba(100, 220, 203, 0.25)", borderRadius: "10px", padding: "16px", margin: "16px 0" }}>
          <b style={{ color: "#64dccb", fontSize: "12px", display: "block", marginBottom: "6px" }}>
            💡 Where to put your API key in your project:
          </b>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: "#c8d9ed", lineHeight: "1.8" }}>
            <li>Store the key in your project's <code>.env</code> file: <code>APIHUB_API_KEY=YOUR_APIHUB_API_KEY</code></li>
            <li>Add the <code>X-API-Key</code> header to your API requests to <code>{getPublicGatewayBaseUrl()}/api/gateway/{sampleApi.id}...</code></li>
            <li>Never commit your API key to public source code or Git repositories.</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: "8px", margin: "16px 0 10px" }}>
          {[
            { id: "curl", label: "cURL" },
            { id: "javascript", label: "JavaScript (Fetch)" },
            { id: "python", label: "Python (requests)" }
          ].map(tab => (
            <button
              key={tab.id}
              className={`filter ${dashLang === tab.id ? "active" : ""}`}
              onClick={() => setDashLang(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="docCode" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span>SAMPLE REQUEST ({dashLang.toUpperCase()}) — {sampleApi.name}</span>
            <button
              className="copySnippetBtn"
              onClick={() => copyToClipboard ? copyToClipboard(codeSnippets[dashLang], `${dashLang.toUpperCase()} code copied!`) : navigator.clipboard?.writeText(codeSnippets[dashLang])}
            >
              Copy Code
            </button>
          </div>
          <pre style={{ overflowX: "auto" }}>{codeSnippets[dashLang]}</pre>
        </div>
      </section>
    </main>
  );
}
function Footer({ navigate, currentUser, signOut, onOpenReview }) {
  return (
    <footer className="globalFooter">
      <div className="footerInner">
        <div className="footerTopGrid">
          <div className="footerBrandCol">
            <button className="footerBrand" onClick={() => navigate("Home")}>
              <div className="logoMark"><span>API</span></div>
              <div>
                <strong>APIHub</strong>
                <small>API MANAGEMENT & DEVELOPER PLATFORM</small>
              </div>
            </button>
            <p className="footerDesc">
              Discover, document, test, and authenticate APIs in one unified workspace. Connect your applications directly to the high-performance APIHub Gateway with secure SHA-256 API keys.
            </p>
            <div className="footerOwnerBadge">
              <span className="ownerDot" /> Platform Architect & Owner: <strong>Avdesh Gurjar</strong>
            </div>
            <p className="footerBio">
              Avdesh Gurjar is a full-stack engineer and API architect focused on high-performance developer tooling, distributed gateway systems, and seamless developer experience.
            </p>
          </div>

          <div className="footerNavCol">
            <h4>Platform</h4>
            <ul>
              <li><button onClick={() => navigate("APIs")}>API Catalog</button></li>
              <li><button onClick={() => navigate("Tester")}>API Tester</button></li>
              <li><button onClick={() => navigate("Documentation")}>Documentation</button></li>
              <li><button onClick={() => navigate("Explore")}>Explore Marketplace</button></li>
              <li><button onClick={() => navigate("Learn")}>Learning Center</button></li>
              <li><button onClick={onOpenReview}>Write a Review</button></li>
            </ul>
          </div>

          <div className="footerNavCol">
            <h4>Developer Access</h4>
            <ul>
              {currentUser ? (
                <>
                  <li><button onClick={() => navigate("Dashboard")}>Account Dashboard</button></li>
                  <li><button onClick={() => navigate("Create API")}>Publish Custom API</button></li>
                  <li><button onClick={() => navigate("History")}>Request History</button></li>
                  <li><button onClick={signOut}>Sign Out ({currentUser.email})</button></li>
                </>
              ) : (
                <>
                  <li><button onClick={() => navigate("Sign In")}>Sign In</button></li>
                  <li><button onClick={() => navigate("Sign Up")}>Create Free Account</button></li>
                  <li><button onClick={() => navigate("Documentation")}>Gateway Auth (X-API-Key)</button></li>
                </>
              )}
              <li><button onClick={onOpenReview}>Give Feedback</button></li>
              <li><button onClick={() => navigate("Privacy")}>Privacy & Security</button></li>
            </ul>
          </div>
        </div>

        <div className="footerDivider" />

        <div className="footerBottomBar">
          <div>© 2026 APIHub. All rights reserved.</div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <span className="gatewayStatusPill">
              <span /> Gateway Live · 60 req/min
            </span>
            <span>Built by Avdesh Gurjar</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Privacy({ navigate }) {
  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">APIHUB SECURITY & PRIVACY</div>
          <h1>Privacy & Security Architecture</h1>
          <p>
            APIHub is architected with developer security, data isolation, and API key protection at its foundation.
          </p>
        </div>
        <button className="secondaryBtn" onClick={() => navigate("Home")}>
          ← Back home
        </button>
      </div>

      <section className="providerTable">
        <h2>Security & Data Protection Standards</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px", marginTop: "18px" }}>
          <div style={{ background: "#060c16", border: "1px solid #1a2a40", borderRadius: "12px", padding: "18px" }}>
            <h3 style={{ fontSize: "14px", margin: "0 0 8px", color: "#64dccb" }}>🔒 Cryptographic Key Hashing</h3>
            <p style={{ color: "#8b9db5", fontSize: "11px", lineHeight: "1.7", margin: 0 }}>
              APIHub API keys are generated using 32 bytes of cryptographically secure random entropy. PostgreSQL only stores the 64-character SHA-256 hash. Raw keys are never stored in databases, logs, or localStorage.
            </p>
          </div>

          <div style={{ background: "#060c16", border: "1px solid #1a2a40", borderRadius: "12px", padding: "18px" }}>
            <h3 style={{ fontSize: "14px", margin: "0 0 8px", color: "#6f7eff" }}>🛡️ Secure Session Cookies</h3>
            <p style={{ color: "#8b9db5", fontSize: "11px", lineHeight: "1.7", margin: 0 }}>
              User authentication uses HTTP-only JSON Web Token cookies signed with HMAC-SHA256. Tokens cannot be accessed by client-side JavaScript, guarding against XSS token leakage.
            </p>
          </div>

          <div style={{ background: "#060c16", border: "1px solid #1a2a40", borderRadius: "12px", padding: "18px" }}>
            <h3 style={{ fontSize: "14px", margin: "0 0 8px", color: "#5fe0bc" }}>⚡ Gateway Proxy Protection</h3>
            <p style={{ color: "#8b9db5", fontSize: "11px", lineHeight: "1.7", margin: 0 }}>
              All gateway requests are rate-limited (60 requests/minute default) and proxied server-side. Upstream credentials remain strictly on the backend, ensuring zero credential exposure to clients.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
