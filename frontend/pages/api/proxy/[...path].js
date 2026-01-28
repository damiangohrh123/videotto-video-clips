export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  const path = req.query.path.join("/");
  const backendUrl = `http://15.134.231.44:8000/${path}`;

  console.log("Proxying:", req.method, backendUrl);

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