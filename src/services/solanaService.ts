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

// Treasury address (program upgrade authority / deployer wallet)
const TREASURY_ADDRESS = new PublicKey('FPbaNsT6gVfGGT9dSAHfetzcgd5F99C2AzUThpbnTn8r');

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

export const getPlayerProfile = async (
    _program: Program,
    playerPublicKey: PublicKey
) => {
    try {
        const [playerProfilePda] = getPlayerProfilePda(playerPublicKey);

        // Use connection.getAccountInfo() directly to avoid Anchor's borsh decoder
        // which uses Node.js Buffer methods (readUIntLE) not available in React Native Hermes
        const accountInfo = await connection.getAccountInfo(playerProfilePda);

        if (!accountInfo || !accountInfo.data) {
            return null; // Account not yet created — new user
        }

        // Manually decode the borsh-serialized PlayerProfile struct
        // Layout (after 8-byte discriminator):
        //   authority         : 32 bytes (pubkey)
        //   total_games       : 8  bytes (u64 LE)
        //   total_wins        : 8  bytes (u64 LE)
        //   highest_level     : 1  byte  (u8)
        //   unlocked_levels   : 8  bytes (u64 LE)
        //   total_candies_collected : 8 bytes (u64 LE)
        //   total_nfts_minted : 8  bytes (u64 LE)
        //   energy            : 1  byte  (u8)
        //   last_energy_update: 8  bytes (i64 LE)
        //   staked_sugar      : 8  bytes (u64 LE)
        //   created_at        : 8  bytes (i64 LE)
        const data = accountInfo.data;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        let offset = 8; // skip 8-byte Anchor discriminator

        const authorityBytes = data.slice(offset, offset + 32);
        const authority = new PublicKey(authorityBytes).toBase58();
        offset += 32;

        // Helper: read u64 as Number (safe for values < 2^53)
        const readU64 = (o: number) => {
            const lo = view.getUint32(o, true);
            const hi = view.getUint32(o + 4, true);
            return hi * 0x100000000 + lo;
        };

        // Helper: read i64 as Number
        const readI64 = (o: number) => {
            const lo = view.getUint32(o, true);
            const hi = view.getInt32(o + 4, true);
            return hi * 0x100000000 + lo;
        };

        const totalGames = readU64(offset); offset += 8;
        const totalWins = readU64(offset); offset += 8;
        const highestLevel = view.getUint8(offset); offset += 1;
        const unlockedLevels = readU64(offset); offset += 8;
        const totalCandiesCollected = readU64(offset); offset += 8;
        const totalNftsMinted = readU64(offset); offset += 8;
        const energy = view.getUint8(offset); offset += 1;
        const lastEnergyUpdate = readI64(offset); offset += 8;
        const stakedSugar = readU64(offset); offset += 8;
        const createdAt = readI64(offset);

        return {
            authority,
            totalGames,
            totalWins,
            highestLevel,
            unlockedLevels,
            totalCandiesCollected,
            totalNftsMinted,
            energy,
            lastEnergyUpdate,
            stakedSugar,
            createdAt,
        };
    } catch (error: any) {
        // "Account does not exist" is expected for new users — silently return null
        if (error?.message?.includes('Account does not exist')) {
            return null;
        }
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
                        { pubkey: playerProfilePda, isSigner: false, isWritable: true },
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
                        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
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
 * Claim $SUGAR tokens by converting earned candies
 * Discriminator: [9, 197, 205, 240, 215, 243, 64, 57]
 */
export const claimSugarRewards = async (
    walletPublicKey: PublicKey
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            await transact(async (wallet: Web3MobileWallet) => {
                await wallet.authorize({
                    cluster: 'devnet',
                    identity: { name: 'Candy Crush' },
                });

                const [playerProfilePda] = getPlayerProfilePda(walletPublicKey);
                const [rewardAuthorityPda] = getRewardAuthorityPda();

                // Player ATA: standard Associated Token Account derivation
                const [playerTokenAccount] = PublicKey.findProgramAddressSync(
                    [
                        walletPublicKey.toBuffer(),
                        TOKEN_PROGRAM_ID.toBuffer(),
                        REWARD_MINT_ADDRESS.toBuffer(),
                    ],
                    ASSOCIATED_TOKEN_PROGRAM_ID
                );

                const transaction = new Transaction();

                // ── Check if ATA exists; create it if not ──
                const ataInfo = await connection.getAccountInfo(playerTokenAccount);
                if (!ataInfo) {
                    console.log('📦 Creating $SUGAR token account...');
                    // "create_idempotent" instruction (byte 1) — creates ATA, no-ops if already exists
                    const createAtaInstruction = new TransactionInstruction({
                        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
                        keys: [
                            { pubkey: walletPublicKey, isSigner: true, isWritable: true }, // payer
                            { pubkey: playerTokenAccount, isSigner: false, isWritable: true }, // ATA
                            { pubkey: walletPublicKey, isSigner: false, isWritable: false }, // owner
                            { pubkey: REWARD_MINT_ADDRESS, isSigner: false, isWritable: false }, // mint
                            { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        ],
                        data: Buffer.from([1]), // 1 = create_idempotent
                    });
                    transaction.add(createAtaInstruction);
                }

                // ── Claim $SUGAR instruction ──
                const claimInstruction = new TransactionInstruction({
                    programId: PROGRAM_ID,
                    keys: [
                        { pubkey: playerProfilePda, isSigner: false, isWritable: true },
                        { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
                        { pubkey: REWARD_MINT_ADDRESS, isSigner: false, isWritable: true },
                        { pubkey: rewardAuthorityPda, isSigner: false, isWritable: false },
                        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
                        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.from([9, 197, 205, 240, 215, 243, 64, 57]),
                });
                transaction.add(claimInstruction);

                const latestBlockhash = await connection.getLatestBlockhash();
                transaction.recentBlockhash = latestBlockhash.blockhash;
                transaction.feePayer = walletPublicKey;

                const signedTransactions = await wallet.signTransactions({ transactions: [transaction] });
                const signature = await connection.sendRawTransaction(signedTransactions[0].serialize());
                await connection.confirmTransaction(signature);

                console.log('✅ $SUGAR rewards claimed! Signature:', signature);
                resolve(signature);
            });
        } catch (error) {
            console.error('Error claiming sugar rewards:', error);
            reject(error);
        }
    });
};


/**
 * Refill player energy by paying SOL to the treasury
 */
export const refillEnergy = async (
    walletPublicKey: PublicKey
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            await transact(async (wallet: Web3MobileWallet) => {
                await wallet.authorize({
                    cluster: 'devnet',
                    identity: { name: 'Candy Crush' },
                });

                const [playerProfilePda] = getPlayerProfilePda(walletPublicKey);

                const instruction = {
                    programId: PROGRAM_ID,
                    keys: [
                        { pubkey: playerProfilePda, isSigner: false, isWritable: true },
                        { pubkey: TREASURY_ADDRESS, isSigner: false, isWritable: true },
                        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
                        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.from([249, 210, 36, 106, 250, 196, 4, 176]), // refill_energy discriminator
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
                console.log('✅ Energy refilled! Signature:', signature);
                resolve(signature);
            });
        } catch (error) {
            console.error('Error refilling energy:', error);
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
