export function calculatePerformanceScore(
    solved: boolean,
    hintsUsed: number,
    retries: number,
    expectedTime: number,
    timeTaken?: number
): number {
    const baseScore = solved ? 1.0 : 0.0;
    const hintPenalty = 0.2 * hintsUsed;
    const retryPenalty = 0.1 * retries;  // Penalty for retries/errors
    const timeFactor = timeTaken ? Math.min(1.0, expectedTime / timeTaken) : 1.0; // Default to 1.0 if timeTaken is not provided
    
    return Math.max(0.0, baseScore - hintPenalty - retryPenalty) * timeFactor;
}
