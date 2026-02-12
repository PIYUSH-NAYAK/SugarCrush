import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {Alert} from 'react-native';
import {PublicKey} from '@solana/web3.js';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {WalletState, ProfileData} from '../types/walletTypes';
import {mmkvStorage, STORAGE_KEYS} from '../state/storage';
import {initializeProgram, initializePlayer, getPlayerProfile} from '../services/solanaService';

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  profileData: ProfileData | null;
  updateProfileData: (data: Partial<ProfileData>) => void;
  fetchPlayerProfile: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export const WalletProvider = ({children}: {children: ReactNode}) => {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  // Load wallet from storage on mount
  useEffect(() => {
    const loadWallet = async () => {
      const savedAddress = mmkvStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS);
      const savedProfile = mmkvStorage.getItem(STORAGE_KEYS.PLAYER_PROFILE);

      if (savedAddress) {
        setPublicKey(savedAddress);
        setConnected(true);
      }

      if (savedProfile) {
        try {
          setProfileData(JSON.parse(savedProfile));
        } catch (e) {
          console.error('Error parsing saved profile:', e);
        }
      }
    };

    loadWallet();
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      // Use Solana Mobile Wallet Adapter to connect
      await transact(async (wallet: Web3MobileWallet) => {
        // Authorize the wallet
        const authResult = await wallet.authorize({
          cluster: 'devnet',
          identity: {
            name: 'Sugar Crush',
            uri: 'https://sugarcrush.game',
            icon: 'icon.png',
          },
        });

        console.log('Auth result:', authResult);
        console.log('Account address type:', typeof authResult.accounts[0].address);
        console.log('Account address:', authResult.accounts[0].address);

        // Handle different address formats from mobile wallet adapter
        let pubKey: PublicKey;
        let publicKeyString: string;

        try {
          const addressData = authResult.accounts[0].address;
          
          // Check if it's a base64 encoded string (Solflare Mobile Wallet format)
          if (typeof addressData === 'string' && addressData.includes('=')) {
            console.log('Detected Base64 address format');
            // Decode base64 to bytes
            const base64Decoded = Buffer.from(addressData, 'base64');
            pubKey = new PublicKey(base64Decoded);
            publicKeyString = pubKey.toBase58();
          }
          // Check if it's already a base58 string
          else if (typeof addressData === 'string') {
            console.log('Detected base58 string format');
            publicKeyString = addressData;
            pubKey = new PublicKey(publicKeyString);
          } 
          // Check if it's a Uint8Array or array
          else if (typeof addressData === 'object' && (addressData instanceof Uint8Array || Array.isArray(addressData))) {
            console.log('Detected Uint8Array/Array format');
            pubKey = new PublicKey(addressData);
            publicKeyString = pubKey.toBase58();
          }
          // Handle Buffer or other formats
          else {
            console.log('Detected unknown format, trying Uint8Array conversion');
            // Try to convert to Uint8Array
            const bytes = new Uint8Array(addressData as any);
            pubKey = new PublicKey(bytes);
            publicKeyString = pubKey.toBase58();
          }

          console.log('✅ Public Key (base58):', publicKeyString);
        } catch (pkError) {
          console.error('Error creating PublicKey:', pkError);
          throw new Error('Failed to parse wallet address. Please try again.');
        }

        // Save wallet address
        mmkvStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, publicKeyString);
        setPublicKey(publicKeyString);
        setConnected(true);

        // Initialize player profile on-chain
        // TEMPORARILY DISABLED FOR DEBUGGING - We'll enable this after wallet connection works
        /*
        try {
          const program = await initializeProgram(pubKey);
          await initializePlayer(program, pubKey);

          // Create local profile data
          const newProfile: ProfileData = {
            walletAddress: publicKeyString,
            gamesPlayed: 0,
            highScore: 0,
          };

          setProfileData(newProfile);
          mmkvStorage.setItem(
            STORAGE_KEYS.PLAYER_PROFILE,
            JSON.stringify(newProfile),
          );
        } catch (error) {
          console.error('Error initializing player:', error);
          // Continue even if blockchain initialization fails
          // Still create a local profile
          const newProfile: ProfileData = {
            walletAddress: publicKeyString,
            gamesPlayed: 0,
            highScore: 0,
          };

          setProfileData(newProfile);
          mmkvStorage.setItem(
            STORAGE_KEYS.PLAYER_PROFILE,
            JSON.stringify(newProfile),
          );
        }
        */

        // Create local profile data directly (no blockchain call for now)
        const newProfile: ProfileData = {
          walletAddress: publicKeyString,
          gamesPlayed: 0,
          highScore: 0,
        };

        setProfileData(newProfile);
        mmkvStorage.setItem(
          STORAGE_KEYS.PLAYER_PROFILE,
          JSON.stringify(newProfile),
        );

        console.log('✅ Wallet connected successfully!');
      });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setConnected(false);
      setPublicKey(null);
      // Show user-friendly error message
      Alert.alert('Connection Failed', 'Failed to connect wallet. Please make sure Solflare is installed and try again.');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setConnected(false);
    setPublicKey(null);
    setProfileData(null);
    mmkvStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
    mmkvStorage.removeItem(STORAGE_KEYS.PLAYER_PROFILE);
  };

  const updateProfileData = (data: Partial<ProfileData>) => {
    if (!profileData) return;

    const updatedProfile = {...profileData, ...data};
    setProfileData(updatedProfile);
    mmkvStorage.setItem(
      STORAGE_KEYS.PLAYER_PROFILE,
      JSON.stringify(updatedProfile),
    );
  };

  const fetchPlayerProfile = async () => {
    if (!publicKey) return;

    try {
      const pubKey = new PublicKey(publicKey);
      const program = await initializeProgram(pubKey);
      const playerProfile = await getPlayerProfile(program, pubKey);

      if (playerProfile) {
        const updatedProfile: ProfileData = {
          walletAddress: publicKey,
          gamesPlayed: playerProfile.totalWins,
          highScore: playerProfile.levels.reduce((max, level) => Math.max(max, level.highScore), 0),
          totalTokensEarned: playerProfile.totalTokensEarned,
          customAvatarUri: profileData?.customAvatarUri,
          username: profileData?.username,
        };

        setProfileData(updatedProfile);
        mmkvStorage.setItem(
          STORAGE_KEYS.PLAYER_PROFILE,
          JSON.stringify(updatedProfile),
        );
      }
    } catch (error) {
      console.error('Error fetching player profile:', error);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        connected,
        publicKey,
        connecting,
        connect,
        disconnect,
        profileData,
        updateProfileData,
        fetchPlayerProfile,
      }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};
