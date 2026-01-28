// This is a Vercel serverless function to proxy API requests to your EC2 backend

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const backendUrl = "http://15.134.231.44:8000" + req.url;
  const fetchHeaders = { ...req.headers };
  // Remove host header to avoid conflicts
  delete fetchHeaders.host;

  // Pipe the request stream directly to the backend
  const response = await fetch(backendUrl, {
    method: req.method,
    headers: fetchHeaders,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
  });

  // Forward status and headers
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  // Pipe the response body
  response.body.pipe(res);
}
