import { useState, useEffect, useCallback } from 'react';
import { Keypair, PublicKey } from '@solana/web3.js';
import { useWallet } from '../context/WalletContext';
import { mmkvStorage, STORAGE_KEYS } from '../state/storage';
import {
    initializePlayer as initializePlayerService,
    getPlayerProfile as getPlayerProfileService,
    startGame as startGameService,
    delegateGame as delegateGameService,
    makeMove as makeMoveService,
    endGame as endGameService,
    mintVictoryNft as mintVictoryNftService,
    initializeProgram,
} from '../services/solanaService';
import { DelegationStatus } from '../types/candyCrush';

// Session expiry duration: 1 hour
const SESSION_EXPIRY_DURATION = 60 * 60 * 1000;

export const useCandyCrushProgram = () => {
    const { publicKey, connected } = useWallet();
    const [playerProfile, setPlayerProfile] = useState<any>(null);
    const [sessionKey, setSessionKey] = useState<Keypair | null>(null);
    const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
    const [delegationStatus, setDelegationStatus] = useState<DelegationStatus>({
        isDelegated: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Load session key from storage
     */
    useEffect(() => {
        if (connected && publicKey) {
            loadSessionFromStorage();
            loadDelegationStatus();
        }
    }, [connected, publicKey]);

    /**
     * Load session key from MMKV storage
     */
    const loadSessionFromStorage = () => {
        try {
            const sessionKeyData = mmkvStorage.getItem(STORAGE_KEYS.SESSION_KEY);
            const expiryData = mmkvStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);

            if (sessionKeyData && expiryData) {
                const expiry = parseInt(expiryData, 10);

                // Check if session is still valid
                if (Date.now() < expiry) {
                    const secretKey = Uint8Array.from(JSON.parse(sessionKeyData));
                    const keypair = Keypair.fromSecretKey(secretKey);
                    setSessionKey(keypair);
                    setSessionExpiry(expiry);
                    console.log('✅ Session key loaded from storage');
                } else {
                    console.log('⚠️ Session expired, clearing...');
                    clearSession();
                }
            }
        } catch (error) {
            console.error('Error loading session from storage:', error);
        }
    };

    /**
     * Load delegation status from storage
     */
    const loadDelegationStatus = () => {
        try {
            const statusData = mmkvStorage.getItem(STORAGE_KEYS.DELEGATION_STATUS);
            if (statusData) {
                const status: DelegationStatus = JSON.parse(statusData);
                setDelegationStatus(status);
            }
        } catch (error) {
            console.error('Error loading delegation status:', error);
        }
    };

    /**
     * Save delegation status to storage
     */
    const saveDelegationStatus = (status: DelegationStatus) => {
        try {
            mmkvStorage.setItem(
                STORAGE_KEYS.DELEGATION_STATUS,
                JSON.stringify(status)
            );
            setDelegationStatus(status);
        } catch (error) {
            console.error('Error saving delegation status:', error);
        }
    };

    /**
     * Clear session key from storage
     */
    const clearSession = () => {
        mmkvStorage.removeItem(STORAGE_KEYS.SESSION_KEY);
        mmkvStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);
        setSessionKey(null);
        setSessionExpiry(null);
    };

    /**
     * Create a new session key
     */
    const createSession = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔑 Creating new session key...');

            // Generate new ephemeral keypair
            const newKeypair = Keypair.generate();
            const expiry = Date.now() + SESSION_EXPIRY_DURATION;

            // Save to storage
            const secretKeyArray = Array.from(newKeypair.secretKey);
            mmkvStorage.setItem(
                STORAGE_KEYS.SESSION_KEY,
                JSON.stringify(secretKeyArray)
            );
            mmkvStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, expiry.toString());

            setSessionKey(newKeypair);
            setSessionExpiry(expiry);

            console.log('✅ Session key created:', newKeypair.publicKey.toBase58());
            console.log('⏰ Session expires at:', new Date(expiry).toISOString());

            return newKeypair;
        } catch (err: any) {
            console.error('Error creating session:', err);
            setError(err.message || 'Failed to create session');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Check if session is valid
     */
    const isSessionValid = useCallback(() => {
        if (!sessionKey || !sessionExpiry) return false;
        return Date.now() < sessionExpiry;
    }, [sessionKey, sessionExpiry]);

    /**
     * Initialize player profile
     */
    const initializePlayer = useCallback(async () => {
        if (!connected || !publicKey) {
            throw new Error('Wallet not connected');
        }

        try {
            setLoading(true);
            setError(null);

            console.log('🎮 Initializing player profile...');
            const walletPubKey = new PublicKey(publicKey);
            const signature = await initializePlayerService(walletPubKey);

            console.log('✅ Player profile initialized!');

            // Fetch the newly created profile
            await fetchPlayerProfile();

            return signature;
        } catch (err: any) {
            console.error('Error initializing player:', err);
            setError(err.message || 'Failed to initialize player');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [connected, publicKey]);

    /**
     * Fetch player profile
     */
    const fetchPlayerProfile = useCallback(async () => {
        if (!connected || !publicKey) {
            return null;
        }

        try {
            const walletPubKey = new PublicKey(publicKey);
            const program = await initializeProgram(walletPubKey);
            const profile = await getPlayerProfileService(program, walletPubKey);

            setPlayerProfile(profile);
            return profile;
        } catch (err: any) {
            console.error('Error fetching player profile:', err);
            return null;
        }
    }, [connected, publicKey]);

    /**
     * Start a new game
     */
    const startGame = useCallback(
        async (level: number) => {
            if (!connected || !publicKey) {
                throw new Error('Wallet not connected');
            }

            try {
                setLoading(true);
                setError(null);

                console.log(`🎮 Starting game at level ${level}...`);
                const walletPubKey = new PublicKey(publicKey);
                const signature = await startGameService(walletPubKey, level);

                console.log('✅ Game started!');
                return signature;
            } catch (err: any) {
                console.error('Error starting game:', err);
                setError(err.message || 'Failed to start game');
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [connected, publicKey]
    );

    /**
     * Delegate game to ephemeral rollup
     */
    const delegateGame = useCallback(async () => {
        if (!connected || !publicKey) {
            throw new Error('Wallet not connected');
        }

        try {
            setLoading(true);
            setError(null);

            console.log('🚀 Delegating game to ephemeral rollup...');
            const walletPubKey = new PublicKey(publicKey);
            const signature = await delegateGameService(walletPubKey);

            // Update delegation status
            saveDelegationStatus({
                isDelegated: true,
                startedAt: Date.now(),
            });

            console.log('✅ Game delegated!');
            return signature;
        } catch (err: any) {
            console.error('Error delegating game:', err);
            setError(err.message || 'Failed to delegate game');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [connected, publicKey]);

    /**
     * Make a move (gasless with session key)
     */
    const makeMove = useCallback(
        async (
            fromRow: number,
            fromCol: number,
            toRow: number,
            toCol: number
        ) => {
            if (!connected || !publicKey) {
                throw new Error('Wallet not connected');
            }

            if (!sessionKey || !isSessionValid()) {
                throw new Error('Session key expired or not found. Please create a new session.');
            }

            try {
                console.log(`🎯 Making move: (${fromRow},${fromCol}) -> (${toRow},${toCol})`);

                const walletPubKey = new PublicKey(publicKey);
                const signature = await makeMoveService(
                    sessionKey,
                    walletPubKey,
                    fromRow,
                    fromCol,
                    toRow,
                    toCol
                );

                console.log('✅ Move made (gasless)!');
                return signature;
            } catch (err: any) {
                console.error('Error making move:', err);
                setError(err.message || 'Failed to make move');
                throw err;
            }
        },
        [connected, publicKey, sessionKey, isSessionValid]
    );

    /**
     * End game
     */
    const endGame = useCallback(
        async (finalScore: number) => {
            if (!connected || !publicKey) {
                throw new Error('Wallet not connected');
            }

            try {
                setLoading(true);
                setError(null);

                console.log(`🏁 Ending game with score: ${finalScore}...`);
                const walletPubKey = new PublicKey(publicKey);
                const signature = await endGameService(walletPubKey, finalScore);

                // Clear delegation status
                saveDelegationStatus({ isDelegated: false });

                // Refresh player profile
                await fetchPlayerProfile();

                console.log('✅ Game ended!');
                return signature;
            } catch (err: any) {
                console.error('Error ending game:', err);
                setError(err.message || 'Failed to end game');
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [connected, publicKey, fetchPlayerProfile]
    );

    /**
     * Mint victory NFT
     */
    const mintVictoryNft = useCallback(async () => {
        if (!connected || !publicKey) {
            throw new Error('Wallet not connected');
        }

        try {
            setLoading(true);
            setError(null);

            console.log('🎨 Minting victory NFT...');
            const walletPubKey = new PublicKey(publicKey);
            const signature = await mintVictoryNftService(walletPubKey);

            // Refresh player profile
            await fetchPlayerProfile();

            console.log('✅ Victory NFT minted!');
            return signature;
        } catch (err: any) {
            console.error('Error minting victory NFT:', err);
            setError(err.message || 'Failed to mint victory NFT');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [connected, publicKey, fetchPlayerProfile]);

    return {
        // State
        playerProfile,
        sessionKey,
        sessionExpiry,
        delegationStatus,
        loading,
        error,

        // Session management
        createSession,
        isSessionValid,
        clearSession,

        // Game functions
        initializePlayer,
        fetchPlayerProfile,
        startGame,
        delegateGame,
        makeMove,
        endGame,
        mintVictoryNft,
    };
};
