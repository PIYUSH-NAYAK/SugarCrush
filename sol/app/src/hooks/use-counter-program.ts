import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN, setProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { type CandyCrush } from "../idl/candy_crush";
import IDL from "../idl/candy_crush.json";
import { useSessionKeyManager } from "@magicblock-labs/gum-react-sdk";

// Ephemeral Rollup endpoints - configurable via environment
const ER_ENDPOINT = "https://devnet.magicblock.app";
const ER_WS_ENDPOINT = "wss://devnet.magicblock.app";

// Delegation status
export type DelegationStatus = "undelegated" | "delegated" | "checking";

// Account Interfaces
export interface PlayerProfile {
    authority: PublicKey;
    totalGames: BN;
    totalWins: BN;
    highestLevel: number;
    unlockedLevels: BN;
    totalCandiesCollected: BN;
    totalNftsMinted: BN;
    createdAt: BN;
}

export interface GameSession {
    player: PublicKey;
    level: number;
    grid: number[][]; // 10x10 u8 array
    score: BN;
    movesMade: number;
    startTime: BN;
    isActive: boolean;
}

export interface VictoryCollection {
    authority: PublicKey;
    totalVictories: BN;
}

/**
 * Hook to interact with the Candy Crush program on Solana.
 * Supports MagicBlock Ephemeral Rollups for game sessions.
 */
export function useCandyCrushProgram() {
    const { connection } = useConnection();
    const wallet = useWallet();

    // PDAs
    const [playerProfilePda, setPlayerProfilePda] = useState<PublicKey | null>(null);
    const [gameSessionPda, setGameSessionPda] = useState<PublicKey | null>(null);
    const [victoryCollectionPda, setVictoryCollectionPda] = useState<PublicKey | null>(null);

    // Account Data
    const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
    const [gameSession, setGameSession] = useState<GameSession | null>(null);
    const [victoryCollection, setVictoryCollection] = useState<VictoryCollection | null>(null);
    
    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [isDelegating, setIsDelegating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [delegationStatus, setDelegationStatus] = useState<DelegationStatus>("checking");

    // Base Layer Provider
    const program = useMemo(() => {
        if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
            return null;
        }
        const provider = new AnchorProvider(
            connection,
            {
                publicKey: wallet.publicKey,
                signTransaction: wallet.signTransaction,
                signAllTransactions: wallet.signAllTransactions,
            },
            { commitment: "confirmed" }
        );
        setProvider(provider);
        return new Program<CandyCrush>(IDL as CandyCrush, provider);
    }, [connection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

    // ER Provider
    const erConnection = useMemo(() => {
        return new Connection(ER_ENDPOINT, {
            wsEndpoint: ER_WS_ENDPOINT,
            commitment: "confirmed",
        });
    }, []);

    const erProvider = useMemo(() => {
        if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
            return null;
        }
        return new AnchorProvider(
            erConnection,
            {
                publicKey: wallet.publicKey,
                signTransaction: wallet.signTransaction,
                signAllTransactions: wallet.signAllTransactions,
            },
            { commitment: "confirmed" }
        );
    }, [erConnection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

    const erProgram = useMemo(() => {
        if (!erProvider) return null;
        return new Program<CandyCrush>(IDL as CandyCrush, erProvider);
    }, [erProvider]);

    // Session Key Manager
    const sessionWallet = useSessionKeyManager(wallet as any, connection, "devnet");
    const { sessionToken, createSession: sdkCreateSession, isLoading: isSessionLoading } = sessionWallet;

    const createSession = useCallback(async () => {
        return await sdkCreateSession(new PublicKey(IDL.address));
    }, [sdkCreateSession]);

    // Derive PDAs
    useEffect(() => {
        if (wallet.publicKey) {
            const [pProfile] = PublicKey.findProgramAddressSync(
                [Buffer.from("player_profile"), wallet.publicKey.toBuffer()],
                new PublicKey(IDL.address)
            );
            setPlayerProfilePda(pProfile);

            const [gSession] = PublicKey.findProgramAddressSync(
                [Buffer.from("game_session"), wallet.publicKey.toBuffer()],
                new PublicKey(IDL.address)
            );
            setGameSessionPda(gSession);
        } else {
            setPlayerProfilePda(null);
            setGameSessionPda(null);
        }

        const [vCollection] = PublicKey.findProgramAddressSync(
            [Buffer.from("victory_collection")],
            new PublicKey(IDL.address)
        );
        setVictoryCollectionPda(vCollection);
    }, [wallet.publicKey]);

    // Fetch Base Accounts
    const fetchPlayerProfile = useCallback(async () => {
        if (!program || !playerProfilePda) {
            setPlayerProfile(null);
            return;
        }
        try {
           const account = await program.account.playerProfile.fetch(playerProfilePda);
           setPlayerProfile(account as unknown as PlayerProfile);
           setError(null);
        } catch (err) {
            console.debug("Player profile not found:", err);
            setPlayerProfile(null);
        }
    }, [program, playerProfilePda]);

    const fetchGameSession = useCallback(async () => {
        if (!program || !gameSessionPda) {
            setGameSession(null);
            return;
        }
        try {
            // Try fetching from ER first if delegated
            if (delegationStatus === "delegated" && erProgram) {
                try {
                    const erAccount = await erProgram.account.gameSession.fetch(gameSessionPda);
                    setGameSession(erAccount as unknown as GameSession);
                    return;
                } catch (e) {
                    console.debug("Failed to fetch from ER, falling back to base", e);
                }
            }
            
            const account = await program.account.gameSession.fetch(gameSessionPda);
            setGameSession(account as unknown as GameSession);
        } catch (err) {
             console.debug("Game session not found:", err);
             setGameSession(null);
        }
    }, [program, erProgram, gameSessionPda, delegationStatus]);

    const fetchVictoryCollection = useCallback(async () => {
        if (!program || !victoryCollectionPda) {
            setVictoryCollection(null);
            return;
        }
        try {
            const account = await program.account.victoryCollection.fetch(victoryCollectionPda);
            setVictoryCollection(account as unknown as VictoryCollection);
        } catch (err) {
            console.debug("Victory collection not found:", err);
            setVictoryCollection(null);
        }
    }, [program, victoryCollectionPda]);

    // Check Delegation Status
    const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
    const checkDelegationStatus = useCallback(async () => {
        if (!gameSessionPda) {
            setDelegationStatus("checking");
            return;
        }
        try {
            setDelegationStatus("checking");
            const accountInfo = await connection.getAccountInfo(gameSessionPda);
            if (!accountInfo) {
                setDelegationStatus("undelegated");
                return;
            }
            const isDelegated = accountInfo.owner.equals(DELEGATION_PROGRAM_ID);
            setDelegationStatus(isDelegated ? "delegated" : "undelegated");
             // Refresh game session data after checking status
             fetchGameSession();
        } catch (err) {
            console.error("Error checking delegation:", err);
            setDelegationStatus("undelegated");
        }
    }, [gameSessionPda, connection, fetchGameSession]);

    // Subscriptions
    useEffect(() => {
        if (!program || !playerProfilePda || !gameSessionPda) return;
        
        fetchPlayerProfile();
        fetchGameSession();
        checkDelegationStatus();
        fetchVictoryCollection();

        // Subscribe to Player Profile
        const pSub = connection.onAccountChange(playerProfilePda, (info) => {
            try {
                const decoded = program.coder.accounts.decode("playerProfile", info.data);
                setPlayerProfile(decoded);
            } catch(e) { console.error("Error decoding player profile", e); }
        });

        // Subscribe to Victory Collection
        const vSub = connection.onAccountChange(victoryCollectionPda!, (info) => {
             try {
                const decoded = program.coder.accounts.decode("victoryCollection", info.data);
                setVictoryCollection(decoded);
             } catch(e) { console.error("Error decoding victory collection", e); }
        });

        // Subscribe to Game Session (Base)
        const gSub = connection.onAccountChange(gameSessionPda, (info) => {
            try {
                const decoded = program.coder.accounts.decode("gameSession", info.data);
                setGameSession(decoded);
                checkDelegationStatus();
            } catch(e) { console.error("Error decoding game session", e); }
        });

        // Subscribe to ER Game Session
        let erSub: number | null = null;
        if (delegationStatus === "delegated" && erProgram) {
             erSub = erConnection.onAccountChange(gameSessionPda, (info) => {
                try {
                    const decoded = erProgram.coder.accounts.decode("gameSession", info.data);
                    setGameSession(decoded);
                } catch(e) { console.error("Error decoding ER game session", e); }
            });
        }

        return () => {
            connection.removeAccountChangeListener(pSub);
            connection.removeAccountChangeListener(gSub);
            if (victoryCollectionPda) connection.removeAccountChangeListener(vSub);
            if (erSub) erConnection.removeAccountChangeListener(erSub);
        };
    }, [program, erProgram, playerProfilePda, gameSessionPda, victoryCollectionPda, connection, erConnection, delegationStatus]);


    // Actions
    const initializePlayer = useCallback(async () => {
        if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
        setIsLoading(true);
        try {
            const tx = await program.methods
                .initializePlayer()
                .accounts({
                    playerProfile: playerProfilePda!,
                    authority: wallet.publicKey,
                } as any)
                .rpc();
            await fetchPlayerProfile();
            return tx;
        } catch (e) {
            console.error(e);
            throw e;
        } finally { setIsLoading(false); }
    }, [program, wallet.publicKey, playerProfilePda]);

    const startGame = useCallback(async (level: number) => {
        if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
        setIsLoading(true);
        try {
            // First Delegate if not delegated (optional optimization: auto-delegate on start)
            // But standard flow: Start Game (Base) -> Delegate (Base) -> Play (ER)
            // Or Start Game (Base) -> Commit (Base -> ER)?? 
            // The `start_game` instruction is on base layer.
            
            const tx = await program.methods
                .startGame(level)
                .accounts({
                    gameSession: gameSessionPda!,
                    playerProfile: playerProfilePda!,
                    authority: wallet.publicKey,
                } as any)
                .rpc();
            
            await fetchGameSession();
            return tx;
        } catch (e) {
             console.error(e);
             throw e;
        } finally { setIsLoading(false); }
    }, [program, wallet.publicKey, gameSessionPda, playerProfilePda]);

    // Make Move (ER preferred)
    const makeMove = useCallback(async (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
        if (!program || !gameSessionPda) throw new Error("Game not initialized");
        setIsLoading(true);
        
        try {
             // Determine if we should use ER or Base
            const useEr = delegationStatus === "delegated" && erProgram;
            const targetProgram = useEr ? erProgram : program;
            const targetConnection = useEr ? erConnection : connection;

            const hasSession = sessionToken != null && sessionWallet != null;
            const signer = hasSession ? sessionWallet.publicKey : wallet.publicKey;

            let builder = targetProgram.methods
                .makeMove(fromRow, fromCol, toRow, toCol)
                .accounts({
                    gameSession: gameSessionPda,
                    signer: signer,
                    sessionToken: hasSession ? sessionToken : null,
                } as any);

            let tx = await builder.transaction();
            tx.feePayer = wallet.publicKey!; // Main wallet always pays fees for simplicity
            tx.recentBlockhash = (await targetConnection.getLatestBlockhash()).blockhash;

             if (hasSession && sessionWallet.signTransaction) {
                 // Use session wallet to sign if available
                 // Note: fee payer matching might be needed depending on implementation
                 tx = await sessionWallet.signTransaction(tx);
             } else {
                 tx = await wallet.signTransaction!(tx);
             }

            // Send
            const signature = await targetConnection.sendRawTransaction(tx.serialize());
            await targetConnection.confirmTransaction(signature, "confirmed");

            if (useEr) {
                // Manually fetch update
                 const account = await erProgram!.account.gameSession.fetch(gameSessionPda);
                 setGameSession(account as unknown as GameSession);
            } else {
                await fetchGameSession();
            }
            return signature;

        } catch (e) {
            console.error(e);
            throw e;
        } finally { setIsLoading(false); }

    }, [program, erProgram, gameSessionPda, delegationStatus, sessionToken, sessionWallet, wallet]);

    const endGame = useCallback(async (finalScore: BN) => {
         if (!program || !gameSessionPda) throw new Error("Game not initialized");
         setIsLoading(true);
         try {
             const tx = await program.methods
                .endGame(finalScore)
                .accounts({
                    gameSession: gameSessionPda,
                    playerProfile: playerProfilePda!,
                    authority: wallet.publicKey!,
                } as any)
                .rpc();
            await fetchGameSession();
            await fetchPlayerProfile();
            return tx;
         } catch(e) {
             console.error(e);
             throw e;
         } finally { setIsLoading(false); }
    }, [program, gameSessionPda, playerProfilePda, wallet.publicKey]);

    const mintVictoryNft = useCallback(async () => {
         if (!program || !gameSessionPda) throw new Error("Game not initialized");
         setIsLoading(true);
         try {
             // Derive Mint address (random or PDA, usually random for unique mints)
             // But for this simplified version, let's generate a keypair or use a seed if we want it deterministic
             const mintKeypair = Keypair.generate();

             const tx = await program.methods                .mintVictoryNft()
                .accounts({
                    gameSession: gameSessionPda,
                    playerProfile: playerProfilePda!,
                    victoryCollection: victoryCollectionPda!,
                    mint: mintKeypair.publicKey,
                    authority: wallet.publicKey!,
                    tokenAccount: null, // Will be calculated by Anchor (init_if_needed associated)
                    metadata: null, // Calculated by Anchor/Metaplex
                    masterEdition: null, // Calculated
                    tokenProgram: null,
                    associatedTokenProgram: null,
                    tokenMetadataProgram: null,
                    rent: null,
                    systemProgram: null,
                } as any)
                .signers([mintKeypair])
                .rpc();
             return tx;
         } catch(e) {
             console.error(e);
             throw e;
         } finally { setIsLoading(false); }
    }, [program, gameSessionPda, playerProfilePda, victoryCollectionPda, wallet.publicKey]);


    // Ephemeral Ops (Delegate/Undelegate)
    const delegateGame = useCallback(async () => {
        if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
        setIsLoading(true);
        try {
            const tx = await program.methods
                .delegateGame()
                .accounts({
                    payer: wallet.publicKey,
                    pda: gameSessionPda!,
                } as any)
                .rpc({ skipPreflight: true });
            
            await new Promise(r => setTimeout(r, 2000));
            await checkDelegationStatus();
            return tx;
        } catch(e) {
            console.error(e);
            throw e;
        } finally { setIsLoading(false); }
    }, [program, wallet.publicKey, gameSessionPda]);

    const undelegateGame = useCallback(async () => {
        if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
        setIsLoading(true);
        try {
            // Commit and Undelegate logic usually combined or sequential
             const tx = await program.methods
                .undelegateGame()
                .accounts({
                    payer: wallet.publicKey,
                    gameSession: gameSessionPda!,
                } as any)
                .rpc({ skipPreflight: true });
            
             await new Promise(r => setTimeout(r, 2000));
             await checkDelegationStatus();
             await fetchGameSession();
             return tx;
        } catch(e) {
             console.error(e);
             throw e;
        } finally { setIsLoading(false); }
    }, [program, wallet.publicKey, gameSessionPda]);


    return {
        program,
        playerProfile,
        gameSession,
        isLoading,
        error,
        initializePlayer,
        startGame,
        makeMove,
        endGame,
        mintVictoryNft,
        delegateGame,
        undelegateGame,
        delegationStatus,
        createSession,
        sessionToken,
        wallet,
        // Getters
        fetchPlayerProfile,
        fetchGameSession,
        fetchVictoryCollection
    };
}
