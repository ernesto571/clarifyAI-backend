import { sql } from "../config/db.js";
import { geminiModel } from "../config/gemini.config.js";
import { buildPrompt, extractText } from "../lib/Analyze.lib.js";
import { uploadBufferToCloudinary } from "../config/cloudinary.config.js";
import { getAuthSession } from "../config/auth.js";

export const analyzeDoc = async (req, res) => {
  try {
    const { text, tone } = req.body;
    if (!text && !req.file) {
      return res.status(400).json({ error: "Provide text or a file." });
    }

    let content;

    if (req.file) {
      const { originalname, mimetype, buffer } = req.file;
      console.log("📁 File received:", { originalname, mimetype, size: buffer.length });

      console.log("⏳ Starting text extraction...");
      content = await extractText(buffer, mimetype); // ✅ no const — assigns to outer content
      console.log("📄 Text extracted, length:", content.length);

      console.log("⏳ Starting Cloudinary upload...");
      const cloudinaryResult = await uploadBufferToCloudinary(buffer, originalname);
      console.log("☁️ Cloudinary upload done:");
    } 

    if( text ) {
      content = text;
    }

    console.log("🤖 Sending to Gemini...");
    const prompt = buildPrompt(content, tone);
    const result = await geminiModel.generateContent(prompt);
    const rawText = result.response.text();
    console.log("📥 Gemini raw response:", rawText);

    const cleaned = rawText.replace(/```json|```/g, "").trim();
    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("❌ JSON parse failed:", parseError.message);
      return res.status(500).json({ message: "AI returned invalid response, please try again" });
    }

    const required = ["contract_type", "contract_type_description", "ai_summary", "key_points", "red_flags", "sections", "meta"];
    for (const field of required) {
      if (analysis[field] === undefined) {
        return res.status(500).json({ message: `AI response missing field: ${field}` });
      }
    }

    console.log("✅ Saving analysis to db")

    // only save if logged in
    let savedId = null;

    const session = await getAuthSession(req.headers);
    if (session) {
        const userId = session.user.id;
        const [saved] = await sql`
            INSERT INTO analysis (
                auth_id, contract_type, contract_type_short, contract_type_description,
                ai_summary, key_points, red_flags, sections, meta
            )
            VALUES (
                ${userId}, ${analysis.contract_type}, ${analysis.contract_type_short},
                ${analysis.contract_type_description}, ${analysis.ai_summary},
                ${JSON.stringify(analysis.key_points)}, ${JSON.stringify(analysis.red_flags)},
                ${JSON.stringify(analysis.sections)}, ${JSON.stringify(analysis.meta)}
            )
            RETURNING id
        `;
        savedId = saved.id;
        console.log("💾 Analysis saved, id:", savedId);
    } else {
        console.log("👤 Guest user — analysis not saved");
    }

    return res.status(200).json({ analysis, id: savedId });
    
  } catch (error) {
    console.error("Analyze error:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ message: error.message || "Analysis failed" });
  }
};
