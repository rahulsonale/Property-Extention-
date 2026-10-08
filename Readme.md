# Property Search

A full-stack property search application with an Angular frontend and a Node.js/Express backend.

## Project layout

- `frontend/` — Angular user interface (search form, source results, readable JSON viewer).
- `backend/` — Express API and property-source integrations.
- `backend/src/routes/` — HTTP API routes.
- `backend/src/services/` — Search orchestration and shared business logic.
- `backend/src/sources/` — Website-specific property search adapters.

## Search flow

Angular submits a property query to the Express API. The backend queries configured source adapters and returns a per-source result, including source name, source URL, status, and structured property data. Angular displays the sources and lets the user inspect or copy each result as formatted JSON.


