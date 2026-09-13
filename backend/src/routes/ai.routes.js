import { Router } from "express";

const router = Router();

const QUIZZES = [
  {
    question: "Which HTTP status code signifies that your API key is invalid or missing?",
    options: ["200 OK", "401 Unauthorized", "403 Forbidden", "500 Internal Error"],
    answer: "401 Unauthorized",
    explanation: "401 Unauthorized means authentication is missing or invalid (e.g. invalid X-API-Key). 403 Forbidden means you are authenticated, but not permitted to access this resource (e.g. an API key scoped to Weather trying to access Crypto)."
  },
  {
    question: "In REST APIs, which HTTP method is typically used to create a new resource?",
    options: ["GET", "POST", "PATCH", "DELETE"],
    answer: "POST",
    explanation: "POST is standard for creating new resources on a server, usually with a JSON payload in the request body."
  },
  {
    question: "Where should your secret APIHub API key be stored in your project code?",
    options: [
      "Hardcoded directly in your public client JavaScript",
      "In a secure .env environment file on the backend",
      "In a public GitHub repository README",
      "In a URL query string visible in browser history"
    ],
    answer: "In a secure .env environment file on the backend",
    explanation: "Never expose raw API keys in public frontend code or git repositories. Keep them in .env and access them via process.env or server-side environment variables."
  },
  {
    question: "What does CORS (Cross-Origin Resource Sharing) protect?",
    options: [
      "It prevents unauthorized cross-origin requests made by browsers to protect user sessions and data",
      "It speeds up network bandwidth",
      "It encrypts your hard drive",
      "It automatically generates database tables"
    ],
    answer: "It prevents unauthorized cross-origin requests made by browsers to protect user sessions and data",
    explanation: "CORS is a browser security mechanism that restricts web pages from making requests to a different domain than the one that served the web page, unless the server explicitly allows it."
  }
];

function generateExpertPedagogicalResponse(prompt = "", context = {}, lastResponse = null) {
  const q = prompt.toLowerCase();

  // Quiz request
  if (q.includes("quiz") || q.includes("test me") || q.includes("practice exercise")) {
    const quiz = QUIZZES[Math.floor(Math.random() * QUIZZES.length)];
    return (
      `🧠 **API Knowledge Quiz**:\n\n` +
      `**Question**: ${quiz.question}\n\n` +
      quiz.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join("\n") +
      `\n\n*(Answer: **${quiz.answer}** — ${quiz.explanation})*`
    );
  }

  // Explain current execution or response
  if ((q.includes("explain") && q.includes("response")) || q.includes("status code") || q.includes("error") || q.includes("last request")) {
    if (lastResponse) {
      const code = lastResponse.status;
      let meaning = "";
      if (code >= 200 && code < 300) meaning = "Success: The server accepted and processed your request.";
      else if (code === 401) meaning = "Unauthorized: Missing, expired, or invalid API key.";
      else if (code === 403) meaning = "Forbidden: Key scope mismatch or permission denied. In APIHub, scoped keys can only access their designated API.";
      else if (code === 404) meaning = "Not Found: The URL path or resource does not exist on the target server.";
      else if (code === 429) meaning = "Rate Limit Exceeded: You sent too many requests in a short window. Wait 60 seconds.";
      else if (code >= 500) meaning = "Upstream Server Error: The upstream provider is currently having issues.";

      return (
        `📊 **Analysis of your actual request response**:\n\n` +
        `- **HTTP Status**: \`${lastResponse.status} ${lastResponse.statusText || ""}\`\n` +
        `- **Response Time**: \`${lastResponse.responseTimeMs || 0} ms\`\n` +
        `- **Diagnosis**: ${meaning}\n\n` +
        `💡 **Tip**: Check the Response Headers and Response Body tabs in the API Tester to inspect the returned payload.`
      );
    } else {
      return (
        `ℹ️ *Note: No API request has been executed in the current session yet.* Please run a request in the API Tester first, or ask me about any general API concept, status code (e.g. 401, 403, 404), or code example!`
      );
    }
  }

  // Code explanation (fetch, curl, python)
  if (q.includes("fetch") || q.includes("python") || q.includes("curl") || q.includes("code") || q.includes("how do i call")) {
    return (
      `💻 **How to Call the APIHub Gateway Step-by-Step**:\n\n` +
      `1. **cURL (Terminal)**:\n` +
      `\`\`\`bash\n` +
      `curl -X GET "${context.url || "https://your-domain.com/api/gateway/open-meteo/forecast"}" \\\n` +
      `  -H "X-API-Key: YOUR_APIHUB_API_KEY"\n` +
      `\`\`\`\n\n` +
      `2. **JavaScript (Fetch)**:\n` +
      `\`\`\`javascript\n` +
      `const res = await fetch("${context.url || "https://your-domain.com/api/gateway/open-meteo/forecast"}", {\n` +
      `  method: "GET",\n` +
      `  headers: {\n` +
      `    "X-API-Key": process.env.APIHUB_API_KEY\n` +
      `  }\n` +
      `});\n` +
      `const data = await res.json();\n` +
      `console.log(data);\n` +
      `\`\`\`\n\n` +
      `3. **Python (requests)**:\n` +
      `\`\`\`python\n` +
      `import requests, os\n\n` +
      `url = "${context.url || "https://your-domain.com/api/gateway/open-meteo/forecast"}"\n` +
      `headers = {"X-API-Key": os.getenv("APIHUB_API_KEY")}\n` +
      `res = requests.get(url, headers=headers)\n` +
      `print(res.status_code, res.json())\n` +
      `\`\`\`\n\n` +
      `🔒 *Security Notice: Always store your raw API key in a \`.env\` file and never commit it to git.*`
    );
  }

  // What is an API / REST
  if (q.includes("what is an api") || q.includes("what is rest") || q.includes("beginner") || q.includes("learn")) {
    return (
      `🎓 **API Fundamentals for Beginners**:\n\n` +
      `An **API (Application Programming Interface)** is a bridge that allows two software programs to communicate.\n\n` +
      `- **Client**: Your app (website, mobile app, or Python script) that asks for data.\n` +
      `- **Server**: The remote computer that processes the request and sends data back.\n` +
      `- **Endpoint**: The specific URL representing a resource (e.g. \`/api/gateway/open-meteo/forecast\`).\n` +
      `- **Method**: The action you want to perform (\`GET\` to read, \`POST\` to create, \`PUT\`/\`PATCH\` to update, \`DELETE\` to remove).\n` +
      `- **Headers**: Metadata sent with the request (e.g., \`X-API-Key\` for authentication, \`Content-Type: application/json\`).\n` +
      `- **Response**: The server answers with an **HTTP Status Code** (e.g., \`200 OK\`) and usually a **JSON body**.`
    );
  }

  // CORS & Security
  if (q.includes("cors")) {
    return (
      `🛡️ **What is CORS (Cross-Origin Resource Sharing)?**:\n\n` +
      `CORS is a browser security mechanism that restricts scripts running in a browser from making HTTP requests to a different domain (origin) than the one that served the web application.\n\n` +
      `- **Why it exists**: Prevents malicious websites from reading sensitive session cookies or data from another site.\n` +
      `- **How API Gateways solve it**: Server-to-server calls do NOT have browser CORS restrictions. The APIHub Gateway acts as a reverse proxy, making requests upstream on your behalf and attaching proper CORS headers to client responses.`
    );
  }

  // API Keys and Security
  if (q.includes("key") || q.includes("auth") || q.includes("token") || q.includes("security")) {
    return (
      `🔑 **Understanding API Keys & Security**:\n\n` +
      `- **What is an API Key?**: A unique secret token identifying your application to the API server.\n` +
      `- **APIHub Multi-Key System**: APIHub allows you to create **Scoped Keys** (limited strictly to one API, like Weather or Crypto) or **Global Keys** (full access across all 18 categories).\n` +
      `- **How APIHub Secures Keys**: APIHub computes a cryptographic **SHA-256 hash** of your key and stores only the hash. Even if the database were compromised, raw keys cannot be reversed.\n` +
      `- **Scope Enforcement**: If you use a key scoped to *Open-Meteo* to call *Binance*, the APIHub Gateway blocks the request with \`403 Forbidden: API_KEY_SCOPE_MISMATCH\`.\n` +
      `- **Revocation**: You can revoke any key instantly in the Dashboard. The Gateway immediately returns \`401 Unauthorized\` on subsequent calls.`
    );
  }

  // Default helpful response
  return (
    `🤖 **APIHub AI Learning Assistant**:\n\n` +
    `I can help you master APIs! Here are great things you can ask me:\n` +
    `1. *"Explain what an API endpoint is"*\n` +
    `2. *"Show me a JavaScript fetch example with headers"*\n` +
    `3. *"What does a 403 API_KEY_SCOPE_MISMATCH mean?"*\n` +
    `4. *"Quiz me on HTTP status codes"*\n` +
    `5. *"How does the APIHub Gateway work?"*\n` +
    `6. *"Explain my current request or response"*\n\n` +
    `*Note: I will only report that an API was executed if you actually clicked 'Send Request' in the API Tester!*`
  );
}

// POST /api/ai/ask - Educational and interactive API learning assistant
router.post("/ask", async (req, res) => {
  try {
    const { prompt = "", context = {}, lastResponse = null } = req.body || {};

    // Check if external provider key is configured (OpenAI or Gemini)
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text:
                        "You are the APIHub AI Learning Assistant. Your mission is to teach developers about APIs, HTTP, REST, endpoints, status codes, authentication, and APIHub Gateway. " +
                        "Explain concepts simply for beginners with practical analogies. Provide code examples in cURL, JavaScript fetch, and Python requests. " +
                        "CRITICAL RULE: Never claim an API request was executed unless the provided context explicitly shows an execution result. " +
                        `User prompt: ${prompt}\n` +
                        `Context: ${JSON.stringify(context || {})}\n` +
                        `Last response: ${JSON.stringify(lastResponse || null)}`
                    }
                  ]
                }
              ]
            }),
            signal: AbortSignal.timeout(8000)
          }
        );
        const data = await geminiRes.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          return res.json({ success: true, text: aiText, source: "gemini" });
        }
      } catch {
        // Fallback to internal engine if external timeout
      }
    }

    // Default pedagogical response engine
    const answer = generateExpertPedagogicalResponse(prompt, context, lastResponse);
    res.json({ success: true, text: answer, source: "apihub_core" });
  } catch (err) {
    res.status(500).json({ success: false, message: "AI assistant error: " + err.message });
  }
});

export default router;
