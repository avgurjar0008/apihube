import { useEffect, useMemo, useState } from "react";
import { apiCatalog, categories as CATEGORIES } from "./apiCatalog";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const NAV = ["Home", "APIs", "Tester", "Documentation", "Explore", "AI Assistant", "Learn", "History"];
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
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
    home: "⌂", api: "◈", tester: "⌁", docs: "▤", explore: "◎", ai: "✦", learn: "◉", history: "↺", collection: "▦", settings: "⚙", plus: "+", arrow: "→", menu: "☰"
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
  const [page, setPage] = useState("Home");
  const [selectedApiId, setSelectedApiId] = useState(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState(null);
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/posts/1");
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userApis, setUserApis] = useState(() => readLocal("apihub_apis"));
  const [userEndpoints, setUserEndpoints] = useState(() => readLocal("apihub_endpoints"));
  const [toast, setToast] = useState(null);

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
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => setCurrentUser(data?.user || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetch(`${API_BASE_URL}/api/my-apis`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.data)) {
            setUserApis(data.data);
            writeLocal("apihub_apis", data.data);
          }
        })
        .catch(() => {});
    } else {
      setUserApis(readLocal("apihub_apis"));
      setUserEndpoints(readLocal("apihub_endpoints"));
    }
  }, [currentUser]);

  async function signOut() {
    await fetch(`${API_BASE_URL}/api/auth/signout`, { method: "POST", credentials: "include" });
    setCurrentUser(null);
    setUserApis(readLocal("apihub_apis"));
    setUserEndpoints(readLocal("apihub_endpoints"));
    navigate("Home");
  }

  async function handleDeleteApi(idToDelete) {
    if (!window.confirm("Delete this API and all its endpoints? This action cannot be undone.")) return;

    if (currentUser) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/my-apis/${idToDelete}`, {
          method: "DELETE",
          credentials: "include"
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

  function navigate(next, data = null) {

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

  if (next === "Tester" && data) {
    if (data.savedRequest) {
      const request = data.savedRequest;
      setMethod(request.method || "GET");
      setUrl(request.url || "");
      setHeaders(typeof request.headers === "string" ? request.headers : "");
      setBody(typeof request.body === "string" ? request.body : "");
      setParams(Array.isArray(request.params)
        ? request.params.map(param => ({
            key: String(param?.key || ""),
            value: String(param?.value || ""),
            enabled: param?.enabled !== false
          }))
        : []);
      return;
    }

    setMethod(data.method || "GET");

    const baseUrl = (data.baseUrl || "").trim().replace(/\/+$/, "");
    const path = (data.path || "").trim().replace(/^\/+/, "");
    const fullUrl = data.url
      ? data.url
      : (baseUrl && path ? `${baseUrl}/${path}` : (baseUrl || (path ? `/${path}` : "")));

    setUrl(fullUrl);

    if (data.parameters) {
      const params = data.parameters
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

      setParams(params);
      if (params.length > 0) {
        setTab("Params");
      }
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
      const r = await fetch(`${API_BASE_URL}/api/requests/execute`, {
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
  function saveRequest() {
  const saved = [{
    id: crypto.randomUUID(),
    method,
    url,
    headers,
    body,
    params
  }, ...savedRequests];

  writeLocal("apihub_saved_requests", saved);
  setSavedRequests(saved);
  alert("Request saved successfully!");
}
  function openSavedRequest(request) {
    navigate("Tester", { savedRequest: request });
  }
  function deleteSavedRequest(index) {
    const updated = savedRequests.filter((_, requestIndex) => requestIndex !== index);
    writeLocal("apihub_saved_requests", updated);
    setSavedRequests(updated);
  }
  function clearSavedRequests() {
    if (!window.confirm("Clear all saved requests? This cannot be undone.")) return;
    localStorage.removeItem("apihub_saved_requests");
    setSavedRequests([]);
  }
  function askAI(text = aiInput) {
    const q = text.trim(); if (!q) return;
    setAiMessages(m => [...m, { role: "user", text: q }, { role: "assistant", text: response ? `For this ${method} request, your API returned ${response.status}. I can help you inspect the response, improve the request, or explain what each part means.` : "Start by sending a request. Then I can explain the status code, response, headers and possible next steps." }]);
    setAiInput("");
  }

  return <div className="appShell">
    <header className="topbar">
      <div className="brand" onClick={() => navigate("Home")}><div className="logoMark"><span>API</span></div><div><strong>APIHub</strong><small>Build · Test · Understand APIs</small></div></div>
      <nav className="desktopNav">{NAV.map(item => <button key={item} className={page === item ? "navItem active" : "navItem"} onClick={() => navigate(item)}>{item}</button>)}</nav>
      <div className="topActions"><button className="aiTop" onClick={() => setAiOpen(true)}><Icon name="ai"/> AI Assistant</button>{currentUser ? <><button className="signin" onClick={() => navigate("Dashboard")}>Dashboard</button><button className="signin" onClick={signOut}>Sign out</button></> : <button className="signin" onClick={() => navigate("Sign In")}>Sign in</button>}<button className="mobileMenu" onClick={() => setMobileOpen(v => !v)}><Icon name="menu"/></button></div>
    </header>
    {mobileOpen && <div className="mobileNav">{NAV.map(item => <button key={item} onClick={() => navigate(item)}>{item}</button>)}</div>}

    {(() => {
      switch (page) {
        case "Home": return <Home navigate={navigate} apiCatalog={apiCatalog}/>;
        case "Tester": return <Tester {...{method,setMethod,url,setUrl,headers,setHeaders,body,setBody,tab,setTab,response,error,loading,sendRequest,responseText,params,setParams,history,navigate,setAiOpen,saveRequest}}/>;
        case "APIs": return <Apis navigate={navigate} catalog={apiCatalog} myApis={userApis} currentUser={currentUser} onDeleteApi={handleDeleteApi} showToast={showToast} copyToClipboard={copyToClipboard} />;
        case "API Details": return <APIDetails navigate={navigate} apiId={selectedApiId} catalogId={selectedCatalogId} currentUser={currentUser} userApis={userApis} onDeleteApi={handleDeleteApi} showToast={showToast} copyToClipboard={copyToClipboard} />;
        case "Create API": return <CreateAPI navigate={navigate} currentUser={currentUser} onApiCreated={api => setUserApis(prev => [api, ...prev.filter(x => x.id !== api.id)])} />;
        case "Sign In": return <AccountPage navigate={navigate} mode="signin" onAuthenticated={setCurrentUser}/>;
        case "Sign Up": return <AccountPage navigate={navigate} mode="signup" onAuthenticated={setCurrentUser}/>;
        case "Dashboard": return <Dashboard navigate={navigate} user={currentUser} showToast={showToast} copyToClipboard={copyToClipboard} />;
        case "Create Endpoint": return <CreateEndpoint navigate={navigate} apiId={selectedApiId} currentUser={currentUser} userApis={userApis} onEndpointCreated={ep => setUserEndpoints(prev => [ep, ...prev.filter(x => x.id !== ep.id)])} />;
        case "Explore": return <Apis navigate={navigate} catalog={apiCatalog} myApis={userApis} currentUser={currentUser} onDeleteApi={handleDeleteApi} showToast={showToast} copyToClipboard={copyToClipboard} explore={true} />;
        case "Catalog Details": return <APIDetails navigate={navigate} apiId={selectedApiId} catalogId={selectedCatalogId} currentUser={currentUser} userApis={userApis} onDeleteApi={handleDeleteApi} showToast={showToast} copyToClipboard={copyToClipboard} />;
        case "Documentation": return <Documentation navigate={navigate}/>;
        case "Learn": return <Learn navigate={navigate}/>;
        case "History": return <History savedRequests={savedRequests} onOpenRequest={openSavedRequest} onDeleteRequest={deleteSavedRequest} onClearRequests={clearSavedRequests}/>;
        case "AI Assistant": return <AssistantPage navigate={navigate} askAI={askAI} aiMessages={aiMessages} aiInput={aiInput} setAiInput={setAiInput}/>;
        case "Privacy": return <Privacy navigate={navigate}/>;
        default: return <Placeholder title={page} navigate={navigate}/>;
      }
    })()}

    {aiOpen && <aside className="aiPanel">
      <div className="aiPanelHead"><div><span className="eyebrow">APIHUB INTELLIGENCE</span><h3><Icon name="ai"/> API Assistant</h3></div><button className="close" onClick={() => setAiOpen(false)}>×</button></div>
      <div className="aiStatus"><span className="onlineDot"/> Ready to help with your API workflow</div>
      <div className="aiChat">{aiMessages.map((m,i)=><div key={i} className={m.role === "user" ? "bubble user" : "bubble assistant"}>{m.text}</div>)}</div>
      <div className="aiSuggestions"><button onClick={() => askAI("Explain my current request")}>Explain request</button><button onClick={() => askAI("Explain the response")}>Explain response</button><button onClick={() => askAI("How do I add headers?")}>Headers help</button></div>
      <div className="aiInput"><input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()} placeholder="Ask anything about this API..."/><button onClick={() => askAI()}><Icon name="arrow"/></button></div>
    </aside>}

    {toast && <div className="toastNotification"><span>✓</span> {toast}</div>}

    <footer><div><button className="brand footerBrand footerBrandButton" onClick={() => navigate("Home")}><div className="logoMark"><span>API</span></div><strong>APIHub</strong></button><p>Discover, provide, document and test APIs in one developer workspace.</p></div><div className="footerLinks">{[["APIs","APIs"],["Tester","Tester"],["Documentation","Documentation"],["Learn","Learn"],["Privacy","Privacy"]].map(([label,target]) => <button key={label} onClick={() => navigate(target)}>{label}</button>)}</div><small>© 2026 APIHub</small></footer>
  </div>;
}

function Home({navigate, apiCatalog}) {
  return <main className="homePage">
    <section className="heroHome"><div className="heroCopy"><div className="eyebrow">THE API WORKSPACE FOR BUILDERS</div><h1>Build, explore & <span>test APIs</span> in one place.</h1><p>Discover APIs, test endpoints, create your own API documentation and use AI to understand what is happening behind every request.</p><div className="heroButtons"><button className="primaryBtn" onClick={() => navigate("Create API")}>Start Testing <Icon name="arrow"/></button><button className="secondaryBtn" onClick={() => navigate("Explore")}>Explore APIs</button></div><div className="trustLine"><span>● No setup required</span><span>● Developer focused</span><span>● Student friendly</span></div></div><div className="heroVisual"><div className="orb orbOne"/><div className="orb orbTwo"/><div className="miniTerminal"><div className="terminalTop"><span/> <span/> <span/><b>API Request</b></div><div className="requestLine"><em>GET</em><code>/api/users?limit=5</code><strong>200 OK</strong></div><div className="codeLine">{`{ "users": [ ... ] }`}</div><div className="terminalStats"><span>124 ms</span><span>1.8 KB</span><span>JSON</span></div></div></div></section>
    <section className="featureGrid"><Feature icon="api" title="API Provider" text="Create, manage and publish APIs with endpoints, responses, authentication and documentation."/><Feature icon="tester" title="API Testing" text="Build requests with params, headers and bodies, then inspect status, timing and response data."/><Feature icon="docs" title="Documentation" text="Turn every endpoint into clear developer documentation with examples and a Try API flow."/><Feature icon="explore" title="API Explorer" text="Discover useful APIs by category and open them directly in the testing workspace."/></section>
    <section className="workflowSection"><div><div className="eyebrow">HOW APIHUB CONNECTS THE WORKFLOW</div><h2>From API discovery to a working request.</h2><p>APIHub keeps the core developer workflow together. Explore an API, understand its docs, test it, then use the response in your project.</p></div><div className="workflow"><Step n="01" title="Discover" text="Find an API or create your own."/><Step n="02" title="Understand" text="Read endpoints, parameters and examples."/><Step n="03" title="Test" text="Send requests and inspect responses."/><Step n="04" title="Build" text="Take the API into your application."/></div></section>
    <section className="showcase"><div><div className="eyebrow">POWERFUL BY DESIGN</div><h2>Your API workbench, without the clutter.</h2><p>Keep requests, collections, history, documentation and AI guidance close to the work you are doing.</p><button className="textBtn" onClick={() => navigate("Tester")}>Open API Tester <Icon name="arrow"/></button></div><div className="darkCard"><div className="darkCardHeader"><span>REQUEST</span><span className="successBadge">200 OK</span></div><div className="darkUrl"><b>GET</b> https://api.example.com/users</div><div className="darkTabs"><span className="selected">Params</span><span>Headers</span><span>Body</span><span>Auth</span></div><div className="darkRows"><div><span>userId</span><b>1</b></div><div><span>limit</span><b>5</b></div></div></div></section>
    <section className="catalogPreview"><div className="sectionHead"><div><div className="eyebrow">EXPLORE</div><h2>Start with an API.</h2></div><button className="textBtn" onClick={() => navigate("Explore")}>View all <Icon name="arrow"/></button></div><div className="catalogGrid">{apiCatalog.map(api => <ApiCard key={api.name} api={api} navigate={navigate}/>)}</div></section>
  </main>;
}

function Feature({icon,title,text}) { return <article className="featureCard"><div className="featureIcon"><Icon name={icon}/></div><h3>{title}</h3><p>{text}</p><span className="featureArrow">→</span></article>; }
function Step({n,title,text}) { return <div className="step"><b>{n}</b><div><h3>{title}</h3><p>{text}</p></div></div>; }

function Tester(p) {
  return <main className="pageWrap testerPage"><div className="pageIntro"><div><div className="eyebrow">API TESTER</div><h1>Test an API from one focused workspace.</h1><p>Configure a request, send it through the APIHub backend, and inspect the response.</p></div><button className="aiAction" onClick={() => p.setAiOpen(true)}><Icon name="ai"/> Ask AI</button></div>
    <section className="testerShell"><div className="requestbar"><select value={p.method} onChange={e => p.setMethod(e.target.value)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select><input value={p.url} onChange={e => p.setUrl(e.target.value)} placeholder="https://api.example.com/endpoint"/><button className="sendBtn" onClick={p.sendRequest} disabled={p.loading}>{p.loading ? "Sending…" : "Send Request"} <Icon name="arrow"/></button></div>
      <div className="testerPanels"><div className="requestPanel"><div className="panelTop"><div className="tabs">{["Params","Headers","Body"].map(t => <button key={t} className={p.tab === t ? "tab active" : "tab"} onClick={() => p.setTab(t)}>{t}</button>)}</div><button className="tinyAction" onClick={p.saveRequest}>+ Save</button></div>
        {p.tab === "Params" && <div className="paramBox"><div className="paramHeader"><span>Query parameters</span><button onClick={() => p.setParams([...p.params,{key:"",value:"",enabled:true}])}>+ Add parameter</button></div>{p.params.map((row,i)=><div className="paramRow" key={i}><input type="checkbox" checked={row.enabled} onChange={e => p.setParams(p.params.map((x,j)=>j===i?{...x,enabled:e.target.checked}:x))}/><input value={row.key} onChange={e=>p.setParams(p.params.map((x,j)=>j===i?{...x,key:e.target.value}:x))} placeholder="Key"/><input value={row.value} onChange={e=>p.setParams(p.params.map((x,j)=>j===i?{...x,value:e.target.value}:x))} placeholder="Value"/><button onClick={()=>p.setParams(p.params.filter((_,j)=>j!==i))}>×</button></div>)}</div>}
        {p.tab === "Headers" && <div className="fieldBox"><label>Request headers</label><textarea value={p.headers} onChange={e => p.setHeaders(e.target.value)} placeholder={'Content-Type: application/json\nAuthorization: Bearer YOUR_TOKEN'}/><small>One header per line. Keep private credentials out of screenshots.</small></div>}
        {p.tab === "Body" && <div className="fieldBox"><label>Request body</label><textarea className="bodyArea" value={p.body} onChange={e => p.setBody(e.target.value)} placeholder={'{\n  "name": "APIHub"\n}'}/></div>}
        {p.error && <div className="errorBox">{p.error}</div>}
      </div><div className="responsePanel"><div className="responseHead"><div><div className="eyebrow">RESPONSE</div><h2>{p.response ? "API response" : "Waiting for request"}</h2></div>{p.response && <div className="responseMeta"><b>{p.response.status} {p.response.statusText}</b><span>{p.response.responseTimeMs} ms</span><span>{p.response.responseSizeBytes} B</span></div>}</div><pre>{p.responseText}</pre>{p.response && <details><summary>Response headers</summary><pre>{JSON.stringify(p.response.headers,null,2)}</pre></details>}</div></div></section>
    <div className="testerBottom"><div className="infoCard"><div className="featureIcon"><Icon name="history"/></div><div><b>Recent requests</b><p>Requests from this browser session are kept here for quick re-runs.</p></div><span className="count">{p.history.length}</span></div><div className="infoCard aiInfo"><div className="featureIcon"><Icon name="ai"/></div><div><b>Need help?</b><p>Open API Assistant to explain your request, response or error.</p></div><span>✦</span></div></div>
  </main>;
}
function Apis({ navigate, catalog = [], explore = false, myApis = [], currentUser, onDeleteApi, showToast, copyToClipboard }) {
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
                <ApiCard key={api.id || api.name} api={api} navigate={navigate} />
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

function ApiCard({ api, navigate }) {
  const isTestable = Boolean(api.testable);
  const endpointCount = api.endpoints?.length || 1;

  return (
    <article className="apiCard">
      <div className="apiCardTop">
        <div className="apiLogo">
          {api.name.charAt(0)}
        </div>
        <span className={isTestable ? "liveBadge" : "requiresBadge"}>
          {isTestable ? "Gateway Ready" : "Credentials needed"}
        </span>
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
function Documentation({ navigate }) {
  const sections = [
    ["Getting Started","Open Explore, choose a public API, then use Try API to load its selected endpoint into Tester.","GET https://jsonplaceholder.typicode.com/posts/1"],["API Basics","An API lets one application request data or actions from another. A base URL identifies a service; an endpoint identifies an operation.","Base URL: https://api.example.com\nEndpoint: /users"],["REST APIs","REST commonly uses resource URLs and HTTP methods to describe operations.","GET /users\nPOST /users"],["HTTP Methods","GET reads, POST creates, PUT replaces, PATCH changes part, and DELETE removes.","PATCH /users/42"],["Status Codes","2xx is success; 4xx usually means input or permission trouble; 5xx is server-side.","200 OK · 400 Bad Request · 404 Not Found"],["Headers","Headers carry metadata such as content type and authorization. Enter one Name: value pair per line.","Content-Type: application/json"],["Query Parameters","Query parameters refine a request after a question mark.","GET /search?q=api&page=1"],["Path Parameters","Replace documented placeholders with a resource value.","GET /users/{id} → /users/42"],["Request Body","POST, PUT, and PATCH often send a body. Use JSON when the API expects it.",'{ "name": "APIHub" }'],["JSON","JSON uses objects, lists, strings, numbers, booleans, and null.",'{ "id": 1, "active": true }'],["Authentication","APIs may use keys, bearer tokens, OAuth, or signatures. Do not enter real secrets in this build.","Authorization: Bearer YOUR_TOKEN"],["CRUD","Create, Read, Update, Delete often map to POST, GET, PUT/PATCH, DELETE.","POST /items · GET /items/1 · DELETE /items/1"],["API Testing","Configure method, URL, parameters, headers, and body; send, inspect, then save useful requests.","Check status, response shape, and errors."],["API Documentation","Good docs cover endpoint, method, parameters, auth, body, response, and errors.","Document both success and common failures."],["Common Errors","Check URL, method, required parameters, headers, response body, and API availability.","401 Unauthorized · 404 Not Found · timeout"],["How APIHub works","Phase 1 keeps your API definitions and saved requests locally in this browser; the backend proxies Tester requests.","Local storage is not shared across devices."]
  ]; const [active,setActive]=useState(0); const item=sections[active];
  return (
    <main className="docsPage"><aside className="docsSide"><button className="textBtn" onClick={()=>navigate("Home")}>← Back home</button><h3>Documentation</h3>{sections.map(([title],i)=><button key={title} className={active===i?"docActive":""} onClick={()=>setActive(i)}>{title}</button>)}</aside><section className="docsContent"><div className="eyebrow">APIHUB GUIDES</div><h1>{item[0]}</h1><p className="lead">{item[1]}</p><div className="docCode"><span>EXAMPLE</span><pre>{item[2]}</pre></div><div className="contentNav"><button className="secondaryBtn" disabled={!active} onClick={()=>setActive(active-1)}>← Previous</button><button className="secondaryBtn" disabled={active===sections.length-1} onClick={()=>setActive(active+1)}>Next →</button></div></section></main>
  );
}
function SignIn({ navigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSignIn(e) {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    alert("Sign in successful!");
    navigate("Home");
  }

  return (
    <main className="pageWrap">
      <div style={{ maxWidth: "450px", margin: "60px auto" }}>
        <div className="eyebrow">APIHUB ACCOUNT</div>
        <h1>Sign In</h1>
        <p>Sign in to continue to your APIHub workspace.</p>

        <form
          onSubmit={handleSignIn}
          style={{
            marginTop: "30px",
            padding: "25px",
            border: "1px solid #ddd",
            borderRadius: "12px"
          }}
        >
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{
              width: "100%",
              padding: "12px",
              margin: "8px 0 20px"
            }}
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={{
              width: "100%",
              padding: "12px",
              margin: "8px 0 20px"
            }}
          />

          <button type="submit" className="primaryBtn">
            Sign In
          </button>
        </form>
      </div>
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
function Learn({ navigate }) {
  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">APIHUB LEARN</div>
          <h1>Learn APIs</h1>
          <p>Build your API knowledge from the basics to practical testing.</p>
        </div>

        <button
          className="secondaryBtn"
          onClick={() => navigate("Home")}
        >
          ← Back to Home
        </button>
      </div>

      <section className="featureGrid">
        <Feature
          icon="◈"
          title="API Fundamentals"
          text="Learn what APIs are, how they work, and why applications use them."
        />

        <Feature
          icon="⌁"
          title="HTTP Methods"
          text="Understand GET, POST, PUT, PATCH and DELETE requests."
        />

        <Feature
          icon="▤"
          title="Status Codes"
          text="Learn common HTTP status codes such as 200, 201, 400, 401, 404 and 500."
        />

        <Feature
          icon="◎"
          title="API Testing"
          text="Practice sending requests and reading API responses with APIHub Tester."
        />
      </section>
    </main>
  );
}
function AssistantPage({ navigate, askAI, aiMessages, aiInput, setAiInput }) {
  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">APIHUB AI</div>
          <h1>AI Assistant</h1>
          <p>Get help understanding APIs, requests, responses and errors.</p>
        </div>

        <button
          className="secondaryBtn"
          onClick={() => navigate("Home")}
        >
          ← Back to Home
        </button>
      </div>

      <section className="providerTable">
        <div className="sectionHead">
          <div>
            <h2>API Assistant</h2>
            <p>Ask anything about your API request.</p>
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          {aiMessages.map((msg, index) => (
            <p key={index}>
              <b>{msg.role === "user" ? "You" : "AI"}:</b> {msg.text}
            </p>
          ))}

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") askAI();
              }}
              placeholder="Ask about APIs..."
              style={{ flex: 1, padding: "12px" }}
            />

            <button className="primaryBtn" onClick={() => askAI()}>
              Ask AI
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
function ApiKeyModal({ isOpen, onClose, currentUser, navigate, showToast }) {
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadKeys = () => {
    if (!currentUser) return;
    fetch(`${API_BASE_URL}/api/api-keys`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.success && Array.isArray(d.data)) setKeys(d.data); })
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen && currentUser) {
      loadKeys();
      setNewSecret("");
      setErrorMsg("");
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  async function handleCreateKey() {
    if (!name.trim()) {
      setErrorMsg("Please enter a name for your API key.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/api-keys`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
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
      await fetch(`${API_BASE_URL}/api/api-keys/${keyId}/revoke`, {
        method: "POST",
        credentials: "include"
      });
      loadKeys();
      if (showToast) showToast("API key revoked.");
    } catch {}
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard" onClick={e => e.stopPropagation()}>
        <button className="modalClose" onClick={onClose}>×</button>
        <div className="eyebrow">APIHUB GATEWAY AUTHENTICATION</div>
        <h2 style={{ fontFamily: "'Space Grotesk'", margin: "10px 0" }}>API Keys</h2>
        <p style={{ color: "var(--muted)", fontSize: "11px", lineHeight: "1.7", margin: "0 0 16px" }}>
          Use APIHub-issued keys to authenticate external requests to the APIHub Gateway using <code>X-API-Key: ah_live_...</code>.
        </p>

        {!currentUser ? (
          <div className="emptyState" style={{ padding: "20px" }}>
            <p>Sign in to generate and manage APIHub API keys.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "14px" }}>
              <button className="primaryBtn" onClick={() => { onClose(); navigate("Sign In"); }}>Sign In</button>
              <button className="secondaryBtn" onClick={() => { onClose(); navigate("Sign Up"); }}>Sign Up</button>
            </div>
          </div>
        ) : (
          <div>
            {newSecret ? (
              <div style={{ background: "rgba(78, 226, 197, 0.08)", border: "1px solid rgba(78, 226, 197, 0.4)", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                <b style={{ color: "#4ee2c5", display: "block", marginBottom: "8px" }}>✓ New API Key Generated:</b>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#050b14", padding: "10px", borderRadius: "8px", border: "1px solid #1c2e46" }}>
                  <code style={{ color: "#fff", flex: 1, wordBreak: "break-all", font: "11px monospace" }}>{newSecret}</code>
                  <button
                    className="primaryBtn"
                    style={{ padding: "7px 12px", fontSize: "10px" }}
                    onClick={() => {
                      if (navigator.clipboard) navigator.clipboard.writeText(newSecret);
                      if (showToast) showToast("API Key copied to clipboard!");
                    }}
                  >
                    Copy Key
                  </button>
                </div>
                <small style={{ display: "block", color: "#f1bd7c", marginTop: "8px" }}>
                  ⚠️ <b>Save this key now!</b> For your security, this raw secret will not be displayed again after closing.
                </small>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <input
                  style={{ flex: 1, background: "#060d18", border: "1px solid #22354e", color: "#fff", padding: "10px 14px", borderRadius: "8px", fontSize: "11px" }}
                  placeholder="Key name (e.g. My App Client)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreateKey()}
                />
                <button className="primaryBtn" onClick={handleCreateKey} disabled={loading}>
                  {loading ? "Generating…" : "Generate Key"}
                </button>
              </div>
            )}

            {errorMsg && <p className="errorBox" style={{ margin: "0 0 14px" }}>{errorMsg}</p>}

            <h4 style={{ margin: "16px 0 8px", fontSize: "12px", color: "#a9bed8" }}>Active Keys</h4>
            {keys.length === 0 ? (
              <p style={{ color: "#62748d", fontSize: "10px" }}>No API keys created yet.</p>
            ) : (
              <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                {keys.map(k => (
                  <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #142337", fontSize: "10px" }}>
                    <div>
                      <strong style={{ display: "block", color: "#eef4ff" }}>{k.name}</strong>
                      <span style={{ color: "#62748d", fontFamily: "monospace" }}>{k.prefix}•••• · {k.status}</span>
                    </div>
                    {k.status === "Active" ? (
                      <button
                        className="secondaryBtn"
                        style={{ padding: "4px 8px", fontSize: "8px", color: "var(--danger)", borderColor: "rgba(255, 130, 150, 0.3)" }}
                        onClick={() => handleRevoke(k.id)}
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="requiresBadge" style={{ fontSize: "8px" }}>Revoked</span>
                    )}
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
  copyToClipboard
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
      fetch(`${API_BASE_URL}/api/my-apis/${apiId}/endpoints`, { credentials: "include" })
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
        const res = await fetch(`${API_BASE_URL}/api/my-apis/${apiId}/endpoints/${endpointId}`, {
          method: "DELETE",
          credentials: "include"
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
  const gatewayBaseUrl = `${API_BASE_URL}/api/gateway/${gatewaySlug}`;
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

          <div style={{ background: "#070e19", border: "1px solid #1c2e46", borderRadius: "10px", padding: "18px", marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "14px" }}>Authentication</h3>
            <p style={{ color: "var(--muted)", fontSize: "11px", lineHeight: "1.7", margin: "0 0 12px" }}>
              Authenticate external requests to the APIHub Gateway by passing your APIHub API key in the <code>X-API-Key</code> request header.
            </p>
            <div className="docCode" style={{ margin: "0" }}>
              <span>REQUEST HEADER FORMAT</span>
              <pre>X-API-Key: YOUR_APIHUB_API_KEY</pre>
            </div>
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
                    onClick={() => copyToClipboard(fullEndpointUrlWithParams, "Endpoint URL copied!")}
                  >
                    Copy Endpoint
                  </button>
                </div>

                {selectedEp.parameters && (
                  <div className="docCode" style={{ margin: "14px 0" }}>
                    <span>QUERY PARAMETERS</span>
                    <pre>{selectedEp.parameters}</pre>
                  </div>
                )}

                {epBody && (
                  <div className="docCode" style={{ margin: "14px 0" }}>
                    <span>REQUEST BODY EXAMPLE</span>
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
                      onClick={() => copyToClipboard(currentSnippet, `${codeLang.toUpperCase()} code copied!`)}
                    >
                      Copy Code
                    </button>
                  </div>
                  <pre className="snippetBody">{currentSnippet}</pre>
                </div>

                {(selectedEp.responseExample || selectedEp.example) && (
                  <div className="docCode" style={{ margin: "14px 0" }}>
                    <span>EXPECTED RESPONSE EXAMPLE</span>
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
        const res = await fetch(`${API_BASE_URL}/api/my-apis`, {
          method: "POST",
          credentials: "include",
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
        const res = await fetch(`${API_BASE_URL}/api/my-apis/${parentApi.id}/endpoints`, {
          method: "POST",
          credentials: "include",
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
function AccountPage({ navigate, mode, onAuthenticated }) {
  const signup=mode==="signup"; const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(false);
  async function submit(e) { e.preventDefault(); if(!/^\S+@\S+\.\S+$/.test(email)) return setMessage("Enter a valid email address."); if(password.length<8) return setMessage("Password must contain at least 8 characters."); if(signup&&password!==confirm) return setMessage("Passwords do not match."); setLoading(true);setMessage(""); try { const r=await fetch(`${API_BASE_URL}/api/auth/${signup?"signup":"signin"}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const data=await r.json();if(!r.ok)throw new Error(data.message);onAuthenticated(data.user);navigate("Dashboard");}catch(error){setMessage(error.message||"Unable to authenticate.");}finally{setLoading(false);} }
  return <main className="pageWrap"><section className="accountCard"><div className="eyebrow">APIHUB ACCOUNT</div><h1>{signup?"Create account":"Sign in"}</h1><p>Your account and private workspace data are protected by a secure server session.</p><form onSubmit={submit}><div className="formGroup"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div><div className="formGroup"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></div>{signup&&<div className="formGroup"><label>Confirm password</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password"/></div>}{message&&<p className="errorBox">{message}</p>}<button className="primaryBtn" disabled={loading}>{loading?"Working…":signup?"Create account":"Sign in"}</button></form><div className="accountLinks"><button className="textBtn" onClick={()=>navigate(signup?"Sign In":"Sign Up")}>{signup?"Already have an account? Sign in":"Need an account? Sign up"}</button><button className="textBtn" onClick={()=>navigate("Home")}>Back home</button></div></section></main>;
}
function Dashboard({ navigate, user, copyToClipboard }) {
  const [keys,setKeys]=useState([]),[name,setName]=useState(""),[secret,setSecret]=useState(""),[message,setMessage]=useState("");
  const load=()=>fetch(`${API_BASE_URL}/api/api-keys`,{credentials:"include"}).then(r=>r.json()).then(d=>{if(d.success)setKeys(d.data);else setMessage(d.message);}).catch(()=>setMessage("Unable to load API keys."));
  useEffect(()=>{if(user)load();},[user]);
  async function create(){setMessage("");const r=await fetch(`${API_BASE_URL}/api/api-keys`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});const d=await r.json();if(!r.ok)return setMessage(d.message);setSecret(d.secret);setName("");load();}
  async function revoke(id){const r=await fetch(`${API_BASE_URL}/api/api-keys/${id}/revoke`,{method:"POST",credentials:"include"});if(!r.ok){const d=await r.json();setMessage(d.message);}load();}
  if(!user)return <main className="pageWrap"><div className="emptyState"><p>Sign in to manage APIHub API keys.</p><button className="primaryBtn" onClick={()=>navigate("Sign In")}>Sign in</button></div></main>;
  return <main className="pageWrap"><div className="pageIntro"><div><div className="eyebrow">ACCOUNT DASHBOARD</div><h1>Welcome, {user.email}</h1><p>Create APIHub API keys for the documented catalog endpoints and APIHub Gateway.</p></div></div><section className="providerTable"><h2>API keys</h2><p className="docNotice">Keep API keys private. The full secret is shown once, immediately after creation.</p><div className="toolbar"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Key name, e.g. Portfolio app"/><button className="primaryBtn" onClick={create}>Generate key</button></div>{secret&&<div className="successBox" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}><div><b>Copy your new API key now:</b><code style={{ display: "block", marginTop: "4px" }}>{secret}</code></div><button className="secondaryBtn" style={{ padding: "6px 14px", fontSize: "13px" }} onClick={() => copyToClipboard ? copyToClipboard(secret, "API Key copied!") : navigator.clipboard?.writeText(secret)}>Copy Key</button></div>}{message&&<div className="errorBox">{message}</div>}{keys.length?keys.map(key=><div className="apiTableRow" key={key.id}><div className="apiDot">KEY</div><div><b>{key.name}</b><small>{key.prefix}•••• · {key.status} · created {new Date(key.createdAt).toLocaleDateString()}</small></div>{key.status==="Active"?<button className="secondaryBtn" onClick={()=>revoke(key.id)}>Revoke</button>:<span className="requiresBadge">Revoked</span>}</div>):<p>No API keys yet.</p>}</section><section className="providerTable"><h2>Using the APIHub API & Gateway</h2><div className="docCode"><span>AUTHENTICATED GATEWAY REQUEST</span><pre>{`curl -X GET "${API_BASE_URL}/api/gateway/open-meteo/forecast?latitude=40.71&longitude=-74.00" \\\n  -H "X-API-Key: YOUR_APIHUB_KEY"`}</pre></div><p>Default limit: 60 requests/minute per API key. The server may use a different configured limit. Authenticate with header <code>X-API-Key</code> or <code>Authorization: Bearer</code>.</p></section></main>;
}
function Privacy({ navigate }) { return <main className="pageWrap"><div className="pageIntro"><div><div className="eyebrow">APIHUB</div><h1>Privacy</h1><p>Phase 1 stores API definitions and saved requests in this browser's local storage. Tester requests pass through the configured APIHub backend proxy. Do not enter private credentials or sensitive data in this development build.</p></div><button className="secondaryBtn" onClick={()=>navigate("Home")}>← Back home</button></div></main>; }
