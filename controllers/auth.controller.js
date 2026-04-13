import { sql } from "../config/db.js";
import { auth } from "../config/auth.js";
import { fromNodeHeaders } from "better-auth/node";

export const signup = async (req, res) => {
    const { email, password, first_name, last_name, role } = req.body;
  
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        error: "email, password, first_name and last_name are all required.",
      });
    }
  
    try {
      await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: `${first_name} ${last_name}`,
          role: role || "user", // passed here → available in databaseHooks
          first_name,
          last_name,
        },
      });

  
      return res.status(201).json({
        message: "Account created successfully.",
        user: { email, first_name, last_name, role: role || "user" },
      });
    } catch (err) {
      if (err?.status === 422 || err?.message?.toLowerCase().includes("exist")) {
        return res.status(409).json({ error: "An account with that email already exists." });
      }
      console.error("Signup error:", err);
      return res.status(500).json({ error: "Signup failed. Please try again." });
    }
  };

  export const login = async (req, res) => {
    const { email, password } = req.body;
  
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
  
    try {
      // returnHeaders: true gives us the Set-Cookie header to forward to the client
      const result = await auth.api.signInEmail({
        body: { email, password },
        returnHeaders: true,
      });
  
      // Update last_login in your users table
      await sql`
        UPDATE users SET last_login = NOW() WHERE email = ${email}
      `;
  
      // Forward the session cookie Better Auth set
      const cookies = result.headers.getSetCookie();
      if (cookies.length) {
        res.setHeader("Set-Cookie", cookies);
      }
  
      // Fetch your full user record to return it
      const [user] = await sql`
        SELECT id, email, first_name, last_name, role, created_at, last_login
        FROM users WHERE email = ${email}
      `;
  
      return res.status(200).json({
        message: "Login successful.",
        user,
      });
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
      console.error("Login error:", err);
      return res.status(500).json({ error: "Login failed. Please try again." });
    }
};
  
  // ─── POST /api/auth/logout ────────────────────────────────────────────────────
  export const logout = async (req, res) => {
    try {
      await auth.api.signOut({
        headers: fromNodeHeaders(req.headers),
      });
      return res.status(200).json({ message: "Logged out successfully." });
    } catch (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Logout failed." });
    }
};  