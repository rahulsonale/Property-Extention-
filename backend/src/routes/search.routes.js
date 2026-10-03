router.post("/", (request, response) => {
  const { query } = request.body;

  if (typeof query !== "string" || !query.trim()) {
    return response.status(400).json({
      error: "A property search query is required.",
    });
  }

  return response.json({
    query: query.trim(),
    results: [
      {
        website: "Example Property Site",
        url: "https://example.com",
        status: "found",
        data: {
          propertyName: query.trim(),
          address: null,
          price: null,
        },
      },
    ],
  });
});
