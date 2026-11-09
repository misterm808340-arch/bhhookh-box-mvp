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
import {
  AuthValidationError,
  friendlyAuthError,
  registerCustomer,
} from '../lib/auth';
import { COLORS, RADII, SPACING } from '../theme';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

/**
 * Customer Registration — Full Name, Email, Password, Confirm Password.
 *
 * After a successful registration the customer lands on the Verify Email
 * screen (AuthContext phase flips to `unverified`) and a verification email
 * has been sent by Firebase.
 */
export function RegisterScreen() {
  const navigation = useNavigation<{ navigate: (screen: 'Login') => void; goBack: () => void }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function clearError(key: keyof FieldErrors) {
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      next.name = 'Please enter your full name (2–80 characters).';
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }
    if (confirm !== password) {
      next.confirm = 'Passwords do not match.';
    }
    return next;
  }

  async function handleRegister() {
    if (submitting) return;
    setFormError(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await registerCustomer(name, email, password);
      // Auth state listener routes onward (Verify Email screen).
    } catch (err) {
      if (err instanceof AuthValidationError) {
        setFormError(err.message);
      } else {
        setFormError(friendlyAuthError(err));
      }
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

          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>BHHOOKH BOX</Text>
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                clearError('name');
              }}
              placeholder="e.g. Aarav Sharma"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              editable={!submitting}
            />
            {!!errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={email}
              onChangeText={(text) => {
                setEmail(text.trim());
                clearError('email');
              }}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!submitting}
            />
            {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordRow, errors.password && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  clearError('password');
                }}
                placeholder="At least 6 characters"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!submitting}
              />
              <Pressable
                onPress={() => setShowPassword((visible) => !visible)}
                hitSlop={12}
                disabled={submitting}
              >
                <Text style={styles.showToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[styles.input, errors.confirm && styles.inputError]}
              value={confirm}
              onChangeText={(text) => {
                setConfirm(text);
                clearError('confirm');
              }}
              placeholder="Re-enter your password"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!submitting}
              onSubmitEditing={handleRegister}
            />
            {!!errors.confirm && <Text style={styles.fieldError}>{errors.confirm}</Text>}
          </View>

          {!!formError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          )}

          <PrimaryButton
            title="Create Account"
            onPress={handleRegister}
            loading={submitting}
            disabled={submitting}
          />

          <Text style={styles.legal}>
            We will send a verification link to this email address. You must verify your email
            before placing orders.
          </Text>

          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={10}>
              <Text style={styles.loginLink}>Login</Text>
            </Pressable>
          </View>
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
    marginBottom: SPACING.md,
  },
  backText: {
    color: COLORS.limeDeep,
    fontWeight: '700',
    fontSize: 15,
  },
  brandBlock: {
    marginBottom: SPACING.xl,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1.2,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
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
  fieldError: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
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
  legal: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 18,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.md,
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
