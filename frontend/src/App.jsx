import { useMemo, useState } from "react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const NAV = ["Home", "APIs", "Tester", "Documentation", "Explore", "AI Assistant", "Learn"];

const apiCatalog = [
  { name: "JSONPlaceholder", desc: "Free fake REST API for testing and prototyping.", tags: ["REST", "Testing"], status: "Public" },
  { name: "REST Countries", desc: "Get country, region, capital and flag data.", tags: ["Public", "JSON"], status: "Public" },
  { name: "Open-Meteo", desc: "Weather data without an API key for quick experiments.", tags: ["Weather", "REST"], status: "Public" },
];

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

export default function App() {
  const [page, setPage] = useState("Home");
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
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", text: "Hi! I’m your API Assistant. I can explain requests, responses, errors, headers and help you build an API call." }
  ]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const responseText = useMemo(() => {
    if (!response) return "// Send a request to inspect the response here.";
    return typeof response.body === "string" ? response.body : JSON.stringify(response.body, null, 2);
  }, [response]);

  function navigate(next) {
    setPage(next);
    setMobileOpen(false);
    if (next === "AI Assistant") setAiOpen(true);
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
      const r = await fetch("https://apihub-1cw1.onrender.com/api/requests/execute", {
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
  const saved = JSON.parse(localStorage.getItem("apihub_saved_requests") || "[]");

  saved.unshift({
    id: crypto.randomUUID(),
    method,
    url,
    headers,
    body,
    params
  });

  localStorage.setItem("apihub_saved_requests", JSON.stringify(saved));
  alert("Request saved successfully!");
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
      <div className="topActions"><button className="aiTop" onClick={() => setAiOpen(true)}><Icon name="ai"/> AI Assistant</button><button className="signin" onClick={() => navigate("Sign In")}>
  Sign in
</button><button className="mobileMenu" onClick={() => setMobileOpen(v => !v)}><Icon name="menu"/></button></div>
    </header>
    {mobileOpen && <div className="mobileNav">{NAV.map(item => <button key={item} onClick={() => navigate(item)}>{item}</button>)}</div>}

    {page === "Home" && <Home navigate={navigate} apiCatalog={apiCatalog}/>} 
    {page === "Tester" && <Tester {...{method,setMethod,url,setUrl,headers,setHeaders,body,setBody,tab,setTab,response,error,loading,sendRequest,responseText,params,setParams,history,navigate,setAiOpen,saveRequest}}/>}
    {page === "APIs" && <Apis navigate={navigate} catalog={apiCatalog}/>} 
    {page.startsWith("API Details:") && <APIDetails navigate={navigate} />}
    {page === "Create API" && <CreateAPI navigate={navigate}/>}
    {page === "Sign In" && <SignIn navigate={navigate}/>}
    {page === "Create Endpoint" && <CreateEndpoint navigate={navigate}/>}
    {page === "Explore" && <Apis navigate={navigate} catalog={apiCatalog} explore/>}
    {page === "Documentation" && <Documentation navigate={navigate}/>} 
    {page === "Learn" && <Learn navigate={navigate}/>} 
    {page === "AI Assistant" && <AssistantPage navigate={navigate} askAI={askAI} aiMessages={aiMessages} aiInput={aiInput} setAiInput={setAiInput}/>} 
    {page !== "Home" && page !== "Tester" && page !== "APIs" && page !== "Explore" && page !== "Documentation" && page !== "Learn" && page !== "AI Assistant" && <Placeholder title={page} navigate={navigate}/>} 

    {aiOpen && <aside className="aiPanel">
      <div className="aiPanelHead"><div><span className="eyebrow">APIHUB INTELLIGENCE</span><h3><Icon name="ai"/> API Assistant</h3></div><button className="close" onClick={() => setAiOpen(false)}>×</button></div>
      <div className="aiStatus"><span className="onlineDot"/> Ready to help with your API workflow</div>
      <div className="aiChat">{aiMessages.map((m,i)=><div key={i} className={m.role === "user" ? "bubble user" : "bubble assistant"}>{m.text}</div>)}</div>
      <div className="aiSuggestions"><button onClick={() => askAI("Explain my current request")}>Explain request</button><button onClick={() => askAI("Explain the response")}>Explain response</button><button onClick={() => askAI("How do I add headers?")}>Headers help</button></div>
      <div className="aiInput"><input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()} placeholder="Ask anything about this API..."/><button onClick={() => askAI()}><Icon name="arrow"/></button></div>
    </aside>}

    <footer><div><div className="brand footerBrand"><div className="logoMark"><span>API</span></div><strong>APIHub</strong></div><p>Discover, provide, document and test APIs in one developer workspace.</p></div><div className="footerLinks"><span>APIs</span><span>Tester</span><span>Documentation</span><span>Learn</span><span>Privacy</span></div><small>© 2026 APIHub</small></footer>
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
function Apis({ navigate, catalog, explore = false }) {
  const [myApis] = useState(() =>
    JSON.parse(localStorage.getItem("apihub_apis") || "[]")
  );

  return (
    <main className="pageWrap">

      <div className="pageIntro">
        <div>
          <div className="eyebrow">
            {explore ? "API EXPLORER" : "API PROVIDER"}
          </div>

          <h1>
            {explore
              ? "Discover APIs built for real workflows."
              : "Manage the APIs you provide."}
          </h1>

          <p>
            {explore
              ? "Browse public APIs, inspect their documentation and open an endpoint directly in API Tester."
              : "Create and organize your APIs, endpoints, responses and documentation from one workspace."}
          </p>
        </div>

        <button
          className="primaryBtn"
          onClick={() =>
            navigate(explore ? "Tester" : "Create API")
          }
        >
          <Icon name="plus" />
          {explore ? "Try an API" : "Create API"}
        </button>
      </div>

      <div className="toolbar">
        <input placeholder="Search APIs..." />

        <div>
          <button>All</button>
          <button>REST</button>
          <button>Testing</button>
          <button>Education</button>
        </div>
      </div>

      <div className="catalogGrid">
        {catalog.map(api => (
          <ApiCard
            key={api.name}
            api={api}
            navigate={navigate}
          />
        ))}
      </div>

      {!explore && (
        <section className="providerTable">

          <div className="sectionHead">
            <div>
              <div className="eyebrow">MY APIS</div>
              <h2>API workspace</h2>
            </div>

            <span className="tableBadge">
              {myApis.length} APIs
            </span>
          </div>

          {myApis.length === 0 ? (
            <p>No APIs created yet.</p>
          ) : (
            myApis.map((api, i) => (
              <div className="apiTableRow" key={api.id}>

                <div className="apiDot">
                  {i + 1}
                </div>

                <div>
                  <b>{api.name}</b>
                  <small>{api.baseUrl}</small>
                </div>

                <span className="liveBadge">
                  {api.type}
                </span>

                <button
                  className="rowArrow"
                  onClick={() =>
                    navigate(`API Details:${api.id}`)
                  }
                >
                  →
                </button>

              </div>
            ))
          )}

        </section>
      )}

    </main>
  );
}
function ApiCard({ api, navigate }) {
  return (
    <article className="apiCard">
      <div className="apiCardTop">
        <div className="apiLogo">
          {api.name.charAt(0)}
        </div>

        <span className="liveBadge">
          {api.status || "Public"}
        </span>
      </div>

      <h3>{api.name}</h3>

      <p>{api.desc}</p>

      <div className="apiTags">
        {api.tags?.map(tag => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <button
        className="textBtn"
        onClick={() => {
          if (api.name === "JSONPlaceholder") {
            navigate("Tester");
          } else {
            navigate("Tester");
          }
        }}
      >
        Try API <Icon name="arrow" />
      </button>
    </article>
  );
}
function Documentation({ navigate }) {
  return (
    <main className="pageWrap">
      <div className="pageIntro">
        <div>
          <div className="eyebrow">APIHUB</div>
          <h1>Documentation</h1>
          <p>Learn how to build, test and understand APIs with APIHub.</p>
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
          title="API Basics"
          text="Understand APIs, endpoints, HTTP methods and status codes."
        />

        <Feature
          icon="⌁"
          title="Request & Response"
          text="Learn how headers, parameters, request bodies and responses work."
        />

        <Feature
          icon="▤"
          title="API Testing"
          text="Send requests and inspect API responses using the Tester."
        />
      </section>
    </main>
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
function APIDetails({ navigate }) {
  const apiId = window.location.hash
    ? window.location.hash.split(":")[1]
    : null;

  const apis = JSON.parse(
    localStorage.getItem("apihub_apis") || "[]"
  );

  const api = apis.find(item => item.id === apiId) || apis[0];

  const allEndpoints = JSON.parse(
    localStorage.getItem("apihub_endpoints") || "[]"
  );

  const endpoints = allEndpoints.filter(
    endpoint => !endpoint.apiId || endpoint.apiId === api?.id
  );

  if (!api) {
    return (
      <main className="pageWrap">
        <h1>API not found</h1>

        <button
          className="secondaryBtn"
          onClick={() => navigate("APIs")}
        >
          ← Back to APIs
        </button>
      </main>
    );
  }

  return (
    <main className="pageWrap">

      <div className="pageIntro">
        <div>
          <div className="eyebrow">API DETAILS</div>
          <h1>{api.name}</h1>
          <p>{api.description || "No description provided."}</p>
        </div>

        <button
          className="secondaryBtn"
          onClick={() => navigate("APIs")}
        >
          ← Back to APIs
        </button>
      </div>

      <section className="providerTable">

        <div className="sectionHead">
          <div>
            <div className="eyebrow">API INFORMATION</div>
            <h2>{api.name}</h2>
          </div>

          <span className="liveBadge">
            {api.type}
          </span>
        </div>

        <div className="apiTableRow">
          <div>
            <b>Base URL</b>
            <small>{api.baseUrl}</small>
          </div>
        </div>

        <div className="apiTableRow">
          <div>
            <b>Description</b>
            <small>
              {api.description || "No description provided."}
            </small>
          </div>
        </div>

        <div className="apiTableRow">
          <div>
            <b>Created</b>
            <small>
              {new Date(api.createdAt).toLocaleString()}
            </small>
          </div>
        </div>

      </section>

      <section className="providerTable">

        <div className="sectionHead">
          <div>
            <div className="eyebrow">ENDPOINTS</div>
            <h2>API endpoints</h2>
          </div>

          <button
            className="primaryBtn"
            onClick={() => navigate("Create Endpoint")}
          >
            + Add Endpoint
          </button>
        </div>

        {endpoints.length === 0 ? (
          <p>
            No endpoints added yet. Create your first endpoint to start
            building this API.
          </p>
        ) : (
          endpoints.map(endpoint => (
            <div
              className="apiTableRow"
              key={endpoint.id}
            >
              <div className="apiDot">
                {endpoint.method}
              </div>

              <div>
                <b>{endpoint.name}</b>
                <small>{endpoint.path}</small>
              </div>

              <span className="liveBadge">
                {endpoint.method}
              </span>

              <button
                className="rowArrow"
                onClick={() => navigate("Tester")}
              >
                →
              </button>
            </div>
          ))
        )}

      </section>

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
function CreateEndpoint({ navigate }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parameters, setParameters] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [responseExample, setResponseExample] = useState("");

  function saveEndpoint() {
    if (!path.trim() || !name.trim()) {
      alert("Endpoint Name and Path are required.");
      return;
    }

    const endpoints = JSON.parse(
      localStorage.getItem("apihub_endpoints") || "[]"
    );

    const endpoint = {
      id: crypto.randomUUID(),
      method,
      path: path.trim(),
      name: name.trim(),
      description: description.trim(),
      parameters: parameters.trim(),
      requestBody: requestBody.trim(),
      responseExample: responseExample.trim(),
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(
      "apihub_endpoints",
      JSON.stringify([endpoint, ...endpoints])
    );

    alert("Endpoint created successfully!");
    navigate("APIs");
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
          onClick={() => navigate("APIs")}
        >
          ← Back
        </button>
      </div>

      <section className="createApiCard">

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
        >
          Create Endpoint
        </button>

      </section>
    </main>
  );
}