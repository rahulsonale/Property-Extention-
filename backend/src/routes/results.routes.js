import { Router } from "express";


const router = Router();
let results = [];

router.get("/", (_request, response) => {
  response.json({ results });
});

router.post("/", (request, response) => {
  const data = request.body;

  if (
    !data ||
    typeof data.website !== "string" ||
    typeof data.url !== "string"
  ) {
    return response.status(400).json({
      error: "A website and result URL are required.",
    });
  }

  results = results.filter(
    (item) => !(item.website === data.website && item.url === data.url),
  );

  results.unshift({ ...data, receivedAt: Date.now() });
  results = results.slice(0, 50);

  return response.status(201).json({ ok: true });
});

router.delete("/", (_request, response) => {
  results = [];
  response.json({ ok: true });
});

export default router;
