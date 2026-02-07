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
