"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeIncidentWithStructure = analyzeIncidentWithStructure;
const claude_1 = require("./claude");
async function analyzeIncidentWithStructure(incidentData) {
    try {
        const analysis = await (0, claude_1.analyzeIncident)(incidentData);
        // Parse the analysis into structured format
        // In production, you'd use structured output or parsing
        // For now, return a basic structure
        return {
            riskAssessment: analysis || "Analysis completed",
            patterns: [],
            recommendations: [],
            complianceStatus: "compliant",
        };
    }
    catch (error) {
        console.error("Error in incident analysis:", error);
        throw new Error("Failed to analyze incident");
    }
}
