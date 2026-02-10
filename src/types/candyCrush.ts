import { Keypair, PublicKey } from '@solana/web3.js';

export interface SessionKey {
    keypair: Keypair;
    publicKey: string;
    expiresAt: number;
}

export interface PlayerProfile {
    authority: PublicKey;
    totalWins: number;
    totalNftsMinted: number;
    unlockedLevels: number[];
}

export interface GameSession {
    player: PublicKey;
    level: number;
    score: number;
    moves: number;
    state: 'active' | 'completed' | 'failed';
    delegated: boolean;
}

export interface DelegationStatus {
    isDelegated: boolean;
    gameSessionPda?: string;
    level?: number;
    startedAt?: number;
}
