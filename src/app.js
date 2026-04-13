import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { auth, requireAuth } from "../config/auth.js";
import userRoutes from "../routes/user.route.js";
import docRoutes from "../routes/saved_documents.route.js";
import "dotenv/config";
import { analyzeDoc } from "../controllers/Analyze.controller.js";
import { uploadDocument } from "../config/cloudinary.config.js";
import { fetchHistory } from "../controllers/History.controller.js";

const app = express();

app.use(cors({
  origin: [process.env.CLIENT_URL, "http://localhost:5173"],
  credentials: true,
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));

// Better Auth FIRST — before anything else touches /api/auth
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use("/api/user", userRoutes);
app.post("/api/analyze", (req, res, next) => {
  uploadDocument.single("file")(req, res, (err) => {  // ← also change "resume" to "file" to match frontend
    if (err) {
      console.error("🔴 Multer error:", err.message);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, analyzeDoc);

app.get("/api/history", requireAuth , fetchHistory)
app.use("/api/documents", docRoutes)

app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

export default app;