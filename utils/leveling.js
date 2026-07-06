/**
 * Calculate the amount of XP needed to reach a specific target level.
 * @param {number} level Target level
 * @returns {number} XP required
 */
export function calculateXpNeeded(level) {
    // A standard generic RPG leveling formula: 100 * level^2
    return 100 * level * level;
}

/**
 * Generate a random amount of XP to give a user.
 * @param {number} min Minimum XP
 * @param {number} max Maximum XP
 * @returns {number} Random XP amount
 */
export function getRandomXp(min = 15, max = 25) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
