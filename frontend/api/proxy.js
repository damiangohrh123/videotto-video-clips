// This is a Vercel serverless function to proxy API requests to your EC2 backend
export default async function handler(req, res) {
  const backendUrl = "http://15.134.231.44:8000" + req.url;
  const response = await fetch(backendUrl, {
    method: req.method,
    headers: req.headers,
    body: req.method !== "GET" ? req.body : undefined,
  });
  const data = await response.text();
  res.status(response.status).send(data);
}
