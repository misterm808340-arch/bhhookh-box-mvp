import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { logoutCustomer } from '../lib/auth';
import { COLORS, RADII, SPACING } from '../theme';
import type { RootStackParamList } from '../navigation';

type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;

interface MenuEntry {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  route?: 'MyOrders' | 'Addresses' | 'Reorder';
  params?: RootStackParamList['MyOrders'];
  danger?: boolean;
  action?: () => void;
}

/**
 * My Account — the customer dashboard (§3).
 *
 * Shows the customer's name and account information, with entries for
 * My Orders, Active Orders, Order History, Saved Addresses, Reorder and
 * Logout. Logout asks for confirmation before signing out.
 */
export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const memberSince = useMemo(() => {
    if (!profile?.createdAt) return null;
    try {
      return new Date(profile.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [profile?.createdAt]);

  const displayName = profile?.name ?? user?.displayName ?? 'Customer';
  const displayEmail = profile?.email ?? user?.email ?? '';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'B';

  const entries: MenuEntry[] = [
    {
      icon: 'receipt-outline',
      title: 'My Orders',
      subtitle: 'Track live orders and view history',
      route: 'MyOrders',
      params: undefined,
    },
    {
      icon: 'pulse-outline',
      title: 'Active Orders',
      subtitle: 'Orders being prepared or delivered',
      route: 'MyOrders',
      params: { initialTab: 'active' },
    },
    {
      icon: 'time-outline',
      title: 'Order History',
      subtitle: 'Everything you have ordered',
      route: 'MyOrders',
      params: { initialTab: 'history' },
    },
    {
      icon: 'location-outline',
      title: 'Saved Addresses',
      subtitle: 'Manage delivery addresses',
      route: 'Addresses',
      params: undefined,
    },
    {
      icon: 'repeat-outline',
      title: 'Reorder',
      subtitle: 'Quickly order your favourites again',
      route: 'Reorder',
      params: undefined,
    },
  ];

  async function confirmLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out of BHHOOKH BOX?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await logoutCustomer();
            // AuthContext flips to `signedOut` — App routes to Login.
          } catch {
            setSigningOut(false);
            Alert.alert('Could not log out', 'Please check your connection and try again.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.identityName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.identityEmail} numberOfLines={1}>
              {displayEmail}
            </Text>
            <View style={styles.identityMetaRow}>
              <View style={styles.verifiedChip}>
                <Ionicons name="checkmark-circle" size={13} color={COLORS.limeDeep} />
                <Text style={styles.verifiedText}>Email verified</Text>
              </View>
              {!!memberSince && (
                <Text style={styles.memberSince}>Member since {memberSince}</Text>
              )}
            </View>
          </View>
          <Pressable
            onPress={refreshProfile}
            hitSlop={8}
            style={styles.refreshButton}
            accessibilityLabel="Refresh profile"
          >
            <Ionicons name="refresh" size={18} color={COLORS.limeDeep} />
          </Pressable>
        </View>

        {/* Menu entries */}
        <View style={styles.menuCard}>
          {entries.map((entry, index) => (
            <Pressable
              key={entry.title}
              style={[styles.menuRow, index > 0 && styles.menuRowDivider]}
              onPress={() => {
                if (entry.route === 'MyOrders') {
                  navigation.navigate('MyOrders', entry.params);
                } else if (entry.route) {
                  navigation.navigate(entry.route);
                } else if (entry.action) {
                  entry.action();
                }
              }}
            >
              <View style={entry.danger ? styles.iconBoxDanger : styles.iconBox}>
                <Ionicons
                  name={entry.icon}
                  size={20}
                  color={entry.danger ? COLORS.danger : COLORS.limeDeep}
                />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuTitle, entry.danger && { color: COLORS.danger }]}>
                  {entry.title}
                </Text>
                <Text style={styles.menuSubtitle}>{entry.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.input} />
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutCard} onPress={confirmLogout} disabled={signingOut}>
          {signingOut ? (
            <ActivityIndicator color={COLORS.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
              <Text style={styles.logoutText}>Logout</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footer}>BHHOOKH BOX · Fresh. Fast. Delivered.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  scroll: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADII.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  avatarText: {
    color: COLORS.lime,
    fontSize: 26,
    fontWeight: '900',
  },
  identityText: {
    flex: 1,
  },
  identityName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  identityEmail: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  identityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.limeSoft,
    borderRadius: RADII.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.limeDeep,
  },
  memberSince: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.lg,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
  },
  menuRowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  iconBoxDanger: {
    width: 40,
    height: 40,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: RADII.lg,
    borderWidth: 1.4,
    borderColor: COLORS.danger,
    paddingVertical: 15,
    marginTop: SPACING.lg,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: SPACING.xl,
    letterSpacing: 0.3,
  },
});
