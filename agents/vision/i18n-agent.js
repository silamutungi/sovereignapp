// agents/vision/i18n-agent.js
// Extracts all user-facing strings from the app spec and generates a typed
// src/lib/i18n.ts with EN/ES/FR/DE translations. Returns I18nSpec.
import { AgentBase } from '../../shared/agent-base-class.js'

export class I18nAgent extends AgentBase {
  constructor() {
    super({ name: 'i18n-agent', phase: 'vision', version: '1.0.0' })
  }

  async run(context) {
    const { brief, marketing, onboarding } = context
    this.log('info', 'Extracting strings and generating i18n structure')

    const strings = this.extractStrings(brief, marketing, onboarding)
    const translations = this.buildTranslations(strings, brief)
    const i18nTs = this.renderI18nTs(translations, brief)

    return {
      string_keys: Object.keys(strings),
      translations,
      i18n_ts: i18nTs,
      supported_locales: ['en', 'es', 'fr', 'de'],
      default_locale: 'en',
    }
  }

  extractStrings(brief, marketing, onboarding) {
    const appName = brief?.app_name || 'App'
    const targetUser = brief?.target_user || 'users'
    const coreFeature = brief?.features?.[0] || 'item'

    // Canonical string map — keys are used in i18n.ts
    return {
      // Navigation
      nav_home: 'Home',
      nav_dashboard: 'Dashboard',
      nav_login: 'Sign in',
      nav_signup: 'Get started',
      nav_logout: 'Sign out',

      // Hero
      hero_eyebrow: marketing?.hero?.eyebrow || `Built for ${targetUser}`,
      hero_headline: marketing?.hero?.headline || `${appName} — built for ${targetUser}`,
      hero_subheadline: marketing?.hero?.subheadline || `The fastest way to ${coreFeature}`,
      hero_cta_primary: marketing?.hero?.primary_cta || 'Get started free',
      hero_cta_secondary: marketing?.hero?.secondary_cta || 'See how it works',

      // Auth
      auth_signup_heading: `Create your ${appName} account`,
      auth_signup_subheading: 'Takes less than a minute.',
      auth_signup_cta: 'Create account',
      auth_login_heading: 'Welcome back',
      auth_login_subheading: `Sign in to your ${appName} account`,
      auth_login_cta: 'Sign in',
      auth_email_label: 'Email address',
      auth_password_label: 'Password',
      auth_forgot_password: 'Forgot your password?',
      auth_no_account: "Don't have an account?",
      auth_have_account: 'Already have an account?',

      // Dashboard
      dashboard_heading: `Your ${appName}`,
      dashboard_empty_heading: `No ${coreFeature}s yet`,
      dashboard_empty_body: `Create your first ${coreFeature} to get started.`,
      dashboard_empty_cta: `Create ${coreFeature}`,

      // Onboarding
      onboarding_welcome_heading: `Welcome to ${appName}`,
      onboarding_welcome_subheading: 'Here is what you can do next.',
      onboarding_welcome_cta: 'Get started',

      // Common actions
      action_save: 'Save',
      action_cancel: 'Cancel',
      action_delete: 'Delete',
      action_edit: 'Edit',
      action_create: 'Create',
      action_back: 'Back',
      action_loading: 'Loading...',
      action_submitting: 'Submitting...',

      // Errors
      error_generic: 'Something went wrong. Please try again.',
      error_network: 'Network error. Check your connection and try again.',
      error_not_found: 'Page not found.',
      error_unauthorized: 'You need to sign in to access this page.',

      // Footer
      footer_tagline: `${appName} — built with Sovereign`,
      footer_privacy: 'Privacy Policy',
      footer_terms: 'Terms of Service',
      footer_copyright: `© ${new Date().getFullYear()} ${appName}. All rights reserved.`,
    }
  }

  buildTranslations(strings, brief) {
    const appName = brief?.app_name || 'App'

    return {
      en: strings, // English is the canonical source
      es: this.translateToES(strings, appName),
      fr: this.translateToFR(strings, appName),
      de: this.translateToDE(strings, appName),
    }
  }

  translateToES(strings, _appName) {
    // Translate the stable UI strings; app-specific copy stays in English
    return {
      ...strings,
      nav_home: 'Inicio', nav_dashboard: 'Panel', nav_login: 'Iniciar sesión',
      nav_signup: 'Empezar', nav_logout: 'Cerrar sesión',
      auth_signup_cta: 'Crear cuenta', auth_login_cta: 'Iniciar sesión',
      auth_email_label: 'Correo electrónico', auth_password_label: 'Contraseña',
      auth_forgot_password: '¿Olvidaste tu contraseña?',
      auth_no_account: '¿No tienes una cuenta?', auth_have_account: '¿Ya tienes una cuenta?',
      action_save: 'Guardar', action_cancel: 'Cancelar', action_delete: 'Eliminar',
      action_edit: 'Editar', action_create: 'Crear', action_back: 'Volver',
      action_loading: 'Cargando...', action_submitting: 'Enviando...',
      error_generic: 'Algo salió mal. Inténtalo de nuevo.',
      error_network: 'Error de red. Comprueba tu conexión.',
      error_not_found: 'Página no encontrada.',
      error_unauthorized: 'Debes iniciar sesión para acceder a esta página.',
    }
  }

  translateToFR(strings, _appName) {
    return {
      ...strings,
      nav_home: 'Accueil', nav_dashboard: 'Tableau de bord', nav_login: 'Se connecter',
      nav_signup: 'Commencer', nav_logout: 'Se déconnecter',
      auth_signup_cta: 'Créer un compte', auth_login_cta: 'Se connecter',
      auth_email_label: 'Adresse e-mail', auth_password_label: 'Mot de passe',
      auth_forgot_password: 'Mot de passe oublié?',
      auth_no_account: "Vous n'avez pas de compte?", auth_have_account: 'Vous avez déjà un compte?',
      action_save: 'Enregistrer', action_cancel: 'Annuler', action_delete: 'Supprimer',
      action_edit: 'Modifier', action_create: 'Créer', action_back: 'Retour',
      action_loading: 'Chargement...', action_submitting: 'Envoi en cours...',
      error_generic: 'Une erreur est survenue. Veuillez réessayer.',
      error_network: "Erreur réseau. Vérifiez votre connexion.",
      error_not_found: 'Page non trouvée.',
      error_unauthorized: 'Vous devez vous connecter pour accéder à cette page.',
    }
  }

  translateToDE(strings, _appName) {
    return {
      ...strings,
      nav_home: 'Startseite', nav_dashboard: 'Dashboard', nav_login: 'Anmelden',
      nav_signup: 'Loslegen', nav_logout: 'Abmelden',
      auth_signup_cta: 'Konto erstellen', auth_login_cta: 'Anmelden',
      auth_email_label: 'E-Mail-Adresse', auth_password_label: 'Passwort',
      auth_forgot_password: 'Passwort vergessen?',
      auth_no_account: 'Noch kein Konto?', auth_have_account: 'Bereits ein Konto?',
      action_save: 'Speichern', action_cancel: 'Abbrechen', action_delete: 'Löschen',
      action_edit: 'Bearbeiten', action_create: 'Erstellen', action_back: 'Zurück',
      action_loading: 'Laden...', action_submitting: 'Wird gesendet...',
      error_generic: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
      error_network: 'Netzwerkfehler. Überprüfe deine Verbindung.',
      error_not_found: 'Seite nicht gefunden.',
      error_unauthorized: 'Du musst dich anmelden, um auf diese Seite zuzugreifen.',
    }
  }

  renderI18nTs(translations, brief) {
    const appName = brief?.app_name || 'App'
    const keys = Object.keys(translations.en)
    const typeLines = keys.map(k => `  ${k}: string`).join('\n')

    return `// src/lib/i18n.ts — generated by Sovereign i18n-agent
// App: ${appName}
// Supported locales: en, es, fr, de

export type Locale = 'en' | 'es' | 'fr' | 'de'

export type Strings = {
${typeLines}
}

const en: Strings = ${JSON.stringify(translations.en, null, 2).replace(/"([^"]+)":/g, '$1:')}

const es: Strings = ${JSON.stringify(translations.es, null, 2).replace(/"([^"]+)":/g, '$1:')}

const fr: Strings = ${JSON.stringify(translations.fr, null, 2).replace(/"([^"]+)":/g, '$1:')}

const de: Strings = ${JSON.stringify(translations.de, null, 2).replace(/"([^"]+)":/g, '$1:')}

const translations: Record<Locale, Strings> = { en, es, fr, de }

export function t(key: keyof Strings, locale: Locale = 'en'): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key
}

export function useLocale(): Locale {
  const lang = navigator.language.slice(0, 2) as Locale
  return ['en', 'es', 'fr', 'de'].includes(lang) ? lang : 'en'
}
`
  }
}

export default async function run(context) {
  return new I18nAgent().execute(context)
}
