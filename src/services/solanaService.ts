import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import candyCrushIdl from '../Contracts/candy_crush.json';

// Solana network configuration
const SOLANA_NETWORK = clusterApiUrl('devnet');
const connection = new Connection(SOLANA_NETWORK, 'confirmed');

/**
 * Initialize Anchor program
 * @param walletPublicKey - Connected wallet's public key
 * @returns Program instance
 */
export const initializeProgram = async (walletPublicKey: PublicKey) => {
    try {
        // Note: For mobile wallet adapter, we'll need to handle signing differently
        // This is a simplified version - the actual implementation will use the wallet adapter
        const provider = new AnchorProvider(
            connection,
            // @ts-ignore - Wallet adapter will be provided through context
            { publicKey: walletPublicKey },
            { commitment: 'confirmed' },
        );

        const programId = new PublicKey(candyCrushIdl.address);
        const program = new Program(candyCrushIdl as Idl, provider);

        return program;
    } catch (error) {
        console.error('Error initializing program:', error);
        throw error;
    }
};

/**
 * Initialize player profile on-chain
 * @param program - Anchor program instance
 * @param playerPublicKey - Player's wallet public key
 */
export const initializePlayer = async (
    program: Program,
    playerPublicKey: PublicKey,
) => {
    try {
        const [playerProfilePda] = PublicKey.findProgramAddressSync(
            [Buffer.from('player_profile'), playerPublicKey.toBuffer()],
            program.programId,
        );

        // Check if player profile already exists
        try {
            const playerProfile = await program.account.playerProfile.fetch(
                playerProfilePda,
            );
            console.log('Player profile already exists:', playerProfile);
            return playerProfile;
        } catch (e) {
            // Profile doesn't exist, create it
            console.log('Creating new player profile...');
        }

        const tx = await program.methods
            .initializePlayer()
            .accounts({
                playerProfile: playerProfilePda,
                authority: playerPublicKey,
            })
            .rpc();

        console.log('Player initialized! Transaction signature:', tx);
        return tx;
    } catch (error) {
        console.error('Error initializing player:', error);
        throw error;
    }
};

/**
 * Get player profile data
 * @param program - Anchor program instance
 * @param playerPublicKey - Player's wallet public key
 */
export const getPlayerProfile = async (
    program: Program,
    playerPublicKey: PublicKey,
) => {
    try {
        const [playerProfilePda] = PublicKey.findProgramAddressSync(
            [Buffer.from('player_profile'), playerPublicKey.toBuffer()],
            program.programId,
        );

        const playerProfile = await program.account.playerProfile.fetch(
            playerProfilePda,
        );
        return playerProfile;
    } catch (error) {
        console.error('Error fetching player profile:', error);
        return null;
    }
};

/**
 * Get connection instance
 */
export const getConnection = () => connection;

/**
 * Get Solana network URL
 */
export const getSolanaNetwork = () => SOLANA_NETWORK;
