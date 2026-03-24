"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSafetyReport = generateSafetyReport;
const claude_1 = require("./claude");
async function generateSafetyReport(data) {
    try {
        // Validate input
        if (!data.siteId || !data.startDate || !data.endDate) {
            throw new Error("Missing required report data");
        }
        if (data.endDate < data.startDate) {
            throw new Error("End date must be after start date");
        }
        return await (0, claude_1.generateReport)(data);
    }
    catch (error) {
        console.error("Error generating safety report:", error);
        throw error instanceof Error ? error : new Error("Failed to generate report");
    }
}
