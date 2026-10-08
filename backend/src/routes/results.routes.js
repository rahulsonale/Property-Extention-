import { Router } from "express";

const router = Router();
let results = [];
let progress = null;

router.get("/progress", (_request, response) => {
  response.json({ progress });
});

router.post("/progress", (request, response) => {
  const nextProgress = request.body;
  const validStatuses = new Set(["waiting", "capturing", "complete", "error"]);

  if (
    !nextProgress ||
    !["housing", "magicbricks", "nobroker"].includes(nextProgress.siteId) ||
    !validStatuses.has(nextProgress.status)
  ) {
    return response
      .status(400)
      .json({ error: "A valid listing capture status is required." });
  }

  progress = {
    siteId: nextProgress.siteId,
    status: nextProgress.status,
    current: Number.isFinite(nextProgress.current) ? nextProgress.current : 0,
    total: Number.isFinite(nextProgress.total) ? nextProgress.total : 0,
    message:
      typeof nextProgress.message === "string"
        ? nextProgress.message
        : undefined,
    updatedAt: Date.now(),
  };

  return response.json({ ok: true, progress });
});

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
  progress = null;
  response.json({ ok: true });
});

export default router;
