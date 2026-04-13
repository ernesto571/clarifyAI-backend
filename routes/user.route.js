import express from "express";
import { getProfile, updateProfile } from "../controllers/user.controller.js";
import { requireAuth } from "../config/auth.js";

const router = express.Router();

router.use(requireAuth)

router.get("/profile", getProfile);
router.patch("/profile/:id", updateProfile);

export default router;