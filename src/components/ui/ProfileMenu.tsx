import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  Alert,
  Image,
} from 'react-native';
import {useWallet} from '../../context/WalletContext';
import {truncateAddress} from '../../utils/avatarUtils';
import {RFValue} from 'react-native-responsive-fontsize';
import {FONTS, screenWidth} from '../../utils/Constants';
import {launchImageLibrary} from 'react-native-image-picker';
import {mmkvStorage, STORAGE_KEYS} from '../../state/storage';
import ProfileAvatar from './ProfileAvatar';
import {resetAndNavigate} from '../../utils/NavigationUtil';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
}

const ProfileMenu: React.FC<ProfileMenuProps> = ({visible, onClose}) => {
  const {publicKey, disconnect, profileData, updateProfileData} = useWallet();

  const handleCopyAddress = () => {
    if (publicKey) {
      Clipboard.setString(publicKey);
      Alert.alert('Copied!', 'Wallet address copied to clipboard');
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect your wallet?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            disconnect();
            onClose();
            // Navigate back to WelcomeScreen (logout)
            setTimeout(() => {
              resetAndNavigate('WelcomeScreen');
            }, 300);
          },
        },
      ],
    );
  };

  const handleChangeProfilePicture = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.assets && result.assets[0].uri) {
      const uri = result.assets[0].uri;
      mmkvStorage.setItem(STORAGE_KEYS.CUSTOM_AVATAR_URI, uri);
      updateProfileData({customAvatarUri: uri});
      Alert.alert('Success', 'Profile picture updated!');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.menuContainer}>
          <View style={styles.header}>
            <ProfileAvatar onPress={() => {}} size={60} />
            <Text style={styles.title}>Profile</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Wallet Address</Text>
            <TouchableOpacity
              style={styles.addressContainer}
              onPress={handleCopyAddress}>
              <Text style={styles.address}>
                {publicKey ? truncateAddress(publicKey, 6, 6) : ''}
              </Text>
              <Image
                source={require('../../assets/icons/copy.png')}
                style={styles.copyIcon}
              />
            </TouchableOpacity>
          </View>

          {profileData && (
            <View style={styles.statsSection}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profileData.gamesPlayed}</Text>
                <Text style={styles.statLabel}>Games Played</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profileData.highScore}</Text>
                <Text style={styles.statLabel}>High Score</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleChangeProfilePicture}>
            <Text style={styles.buttonText}>📷 Change Profile Picture</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.disconnectButton]}
            onPress={handleDisconnect}>
            <Text style={[styles.buttonText, styles.disconnectText]}>
              🚪 Disconnect Wallet
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  menuContainer: {
    width: screenWidth * 0.85,
    backgroundColor: '#FFF5E6',
    borderRadius: 20,
    padding: RFValue(20),
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: RFValue(20),
  },
  title: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(24),
    color: '#3A0E4C',
    marginTop: RFValue(10),
  },
  section: {
    marginBottom: RFValue(15),
  },
  label: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(12),
    color: '#5B2333',
    marginBottom: RFValue(5),
  },
  addressContainer: {
    backgroundColor: '#EDC1B9',
    padding: RFValue(12),
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  address: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(14),
    color: '#3A0E4C',
  },
  copyIcon: {
    width: RFValue(20),
    height: RFValue(20),
    tintColor: '#3A0E4C',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#c2978f',
    padding: RFValue(15),
    borderRadius: 12,
    marginBottom: RFValue(15),
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(20),
    color: '#3A0E4C',
    fontWeight: 'bold',
  },
  statLabel: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(10),
    color: '#5B2333',
    marginTop: RFValue(4),
  },
  button: {
    backgroundColor: '#9C27B0',
    padding: RFValue(14),
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: RFValue(10),
  },
  buttonText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(14),
    color: '#FFF',
    fontWeight: 'bold',
  },
  disconnectButton: {
    backgroundColor: '#D32F2F',
  },
  disconnectText: {
    color: '#FFF',
  },
});

export default ProfileMenu;
