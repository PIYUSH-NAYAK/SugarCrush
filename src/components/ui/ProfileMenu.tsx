import React, {useEffect, useMemo} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  Alert,
} from 'react-native';
import {useWallet} from '../../context/WalletContext';
import {truncateAddress, getThemeFromAddress} from '../../utils/avatarUtils';
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
  const {publicKey, disconnect, profileData, updateProfileData, fetchPlayerProfile} = useWallet();

  // Derive dynamic theme from wallet address
  const theme = useMemo(() => {
    return getThemeFromAddress(publicKey || 'default');
  }, [publicKey]);

  useEffect(() => {
    if (visible && publicKey) {
      fetchPlayerProfile();
    }
  }, [visible, publicKey]);

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
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.menuContainer,
            {borderColor: theme.accentBorder, shadowColor: theme.accent},
          ]}>
          {/* Top: Profile + Wallet */}
          <View
            style={[
              styles.topSection,
              {borderBottomColor: theme.accentBorder},
            ]}>
            <TouchableOpacity
              style={styles.profileSection}
              onPress={handleChangeProfilePicture}>
              <ProfileAvatar onPress={() => {}} size={70} />
              <View
                style={[
                  styles.plusIconContainer,
                  {backgroundColor: theme.accentMuted},
                ]}>
                <Text style={styles.plusIcon}>+</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.walletSection}>
              <Text style={[styles.walletLabel, {color: theme.accentText}]}>
                Wallet
              </Text>
              <TouchableOpacity onPress={handleCopyAddress}>
                <Text style={styles.walletAddress}>
                  {publicKey ? truncateAddress(publicKey, 4, 4) : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={handleDisconnect}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Player Stats */}
          {profileData && (
            <View style={styles.statsContainer}>
              <Text style={[styles.statsTitle, {color: theme.accentText}]}>
                Player Stats
              </Text>
              <View style={styles.statsSection}>
                <View
                  style={[
                    styles.statItem,
                    {
                      backgroundColor: theme.accentBg,
                      borderColor: theme.accentBorder,
                    },
                  ]}>
                  <Text style={styles.statValue}>
                    {profileData.gamesPlayed}
                  </Text>
                  <Text style={[styles.statLabel, {color: theme.accentText}]}>
                    Games Played
                  </Text>
                </View>
                <View
                  style={[
                    styles.statItem,
                    {
                      backgroundColor: theme.accentBg,
                      borderColor: theme.accentBorder,
                    },
                  ]}>
                  <Text style={styles.statValue}>
                    {profileData.highScore}
                  </Text>
                  <Text style={[styles.statLabel, {color: theme.accentText}]}>
                    High Score
                  </Text>
                </View>
                <View
                  style={[
                    styles.statItem,
                    {
                      backgroundColor: theme.accentBg,
                      borderColor: theme.accentBorder,
                    },
                  ]}>
                  <Text style={styles.statValue}>
                    {profileData.totalTokensEarned || 0}
                  </Text>
                  <Text style={[styles.statLabel, {color: theme.accentText}]}>
                    Tokens Minted
                  </Text>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    backgroundColor: 'rgba(10, 5, 20, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  menuContainer: {
    width: screenWidth * 0.88,
    backgroundColor: 'rgba(20, 12, 35, 0.85)',
    borderRadius: 28,
    padding: RFValue(22),
    borderWidth: 1,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 15,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: RFValue(24),
    paddingBottom: RFValue(18),
    borderBottomWidth: 1,
  },
  profileSection: {
    position: 'relative',
  },
  plusIconContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: RFValue(22),
    height: RFValue(22),
    borderRadius: RFValue(11),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(20, 12, 35, 0.9)',
  },
  plusIcon: {
    color: '#FFF',
    fontSize: RFValue(14),
    fontWeight: 'bold',
    marginTop: -1,
  },
  walletSection: {
    flex: 1,
    marginLeft: RFValue(16),
    justifyContent: 'center',
  },
  walletLabel: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(11),
    marginBottom: RFValue(3),
    letterSpacing: 0.5,
  },
  walletAddress: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(15),
    color: '#E8DFFF',
    fontWeight: 'bold',
    marginBottom: RFValue(10),
    letterSpacing: 0.3,
  },
  disconnectButton: {
    backgroundColor: 'rgba(220, 70, 70, 0.2)',
    paddingVertical: RFValue(7),
    paddingHorizontal: RFValue(14),
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(220, 70, 70, 0.4)',
  },
  disconnectText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(11),
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  statsContainer: {
    marginTop: RFValue(4),
  },
  statsTitle: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(14),
    fontWeight: 'bold',
    marginBottom: RFValue(12),
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: RFValue(14),
    paddingHorizontal: RFValue(8),
    borderRadius: 16,
    borderWidth: 1,
  },
  statValue: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(20),
    color: '#E8DFFF',
    fontWeight: 'bold',
  },
  statLabel: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(8),
    marginTop: RFValue(5),
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});

export default ProfileMenu;
