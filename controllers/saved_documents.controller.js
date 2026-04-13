import { sql } from "../config/db.js";
import { getAuthSession } from "../config/auth.js";

export const saveDoc = async (req, res) => {
    const { id } = req.params;
   
    try{
      const savedDoc = await sql`
        UPDATE analysis
          SET is_saved=true
          WHERE id=${id}
          RETURNING *
        `;
  
        res.status(200).json({ success: true, data: savedDoc[0] });
    } catch (error) {
      console.log("Error in saveDoc function", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }
  
export const removeFromSavedDoc = async (req, res) => {
    const { id } = req.params;

    try{
        const removedDoc = await sql`
        UPDATE analysis
            SET is_saved=false
            WHERE id=${id}
            RETURNING *
        `;

        res.status(200).json({ success: true, data: removedDoc[0] });
    } catch (error) {
        console.log("Error in removeFromDavedDoc function", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

export const getSavedDocs = async (req, res) => {

    try {
        const session = await getAuthSession(req.headers);
        const userId = session.user.id;
        const userDocs = await sql `
            SELECT * FROM analysis
            WHERE auth_id=${userId} AND is_saved=true
            ORDER BY updated_at DESC
        `

        return res.status(200).json({ userDocs });

    } catch (error) {
        console.log("Error in getSavedDocs function", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}