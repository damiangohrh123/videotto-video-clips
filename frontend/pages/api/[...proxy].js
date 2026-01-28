export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const backendBase = "http://15.134.231.44:8000";
  const path = req.query.proxy ? "/" + req.query.proxy.join("/") : "";
  const backendUrl = backendBase + path;

  console.log("[Proxy] Incoming request:", req.method, req.url);
  console.log("[Proxy] Backend URL:", backendUrl);

  const headers = { ...req.headers };
  delete headers.host;

  try {
    const response = await fetch(backendUrl, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
    });

    console.log("[Proxy] Backend response status:", response.status);

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    response.body.pipe(res);
  } catch (error) {
    console.error("[Proxy] Error forwarding request:", error);
    res.status(500).json({ error: "Proxy error", details: error.message });
  }
}
