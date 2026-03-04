import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '../context/WalletContext';
import {
    initializePlayer as initializePlayerService,
    getPlayerProfile as getPlayerProfileService,
    startGame as startGameService,
    endGame as endGameService,
    refillEnergy as refillEnergyService,
    claimSugarRewards as claimSugarRewardsService,
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
                // Use warn (not error) so LogBox doesn't show a red overlay for expected errors
                console.warn('startGame failed:', err?.message || err);
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



    /**
     * Refill player energy
     */
    const refillEnergy = useCallback(
        async () => {
            if (!connected || !publicKey) {
                throw new Error('Wallet not connected');
            }

            try {
                setLoading(true);
                setError(null);

                console.log('⚡ Refilling energy...');
                const walletPubKey = new PublicKey(publicKey);
                const signature = await refillEnergyService(walletPubKey);

                // Refresh profile to show updated energy
                await fetchPlayerProfile();

                console.log('✅ Energy refilled!');
                return signature;
            } catch (err: any) {
                console.error('Error refilling energy:', err);
                setError(err.message || 'Failed to refill energy');
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [connected, publicKey, fetchPlayerProfile]
    );

    const claimSugarRewards = useCallback(
        async () => {
            if (!connected || !publicKey) throw new Error('Wallet not connected');
            try {
                setLoading(true);
                setError(null);
                console.log('🍬 Claiming $SUGAR rewards...');
                const walletPubKey = new PublicKey(publicKey);
                const signature = await claimSugarRewardsService(walletPubKey);
                await fetchPlayerProfile();
                console.log('✅ $SUGAR rewards claimed!');
                return signature;
            } catch (err: any) {
                setError(err.message || 'Failed to claim rewards');
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [connected, publicKey, fetchPlayerProfile]
    );

    return {
        playerProfile,
        loading,
        error,
        initializePlayer,
        fetchPlayerProfile,
        startGame,
        endGame,
        refillEnergy,
        claimSugarRewards,
    };
};
