import {
    Connection,
    PublicKey,
    clusterApiUrl,
    Keypair,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';
import { AnchorProvider, Program, Idl, BN } from '@coral-xyz/anchor';
import candyCrushIdl from '../contracts/candy_crush.json';
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

// Solana network configuration
const SOLANA_NETWORK = clusterApiUrl('devnet');
const connection = new Connection(SOLANA_NETWORK, 'confirmed');

// Program IDs
const PROGRAM_ID = new PublicKey(candyCrushIdl.address);
const SYSTEM_PROGRAM_ID = SystemProgram.programId;

// Token Program IDs
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Reward token mint address (SPL Token)
const REWARD_MINT_ADDRESS = new PublicKey('GpStpy4y2M47k3oTgFdiHUc47A4RJTuXSRbga9t2X2j2');

/**
 * Get PDA for player profile
 */
export const getPlayerProfilePda = (authority: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('player_profile'), authority.toBuffer()],
        PROGRAM_ID
    );
};

/**
 * Get PDA for game session
 */
export const getGameSessionPda = (player: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('game_session'), player.toBuffer()],
        PROGRAM_ID
    );
};

/**
 * Get PDA for reward authority
 */
export const getRewardAuthorityPda = (): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('reward_authority')],
        PROGRAM_ID
    );
};

/**
 * Initialize Anchor program
 */
export const initializeProgram = async (walletPublicKey: PublicKey) => {
    try {
        const provider = new AnchorProvider(
            connection,
            // @ts-ignore - Wallet adapter will be provided through context
            { publicKey: walletPublicKey },
            { commitment: 'confirmed' }
        );

        const program = new Program(candyCrushIdl as Idl, provider);
        return program;
    } catch (error) {
        console.error('Error initializing program:', error);
        throw error;
    }
};

/**
 * Initialize player profile on-chain
 */
export const initializePlayer = async (
    walletPublicKey: PublicKey,
    name: string
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            await transact(async (wallet: Web3MobileWallet) => {
                // Re-authorize for signing if needed
                const authResult = await wallet.authorize({
                    cluster: 'devnet',
                    identity: { name: 'Candy Crush' },
                });

                const [playerProfilePda] = getPlayerProfilePda(walletPublicKey);

                // Serialize name: 4 bytes length + UTF-8 bytes
                const nameBuffer = Buffer.from(name, 'utf-8');
                const nameLengthBuffer = Buffer.alloc(4);
                nameLengthBuffer.writeUInt32LE(nameBuffer.length);

                const instruction = {
                    programId: PROGRAM_ID,
                    keys: [
                        { pubkey: playerProfilePda, isSigner: false, isWritable: true },
                        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
                        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.concat([
                        Buffer.from([79, 249, 88, 177, 220, 62, 56, 128]), // initializePlayer discriminator
                        nameLengthBuffer,
                        nameBuffer,
                    ]),
                };

                const transaction = new Transaction().add(
                    new TransactionInstruction(instruction)
                );

                const latestBlockhash = await connection.getLatestBlockhash();
                transaction.recentBlockhash = latestBlockhash.blockhash;
                transaction.feePayer = walletPublicKey;

                const signedTransactions = await wallet.signTransactions({
                    transactions: [transaction],
                });

                const signature = await connection.sendRawTransaction(
                    signedTransactions[0].serialize()
                );

                await connection.confirmTransaction(signature);
                console.log('✅ Player initialized! Signature:', signature);
                resolve(signature);
            });
        } catch (error) {
            console.error('Error initializing player:', error);
            reject(error);
        }
    });
};

/**
 * Get player profile data
 */
export const getPlayerProfile = async (
    program: Program,
    playerPublicKey: PublicKey
) => {
    try {
        const [playerProfilePda] = getPlayerProfilePda(playerPublicKey);

        // Use connection.getAccountInfo instead of program.account.fetch
        // to avoid Buffer polyfill issues in React Native
        const accountInfo = await connection.getAccountInfo(playerProfilePda);

        if (!accountInfo || !accountInfo.data) {
            console.log('Account does not exist or has no data', playerProfilePda.toBase58());
            return null;
        }

        // Manual deserialization - skip 8-byte discriminator, then read fields
        const data = accountInfo.data;
        let offset = 8; // Skip Anchor discriminator

        // PlayerProfile structure from Rust:
        // pub authority: Pubkey,              // 32 bytes
        // pub name: String,                   // 4 bytes length + UTF-8 content
        // pub levels: [LevelRecord; 10],      // 10 * (8 + 1) = 90 bytes
        // pub total_wins: u64,                // 8 bytes
        // pub total_tokens_earned: u64,       // 8 bytes
        // pub created_at: i64,                // 8 bytes

        const authority = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        // Parse name (String type: 4-byte length prefix + UTF-8 bytes)
        const nameLength = data.readUInt32LE(offset);
        offset += 4;
        const name = data.slice(offset, offset + nameLength).toString('utf-8');
        offset += nameLength;

        // Parse levels array (10 LevelRecord structs)
        const levels = [];
        for (let i = 0; i < 10; i++) {
            const highScore = Number(data.readBigUInt64LE(offset));
            offset += 8;
            const completed = data.readUInt8(offset) !== 0;
            offset += 1;
            levels.push({ highScore, completed });
        }

        const totalWins = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const totalTokensEarned = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const createdAt = Number(data.readBigInt64LE(offset));

        return {
            authority: authority.toBase58(),
            name,
            levels,
            totalWins,
            totalTokensEarned,
            createdAt
        };
    } catch (error) {
        console.error('Error fetching player profile:', error);
        return null;
    }
};

/**
 * Start a new game session
 */
export const startGame = async (
    walletPublicKey: PublicKey,
    level: number
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            await transact(async (wallet: Web3MobileWallet) => {
                await wallet.authorize({
                    cluster: 'devnet',
                    identity: { name: 'Candy Crush' },
                });

                const [gameSessionPda] = getGameSessionPda(walletPublicKey);
                const [playerProfilePda] = getPlayerProfilePda(walletPublicKey);

                const levelBuffer = Buffer.alloc(1);
                levelBuffer.writeUInt8(level);

                const instruction = {
                    programId: PROGRAM_ID,
                    keys: [
                        { pubkey: gameSessionPda, isSigner: false, isWritable: true },
                        { pubkey: playerProfilePda, isSigner: false, isWritable: false },
                        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
                        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.concat([
                        Buffer.from([249, 47, 252, 172, 184, 162, 245, 14]), // startGame discriminator
                        levelBuffer,
                    ]),
                };

                const transaction = new Transaction().add(
                    new TransactionInstruction(instruction)
                );

                const latestBlockhash = await connection.getLatestBlockhash();
                transaction.recentBlockhash = latestBlockhash.blockhash;
                transaction.feePayer = walletPublicKey;

                const signedTransactions = await wallet.signTransactions({
                    transactions: [transaction],
                });

                const signature = await connection.sendRawTransaction(
                    signedTransactions[0].serialize()
                );

                await connection.confirmTransaction(signature);
                console.log('✅ Game started! Signature:', signature);
                resolve(signature);
            });
        } catch (error) {
            console.error('Error starting game:', error);
            reject(error);
        }
    });
};





/**
 * End game and update profile
 */
export const endGame = async (
    walletPublicKey: PublicKey,
    finalScore: number
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            await transact(async (wallet: Web3MobileWallet) => {
                await wallet.authorize({
                    cluster: 'devnet',
                    identity: { name: 'Candy Crush' },
                });

                const [gameSessionPda] = getGameSessionPda(walletPublicKey);
                const [playerProfilePda] = getPlayerProfilePda(walletPublicKey);
                const [rewardAuthorityPda] = getRewardAuthorityPda();

                // Derive player token account (ATA)
                const [playerTokenAccount] = PublicKey.findProgramAddressSync(
                    [
                        walletPublicKey.toBuffer(),
                        TOKEN_PROGRAM_ID.toBuffer(),
                        REWARD_MINT_ADDRESS.toBuffer(),
                    ],
                    ASSOCIATED_TOKEN_PROGRAM_ID
                );

                const scoreBuffer = Buffer.alloc(8);
                scoreBuffer.writeBigUInt64LE(BigInt(finalScore));

                const instruction = {
                    programId: PROGRAM_ID,
                    keys: [
                        { pubkey: gameSessionPda, isSigner: false, isWritable: true },
                        { pubkey: playerProfilePda, isSigner: false, isWritable: true },
                        { pubkey: REWARD_MINT_ADDRESS, isSigner: false, isWritable: true },
                        { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
                        { pubkey: rewardAuthorityPda, isSigner: false, isWritable: false },
                        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
                        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.concat([
                        Buffer.from([224, 135, 245, 99, 67, 175, 121, 252]), // endGame discriminator
                        scoreBuffer,
                    ]),
                };

                const transaction = new Transaction().add(
                    new TransactionInstruction(instruction)
                );

                const latestBlockhash = await connection.getLatestBlockhash();
                transaction.recentBlockhash = latestBlockhash.blockhash;
                transaction.feePayer = walletPublicKey;

                const signedTransactions = await wallet.signTransactions({
                    transactions: [transaction],
                });

                const signature = await connection.sendRawTransaction(
                    signedTransactions[0].serialize()
                );

                await connection.confirmTransaction(signature);
                console.log('✅ Game ended! Signature:', signature);
                resolve(signature);
            });
        } catch (error) {
            console.error('Error ending game:', error);
            reject(error);
        }
    });
};



/**
 * Get connection instance
 */
export const getConnection = () => connection;

/**
 * Get Solana network URL
 */
export const getSolanaNetwork = () => SOLANA_NETWORK;
