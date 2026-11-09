import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { friendlyAuthError, loginCustomer } from '../lib/auth';
import { COLORS, RADII, SPACING } from '../theme';

/**
 * Customer Login — Email + Password.
 *
 * On success the AuthContext flips to `unverified` (→ Verify Email screen) or
 * `signedIn` (→ Home) automatically, so this screen never navigates manually.
 */
export function LoginScreen() {
  const navigation = useNavigation<{ navigate: (screen: 'Register' | 'ForgotPassword') => void }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (submitting) return;
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Please enter your password (at least 6 characters).');
      return;
    }
    setSubmitting(true);
    try {
      await loginCustomer(email, password);
      // Auth state listener routes onward (Verify Email or Home).
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
          {/* Brand */}
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>BB</Text>
            </View>
            <Text style={styles.brandName}>BHHOOKH BOX</Text>
            <Text style={styles.tagline}>Fresh. Fast. Delivered.</Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to order your favourites.</Text>

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
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordRow, error && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError(null);
                }}
                placeholder="Your password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!submitting}
                onSubmitEditing={handleLogin}
              />
              <Pressable
                onPress={() => setShowPassword((visible) => !visible)}
                hitSlop={12}
                disabled={submitting}
              >
                <Text style={styles.showToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <PrimaryButton
            title="Login"
            onPress={handleLogin}
            loading={submitting}
            disabled={submitting}
          />

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={10}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </Pressable>

          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>New to BHHOOKH BOX? </Text>
            <Pressable onPress={() => navigation.navigate('Register')} hitSlop={10}>
              <Text style={styles.registerLink}>Create account</Text>
            </Pressable>
          </View>

          {submitting && (
            <ActivityIndicator color={COLORS.limeDeep} style={{ marginTop: SPACING.md }} />
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
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: RADII.xl,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  logoText: {
    color: COLORS.lime,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.input,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.text,
  },
  showToggle: {
    color: COLORS.limeDeep,
    fontWeight: '700',
    fontSize: 13,
    paddingHorizontal: SPACING.xs,
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
  forgotLink: {
    textAlign: 'center',
    color: COLORS.limeDeep,
    fontWeight: '700',
    fontSize: 14,
    marginTop: SPACING.lg,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  registerPrompt: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  registerLink: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 14,
  },
});
