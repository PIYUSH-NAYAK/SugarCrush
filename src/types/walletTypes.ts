export interface WalletState {
    connected: boolean;
    publicKey: string | null;
    connecting: boolean;
}

export interface ProfileData {
    walletAddress: string;
    customAvatarUri?: string;
    username?: string;
    gamesPlayed: number;
    highScore: number;
    totalTokensEarned?: number;
    energy?: number;
    highestLevel?: number;
    totalWins?: number;
}

export interface ProfileMenuState {
    visible: boolean;
}
