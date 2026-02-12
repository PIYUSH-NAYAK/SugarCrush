import { createAvatar } from '@dicebear/core';
import { bottts } from '@dicebear/collection';

/**
 * Generates an SVG avatar from a wallet address
 * @param walletAddress - The Solana wallet address
 * @returns SVG string of the generated avatar
 */
export const generateAvatarFromAddress = (walletAddress: string): string => {
    const avatar = createAvatar(bottts, {
        seed: walletAddress,
        size: 128,
        backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
    });

    return avatar.toString();
};

/**
 * Derives a consistent accent color theme from a wallet address.
 * Returns an object with accent, light, and muted variants.
 */
export const getThemeFromAddress = (walletAddress: string) => {
    // Generate a hue from the wallet address hash
    let hash = 0;
    for (let i = 0; i < walletAddress.length; i++) {
        hash = walletAddress.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;

    return {
        accent: `hsl(${hue}, 65%, 55%)`,        // vibrant accent
        accentLight: `hsl(${hue}, 60%, 80%)`,    // soft light tint
        accentMuted: `hsl(${hue}, 50%, 40%)`,    // deeper muted
        accentBg: `hsla(${hue}, 65%, 55%, 0.12)`, // subtle background
        accentBorder: `hsla(${hue}, 65%, 55%, 0.25)`, // subtle border
        accentGlow: `hsla(${hue}, 65%, 55%, 0.4)`,  // glow/shadow
        accentText: `hsla(${hue}, 50%, 75%, 0.7)`,  // muted text
    };
};

/**
 * Truncates a wallet address for display
 * @param address - Full wallet address
 * @param startChars - Number of characters to show at start (default: 4)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address like "ABC...XYZ"
 */
export const truncateAddress = (
    address: string,
    startChars: number = 4,
    endChars: number = 4,
): string => {
    if (!address) return '';
    if (address.length <= startChars + endChars) return address;

    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Validates if a string is a valid Solana address
 * @param address - Address to validate
 * @returns true if valid
 */
export const isValidSolanaAddress = (address: string): boolean => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
};
