export default function handler(req, res) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", requestId);
  res.status(200).json({ ok: true, service: "page-pulse", requestId });
}
