export type Language = 'en' | 'de';

export const translations = {
  en: {
    // Common
    appTitle: 'Feature Vote',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    submit: 'Submit',
    close: 'Close',
    back: 'Back',
    
    // Navigation
    home: 'Home',
    admin: 'Admin',
    login: 'Login',
    logout: 'Logout',
    
    // Landing
    selectApp: 'Select an App',
    selectAppDesc: 'Choose an app to submit feedback or vote on features',
    noApps: 'No apps available yet',
    
    // Feedback types
    feature: 'Feature',
    bug: 'Bug',
    features: 'Features',
    bugs: 'Bugs',
    all: 'All',
    
    // Status
    statusPlanned: 'Planned',
    statusProgress: 'In Progress',
    statusCompleted: 'Completed',
    statusOpen: 'Open',
    
    // Voting
    vote: 'Vote',
    votes: 'votes',
    voted: 'Voted',
    
    // Create feedback
    createFeature: 'Request Feature',
    createBug: 'Report Bug',
    title: 'Title',
    titlePlaceholder: 'Short, descriptive title',
    description: 'Description',
    descriptionPlaceholder: 'Describe your request in detail...',
    submitSuccess: 'Successfully submitted!',
    
    // Detail view
    comments: 'Comments',
    noComments: 'No comments yet',
    addComment: 'Add comment',
    commentPlaceholder: 'Write a comment...',
    
    // Admin
    adminDashboard: 'Admin Dashboard',
    manageApps: 'Manage Apps',
    manageFeedback: 'Manage Feedback',
    addApp: 'Add App',
    appName: 'App Name',
    appSlug: 'URL Slug',
    appDescription: 'Description',
    confirmDelete: 'Are you sure you want to delete this?',
    changeStatus: 'Change Status',
    appCreated: 'App created successfully',
    appUpdated: 'App updated successfully',
    appDeleted: 'App deleted successfully',
    
    // Auth
    email: 'Email',
    password: 'Password',
    loginTitle: 'Admin Login',
    loginError: 'Invalid credentials',
    
    // Theme
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    
    // Language
    language: 'Language',
    english: 'English',
    german: 'Deutsch',
    
    // Delete feedback
    deleteFeedback: 'Delete Feedback',
    feedbackDeleted: 'Feedback deleted successfully',
    confirmDeleteFeedback: 'Are you sure you want to delete this feedback? This action cannot be undone.',
    
    // App logo
    appLogo: 'App Logo',
    uploadLogo: 'Upload Logo',
    
    // Error states
    loadError: 'Failed to load',
    retry: 'Retry',
    removeLogo: 'Remove Logo',
    logoUploaded: 'Logo uploaded successfully',
  },
  de: {
    // Common
    appTitle: 'Feature Vote',
    loading: 'Laden...',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    submit: 'Absenden',
    close: 'Schließen',
    back: 'Zurück',
    
    // Navigation
    home: 'Start',
    admin: 'Admin',
    login: 'Anmelden',
    logout: 'Abmelden',
    
    // Landing
    selectApp: 'App auswählen',
    selectAppDesc: 'Wähle eine App um Feedback zu geben oder abzustimmen',
    noApps: 'Noch keine Apps verfügbar',
    
    // Feedback types
    feature: 'Feature',
    bug: 'Bug',
    features: 'Features',
    bugs: 'Bugs',
    all: 'Alle',
    
    // Status
    statusPlanned: 'Geplant',
    statusProgress: 'In Arbeit',
    statusCompleted: 'Abgeschlossen',
    statusOpen: 'Offen',
    
    // Voting
    vote: 'Abstimmen',
    votes: 'Stimmen',
    voted: 'Abgestimmt',
    
    // Create feedback
    createFeature: 'Feature anfragen',
    createBug: 'Bug melden',
    title: 'Titel',
    titlePlaceholder: 'Kurzer, beschreibender Titel',
    description: 'Beschreibung',
    descriptionPlaceholder: 'Beschreibe deine Anfrage im Detail...',
    submitSuccess: 'Erfolgreich eingereicht!',
    
    // Detail view
    comments: 'Kommentare',
    noComments: 'Noch keine Kommentare',
    addComment: 'Kommentar hinzufügen',
    commentPlaceholder: 'Schreibe einen Kommentar...',
    
    // Admin
    adminDashboard: 'Admin Dashboard',
    manageApps: 'Apps verwalten',
    manageFeedback: 'Feedback verwalten',
    addApp: 'App hinzufügen',
    appName: 'App-Name',
    appSlug: 'URL-Slug',
    appDescription: 'Beschreibung',
    confirmDelete: 'Möchtest du das wirklich löschen?',
    changeStatus: 'Status ändern',
    appCreated: 'App erfolgreich erstellt',
    appUpdated: 'App erfolgreich aktualisiert',
    appDeleted: 'App erfolgreich gelöscht',
    
    // Auth
    email: 'E-Mail',
    password: 'Passwort',
    loginTitle: 'Admin Login',
    loginError: 'Ungültige Anmeldedaten',
    
    // Theme
    lightMode: 'Hellmodus',
    darkMode: 'Dunkelmodus',
    
    // Language
    language: 'Sprache',
    english: 'English',
    german: 'Deutsch',
    
    // Delete feedback
    deleteFeedback: 'Feedback löschen',
    feedbackDeleted: 'Feedback erfolgreich gelöscht',
    confirmDeleteFeedback: 'Möchtest du dieses Feedback wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    
    // App logo
    appLogo: 'App-Logo',
    uploadLogo: 'Logo hochladen',
    
    // Error states
    loadError: 'Laden fehlgeschlagen',
    retry: 'Erneut versuchen',
    removeLogo: 'Logo entfernen',
    logoUploaded: 'Logo erfolgreich hochgeladen',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(key: TranslationKey, lang: Language): string {
  return translations[lang][key] || translations.en[key] || key;
}
