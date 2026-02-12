import React, {useState, useEffect} from 'react';
import {TouchableOpacity, StyleSheet, View, Image} from 'react-native';
import {SvgXml} from 'react-native-svg';
import {useWallet} from '../../context/WalletContext';
import {generateAvatarFromAddress} from '../../utils/avatarUtils';
import {mmkvStorage, STORAGE_KEYS} from '../../state/storage';
import {RFValue} from 'react-native-responsive-fontsize';

interface ProfileAvatarProps {
  onPress: () => void;
  size?: number;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  onPress,
  size = 50,
}) => {
  const {publicKey} = useWallet();
  const [customAvatarUri, setCustomAvatarUri] = useState<string | null>(null);
  const [avatarSvg, setAvatarSvg] = useState<string>('');

  useEffect(() => {
    // Load custom avatar if exists
    const savedUri = mmkvStorage.getItem(STORAGE_KEYS.CUSTOM_AVATAR_URI);
    setCustomAvatarUri(savedUri);

    // Generate default avatar from wallet address
    if (publicKey && !savedUri) {
      try {
        const svg = generateAvatarFromAddress(publicKey);
        if (svg && svg.trim().length > 0) {
          setAvatarSvg(svg);
        }
      } catch (error) {
        console.error('Error generating avatar:', error);
        // Fallback to a simple placeholder
        setAvatarSvg('');
      }
    }
  }, [publicKey]);

  if (!publicKey) return null;

  // Fallback placeholder SVG if no custom avatar and no generated SVG
  const placeholderSvg = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#FFD700"/>
      <circle cx="50" cy="50" r="35" fill="#FFF"/>
      <text x="50" y="60" font-size="40" text-anchor="middle" fill="#FFD700" font-family="Arial">👤</text>
    </svg>
  `;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.container, {width: size, height: size}]}>
      {customAvatarUri ? (
        <Image
          source={{uri: customAvatarUri}}
          style={[styles.image, {width: size, height: size}]}
        />
      ) : (
        <View style={[styles.svgContainer, {width: size, height: size}]}>
          <SvgXml 
            xml={avatarSvg || placeholderSvg} 
            width={size} 
            height={size} 
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 100,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  image: {
    borderRadius: 100,
  },
  svgContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
});

export default ProfileAvatar;
