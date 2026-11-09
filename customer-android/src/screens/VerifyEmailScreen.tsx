import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { friendlyAuthError, logoutCustomer, resendVerificationEmail } from '../lib/auth';
import { COLORS, RADII, SPACING } from '../theme';

/**
 * Email verification gate.
 *
 * Shown immediately after registration (and for any signed-in account whose
 * email is not verified). The customer must tap the link in the email we sent,
 * then press "I've verified my email". A resend with a 60-second cooldown is
 * provided. Logging out returns to the Login screen.
 */
export function VerifyEmailScreen() {
  const { user, reloadVerification } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [cooldown > 0]);

  async function handleResend() {
    if (!user || resending || cooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      await resendVerificationEmail(user);
      setResent(true);
      setCooldown(60);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setResending(false);
    }
  }

  async function handleCheckVerified() {
    if (!user || checking) return;
    setChecking(true);
    setError(null);
    try {
      const verified = await reloadVerification();
      if (!verified) {
        setError(
          'Your email is not verified yet. Please tap the link we emailed you, then try again.'
        );
      }
      // When verified, AuthContext flips to `signedIn` and routes to Home.
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutCustomer();
    } catch {
      // Even if sign-out fails locally, the user can retry from here.
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconEmoji}>✉️</Text>
        </View>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.body}>
          We sent a verification link to
        </Text>
        <Text style={styles.email}>{user?.email ?? 'your email address'}</Text>
        <Text style={styles.body}>
          Open the email and tap <Text style={styles.bold}>Verify</Text> to activate your account.
          Already tapped it? Press the button below.
        </Text>

        <View style={styles.actions}>
          <PrimaryButton
            title="I've verified my email"
            onPress={handleCheckVerified}
            loading={checking}
            disabled={checking}
          />
          <PrimaryButton
            title={cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend verification email'}
            onPress={handleResend}
            variant="outline"
            disabled={resending || cooldown > 0}
            loading={resending}
            style={{ marginTop: SPACING.md }}
          />
        </View>

        {resent && !error && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Verification email sent — please check your inbox.</Text>
          </View>
        )}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable onPress={handleLogout} hitSlop={10} style={styles.logoutButton}>
          {checking || resending ? (
            <ActivityIndicator color={COLORS.textMuted} />
          ) : (
            <Text style={styles.logoutText}>Use a different account — Log out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: RADII.xl,
    backgroundColor: COLORS.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  body: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: SPACING.xs,
  },
  email: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  bold: {
    fontWeight: '800',
    color: COLORS.text,
  },
  actions: {
    marginTop: SPACING.xl,
  },
  infoBox: {
    backgroundColor: COLORS.limeSoft,
    borderRadius: RADII.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: SPACING.lg,
  },
  infoText: {
    color: COLORS.limeDeep,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADII.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.sm,
  },
  logoutText: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: 14,
  },
});
