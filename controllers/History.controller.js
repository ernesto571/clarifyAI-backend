import { getAuthSession } from "../config/auth.js";
import { sql } from "../config/db.js";

export const fetchHistory = async(req, res) => {
    try {
        const session = await getAuthSession(req.headers);
        const userId = session.user.id;

        const history = await sql`
            SELECT * FROM analysis
            WHERE auth_id = ${userId}
            ORDER BY analyzed_at DESC
        `;
        return res.status(200).json({ history });

    } catch (error) {
        console.error("Fetch history error:", error);
        return res.status(500).json({ message: "Could not fetch history" });
    }
}