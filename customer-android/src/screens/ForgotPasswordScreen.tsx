import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { PrimaryButton } from '../components/PrimaryButton';
import { friendlyAuthError, requestPasswordReset } from '../lib/auth';
import { COLORS, RADII, SPACING } from '../theme';

/**
 * Forgot password — sends Firebase's password-reset email.
 * The reset itself happens in the email link (handled by Firebase), after
 * which the customer logs in with the new password.
 */
export function ForgotPasswordScreen() {
  const navigation = useNavigation<{ goBack: () => void; navigate: (screen: 'Login') => void }>();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (submitting) return;
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            Enter the email you registered with and we will send you a link to set a new password.
          </Text>

          {sent ? (
            <View style={styles.sentCard}>
              <Text style={styles.sentTitle}>Email sent ✅</Text>
              <Text style={styles.sentBody}>
                If an account exists for <Text style={styles.sentEmail}>{email.trim()}</Text>, a
                password reset link is on its way. Check your inbox (and spam folder), then log in
                with your new password.
              </Text>
              <PrimaryButton
                title="Back to Login"
                onPress={() => navigation.navigate('Login')}
                style={{ marginTop: SPACING.lg }}
              />
            </View>
          ) : (
            <View>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text.trim());
                    if (error) setError(null);
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!submitting}
                  onSubmitEditing={handleSend}
                />
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <PrimaryButton title="Send reset link" onPress={handleSend} loading={submitting} />

              <View style={styles.loginRow}>
                <Text style={styles.loginPrompt}>Remembered your password? </Text>
                <Pressable onPress={() => navigation.navigate('Login')} hitSlop={10}>
                  <Text style={styles.loginLink}>Login</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.lg,
  },
  backText: {
    color: COLORS.limeDeep,
    fontWeight: '700',
    fontSize: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: SPACING.xl,
  },
  field: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.input,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.text,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  errorBox: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADII.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  sentCard: {
    backgroundColor: COLORS.limeSoft,
    borderRadius: RADII.lg,
    padding: SPACING.xl,
  },
  sentTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.limeDeep,
    marginBottom: SPACING.sm,
  },
  sentBody: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
  },
  sentEmail: {
    fontWeight: '800',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  loginPrompt: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  loginLink: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 14,
  },
});
