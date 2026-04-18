import { sql } from "../config/db.js";
import { getAuthSession } from "../config/auth.js";

export const getProfile = async (req, res) => {
    try {
        const session = await getAuthSession(req.headers);
        if (!session) return res.status(401).json({ message: "Unauthorized" });
        const userId = session.user.id;

        const [user] = await sql`
            SELECT 
                u.auth_id,
                u.email,
                u.first_name,
                u.last_name,
                u.role,
                u.created_at,
                bu.image,
                (
                    SELECT COUNT(*) FROM session s 
                    WHERE s."userId" = u.auth_id 
                    AND s."expiresAt" > NOW()
                ) AS active_sessions,
                (
                    SELECT MAX(s."createdAt") FROM session s 
                    WHERE s."userId" = u.auth_id
                ) AS last_login,
                (
                    SELECT a."providerId" FROM account a 
                    WHERE a."userId" = u.auth_id 
                    LIMIT 1
                ) AS provider
            FROM users u
            JOIN "user" bu ON bu.id = u.auth_id
            WHERE u.auth_id = ${userId}
        `;

        if (!user) return res.status(404).json({ message: "User not found" });

        return res.status(200).json({ user });
    } catch (error) {
        console.error("Error in getProfile:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const session = await getAuthSession(req.headers);
        if (!session) return res.status(401).json({ message: "Unauthorized" });
        const userId = session.user.id;
        const { first_name, last_name } = req.body;

        const [updated] = await sql`
            UPDATE users
            SET first_name = ${first_name}, last_name = ${last_name}
            WHERE auth_id = ${userId}
            RETURNING auth_id, email, first_name, last_name, role, created_at
        `;

        return res.status(200).json({ user: updated });
    } catch (error) {
        console.error("Error in updateProfile:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const deleteAccount = async (req, res) => {
    try {
        const session = await getAuthSession(req.headers);
        if (!session) return res.status(401).json({ message: "Unauthorized" });
        const userId = session.user.id;

        // delete all sessions first
        await sql`DELETE FROM session WHERE "userId" = ${userId}`;

        const [deletedUser] = await sql`
            DELETE FROM users
            WHERE auth_id = ${userId}
            RETURNING auth_id, email, first_name, last_name, role, created_at
        `;

        // deleting from "user" cascades account, session, verification
        await sql`DELETE FROM "user" WHERE id = ${userId}`;

        return res.status(200).json({ deletedUser });
    } catch (error) {
        console.error("Error in DeleteAccount:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}