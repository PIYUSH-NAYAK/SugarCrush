import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '../context/WalletContext';
import {
    initializePlayer as initializePlayerService,
    getPlayerProfile as getPlayerProfileService,
    startGame as startGameService,
    endGame as endGameService,
    initializeProgram,
} from '../services/solanaService';

export const useCandyCrushProgram = () => {
    const { publicKey, connected } = useWallet();
    const [playerProfile, setPlayerProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    /**
     * Initialize player profile
     */
    const initializePlayer = useCallback(async (name: string) => {
        if (!connected || !publicKey) {
            throw new Error('Wallet not connected');
        }

        try {
            setLoading(true);
            setError(null);

            console.log('🎮 Initializing player profile...');
            const walletPubKey = new PublicKey(publicKey);
            const signature = await initializePlayerService(walletPubKey, name);

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



    return {
        // State
        playerProfile,
        loading,
        error,

        // Game functions
        initializePlayer,
        fetchPlayerProfile,
        startGame,
        endGame,
    };
};
