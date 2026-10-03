import searchRoutes from "./src/routes/search.routes.js";
import cors from "cors";
import express from "express";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use("/api/search", searchRoutes);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "property-search-api" });
});

app.listen(port, () => {
  console.log(`Property search API listening on http://localhost:${port}`);
});
