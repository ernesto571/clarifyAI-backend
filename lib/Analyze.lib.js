import mammoth from "mammoth";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");


export const extractText = async (buffer, mimetype) => {
    if (mimetype === "application/pdf") {
        const data = await pdfParse(buffer);
        return data.text;
    }
    if (
        mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        const { value } = await mammoth.extractRawText({ buffer });
        return value;
    }
    throw new Error("Unsupported file type");
}; 

const getToneInstructions = (tone) => {
    switch (tone) {
      case "Simple":
        return {
          label: "Simple",
          summaryStyle: "Write in plain, everyday English. Avoid legal jargon. Short sentences. Accessible to someone with no legal background.",
          keyPointsStyle: "Clear, direct bullet points. No technical terms.",
          redFlagStyle: "Explain why it matters in plain language. No legalese.",
          sectionStyle: "2-3 plain-English sentences. Imagine explaining to a friend.",
        };
      case "ELI5":
        return {
          label: "ELI5",
          summaryStyle: "Explain as if talking to a 5-year-old or someone with zero knowledge of contracts. Use analogies, very short sentences, and the simplest possible words. Avoid ALL jargon.",
          keyPointsStyle: "One simple sentence each. Use comparisons to everyday things if helpful.",
          redFlagStyle: "Explain the risk like you're warning a child — what bad thing could happen to them?",
          sectionStyle: "1-2 sentences max. Super simple. What is this part 'about' in the most basic way?",
        };
      case "detailed":
      default:
        return {
          label: "Detailed",
          summaryStyle: "Provide a thorough, professional legal analysis. Use precise legal terminology. Highlight nuances, implications, and cross-clause dependencies.",
          keyPointsStyle: "Include specific clause references, legal implications, and contextual significance.",
          redFlagStyle: "Provide in-depth legal reasoning, relevant precedents or common interpretations, and recommended actions.",
          sectionStyle: "2-3 sentences with legal precision. Note any unusual deviations from standard practice.",
        };
    }
  };
  
  export const buildPrompt = (content, tone) => {
    const toneConfig = getToneInstructions(tone);
  
    return `
  You are an expert contract and legal document analyst AI.
  Analyze the document below and return a JSON object only.
  No explanation, no markdown, no code blocks — just raw JSON.
  
  ANALYSIS TONE: ${toneConfig.label}
  You must apply this tone consistently across ALL text fields in the JSON output.
  
  Tone instructions:
  - ai_summary: ${toneConfig.summaryStyle}
  - key_points: ${toneConfig.keyPointsStyle}
  - red_flags descriptions: ${toneConfig.redFlagStyle}
  - section summaries: ${toneConfig.sectionStyle}
  
  DOCUMENT:
  ${content}
  
  Return this exact JSON structure:
  {
    "contract_type": "<e.g. Employment Agreement, NDA, Lease Agreement, Terms of Service, Service Agreement, Partnership Agreement, Freelance Contract, or any other contract type>",
    "contract_type_short": "<short label or initials for the contract type e.g. NDA, ToS, MSA, SLA, LOI, NCA, EPA — if no common acronym exists use a 1-2 word label e.g. Lease, Freelance, Partnership>",
    "contract_type_description": "<short label combining contract type and the parties or subject involved e.g. 'Employment Agreement — ABC Corp', 'NDA — Freelance Client Project', 'Lease Agreement — 123 Main St', 'Service Agreement — Web Design Project'>",
    "ai_summary": "<3-5 sentence paragraph summarizing the document in the specified tone. Wrap dangerous or risky terms in <mark class='danger'>...</mark> and important notable terms in <mark class='notable'>...</mark>>",
    "key_points": [
      { "text": "<key point written in the specified tone>", "type": "good" }
    ],
    "red_flags": [
      {
        "title": "<flag title>",
        "location": "<e.g. p.6 or Section 3>",
        "severity": "high" | "medium" | "low",
        "description": "<description written in the specified tone>"
      }
    ],
    "sections": [
      {
        "title": "<Section name e.g. Section 1 — Employment Terms>",
        "status": "standard" | "good" | "review" | "caution",
        "summary": "<summary written in the specified tone>"
      }
    ],
    "meta": {
      "analysis_time_seconds": <number>,
      "document_pages": <number or null if unknown>,
      "flag_count": <number>,
      "tone": "${tone}"
    }
  }
  
  Rules:
  - contract_type: identify the exact type of contract — be specific e.g. "Non-Disclosure Agreement (NDA)" not just "NDA"
  - contract_type_short: a short badge label — use the industry-standard acronym if one exists (NDA, ToS, MSA, SLA, LOI, EPA, NCA, MOU, PSA, SOW), otherwise use a concise 1-2 word label (Lease, Freelance, Staffing). Never exceed 5 characters for acronyms.
  - contract_type_description: a short descriptor combining the contract type and the relevant party, project, or subject — format: "<Contract Type> — <Party/Subject>". Extract party names or subject matter from the document. If no specific party or subject is identifiable, use a generic descriptor e.g. "NDA — Confidential Project"
  - ai_summary:
      * <mark class='danger'> = risky or harmful clauses e.g. non-compete, IP assignment, arbitration, penalties
      * <mark class='notable'> = important terms to note e.g. salary, probation period, notice period, PTO, benefits
  - key_points: 4-7 bullet points of the most important facts
  - key_points type is always "good" for neutral/positive facts
  - red_flags: only include genuine legal concerns — return empty array if none. severity: high = serious risk, medium = worth reviewing, low = minor
  - sections: break down each major section of the document, 4-8 sections
  - section status: standard = nothing unusual, good = favorable, review = needs attention, caution = potential issue
  - meta.flag_count must equal the length of the red_flags array
  - meta.tone must reflect the tone parameter passed in
  - return ONLY the JSON object, nothing else
  `;
  };