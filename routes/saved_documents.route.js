import  express from "express";
import { requireAuth } from "../config/auth.js";
import { getSavedDocs, removeFromSavedDoc, saveDoc } from "../controllers/saved_documents.controller.js";

const router = express.Router(requireAuth)

router.patch("/:id/save", saveDoc)
router.patch("/:id/unsave", removeFromSavedDoc)

router.get("/", getSavedDocs)

export default router

