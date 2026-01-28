export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const backendBase = "http://15.134.231.44:8000";

  const path = req.query.path || [];
  const backendUrl = `${backendBase}/${path.join("/")}`;

  const headers = { ...req.headers };
  delete headers.host;

  const response = await fetch(backendUrl, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
  });

  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  response.body.pipe(res);
}