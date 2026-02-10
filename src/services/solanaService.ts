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
const DELEGATION_PROGRAM_ID = new PublicKey('DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh');
const SYSTEM_PROGRAM_ID = SystemProgram.programId;

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
 * Get PDA for victory collection
 */
export const getVictoryCollectionPda = (): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('victory_collection')],
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
    walletPublicKey: PublicKey
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

                const instruction = {
                    programId: PROGRAM_ID,
                    keys: [
                        { pubkey: playerProfilePda, isSigner: false, isWritable: true },
                        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
                        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.from([79, 249, 88, 177, 220, 62, 56, 128]), // initializePlayer discriminator
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
        // pub total_games: u64,               // 8 bytes
        // pub total_wins: u64,                // 8 bytes
        // pub highest_level: u8,              // 1 byte
        // pub unlocked_levels: u64,           // 8 bytes
        // pub total_candies_collected: u64,   // 8 bytes
        // pub total_nfts_minted: u64,         // 8 bytes
        // pub created_at: i64,                // 8 bytes

        const authority = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        const totalGames = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const totalWins = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const highestLevel = data.readUInt8(offset);
        offset += 1;

        const unlockedLevels = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const totalCandiesCollected = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const totalNftsMinted = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const createdAt = Number(data.readBigInt64LE(offset));

        return {
            authority: authority.toBase58(),
            totalGames,
            totalWins,
            highestLevel,
            unlockedLevels,
            totalCandiesCollected,
            totalNftsMinted,
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
 * Delegate game to ephemeral rollup
 */
export const delegateGame = async (
    walletPublicKey: PublicKey
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            await transact(async (wallet: Web3MobileWallet) => {
                await wallet.authorize({
                    cluster: 'devnet',
                    identity: { name: 'Candy Crush' },
                });

                const [gameSessionPda] = getGameSessionPda(walletPublicKey);

                // Derive delegation PDAs
                const [bufferPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('buffer'), gameSessionPda.toBuffer()],
                    DELEGATION_PROGRAM_ID
                );

                const [delegationRecordPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('delegation'), gameSessionPda.toBuffer()],
                    DELEGATION_PROGRAM_ID
                );

                const [delegationMetadataPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('delegation-metadata'), gameSessionPda.toBuffer()],
                    DELEGATION_PROGRAM_ID
                );

                const instruction = {
                    programId: PROGRAM_ID,
                    keys: [
                        { pubkey: walletPublicKey, isSigner: true, isWritable: false },
                        { pubkey: bufferPda, isSigner: false, isWritable: true },
                        { pubkey: delegationRecordPda, isSigner: false, isWritable: true },
                        { pubkey: delegationMetadataPda, isSigner: false, isWritable: true },
                        { pubkey: gameSessionPda, isSigner: false, isWritable: true },
                        { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.from([116, 183, 70, 107, 112, 223, 122, 210]), // delegateGame discriminator
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
                console.log('✅ Game delegated! Signature:', signature);
                resolve(signature);
            });
        } catch (error) {
            console.error('Error delegating game:', error);
            reject(error);
        }
    });
};

/**
 * Make a move using session key (gasless)
 */
export const makeMove = async (
    sessionKeypair: Keypair,
    playerPublicKey: PublicKey,
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number
): Promise<string> => {
    try {
        const [gameSessionPda] = getGameSessionPda(playerPublicKey);

        const moveData = Buffer.alloc(4);
        moveData.writeUInt8(fromRow, 0);
        moveData.writeUInt8(fromCol, 1);
        moveData.writeUInt8(toRow, 2);
        moveData.writeUInt8(toCol, 3);

        const instruction = {
            programId: PROGRAM_ID,
            keys: [
                { pubkey: gameSessionPda, isSigner: false, isWritable: true },
                { pubkey: sessionKeypair.publicKey, isSigner: true, isWritable: true },
            ],
            data: Buffer.concat([
                Buffer.from([78, 77, 152, 203, 222, 211, 208, 233]), // makeMove discriminator
                moveData,
            ]),
        };

        const transaction = new Transaction().add(
            new TransactionInstruction(instruction)
        );

        const latestBlockhash = await connection.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = sessionKeypair.publicKey;

        // Sign with session key (gasless - no wallet popup!)
        transaction.sign(sessionKeypair);

        const signature = await connection.sendRawTransaction(
            transaction.serialize()
        );

        await connection.confirmTransaction(signature);
        console.log('✅ Move made (gasless)! Signature:', signature);
        return signature;
    } catch (error) {
        console.error('Error making move:', error);
        throw error;
    }
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
 * Mint victory NFT
 */
export const mintVictoryNft = async (
    walletPublicKey: PublicKey
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
                const [victoryCollectionPda] = getVictoryCollectionPda();

                // Generate new mint keypair
                const mintKeypair = Keypair.generate();

                // Derive metadata and master edition PDAs (Metaplex standard)
                const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
                    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
                );

                const [metadata] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from('metadata'),
                        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                        mintKeypair.publicKey.toBuffer(),
                    ],
                    TOKEN_METADATA_PROGRAM_ID
                );

                const [masterEdition] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from('metadata'),
                        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                        mintKeypair.publicKey.toBuffer(),
                        Buffer.from('edition'),
                    ],
                    TOKEN_METADATA_PROGRAM_ID
                );

                // Derive token account (ATA)
                const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
                    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
                );
                const TOKEN_PROGRAM_ID = new PublicKey(
                    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
                );

                const [tokenAccount] = PublicKey.findProgramAddressSync(
                    [
                        walletPublicKey.toBuffer(),
                        TOKEN_PROGRAM_ID.toBuffer(),
                        mintKeypair.publicKey.toBuffer(),
                    ],
                    ASSOCIATED_TOKEN_PROGRAM_ID
                );

                const instruction = {
                    programId: PROGRAM_ID,
                    keys: [
                        { pubkey: gameSessionPda, isSigner: false, isWritable: false },
                        { pubkey: playerProfilePda, isSigner: false, isWritable: true },
                        { pubkey: victoryCollectionPda, isSigner: false, isWritable: true },
                        { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
                        { pubkey: tokenAccount, isSigner: false, isWritable: true },
                        { pubkey: metadata, isSigner: false, isWritable: true },
                        { pubkey: masterEdition, isSigner: false, isWritable: true },
                        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
                        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
                        {
                            pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'),
                            isSigner: false,
                            isWritable: false,
                        },
                    ],
                    data: Buffer.from([19, 172, 171, 208, 55, 63, 54, 241]), // mintVictoryNft discriminator
                };

                const transaction = new Transaction().add(
                    new TransactionInstruction(instruction)
                );

                const latestBlockhash = await connection.getLatestBlockhash();
                transaction.recentBlockhash = latestBlockhash.blockhash;
                transaction.feePayer = walletPublicKey;

                // Sign with both wallet and mint keypair
                transaction.partialSign(mintKeypair);

                const signedTransactions = await wallet.signTransactions({
                    transactions: [transaction],
                });

                const signature = await connection.sendRawTransaction(
                    signedTransactions[0].serialize()
                );

                await connection.confirmTransaction(signature);
                console.log('✅ Victory NFT minted! Signature:', signature);
                resolve(signature);
            });
        } catch (error) {
            console.error('Error minting victory NFT:', error);
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
