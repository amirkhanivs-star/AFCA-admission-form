import express from "express";
import path from "path";
import morgan from "morgan";
import { fileURLToPath } from "url";

/*
  AFCA / IVS Admission Form server

  Frontend-only mode:
  - Serves index.html, script.js, styles.css, img/, and other static assets.
  - Does NOT save admission-form data to any API or database.
  - Does NOT expose /api/forms routes.
  - PDF generation remains in the browser via script.js.
*/

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.disable("x-powered-by");

app.use(morgan("dev"));

// Serve frontend files from project root:
// index.html
// script.js
// styles.css
// img/
// etc.
app.use(express.static(__dirname));

// Also support assets inside /public if present.
app.use(express.static(path.join(__dirname, "public")));

// Main admission form
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/*
  IMPORTANT:

  No API routes are defined here.

  There is intentionally NO:

  POST /api/forms
  GET  /api/forms
  GET  /api/forms/check

  There is also no dashboard API/database communication.

  Admission data remains in the user's browser and is only
  used for displaying the form and creating the PDF.
*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
  console.log(
    "Frontend-only mode enabled. Admission data is NOT saved to any database."
  );
});