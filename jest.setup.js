// Ce fichier permet d'ajouter des configurations supplémentaires pour Jest

// Activer les matchers jest-dom pour faciliter les tests React
require('@testing-library/jest-dom');

// Supprimer les logs pendant les tests
global.console = {
    ...global.console,
    // Ne pas afficher les messages non critiques pendant les tests
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Garder les warnings et erreurs visibles
    warn: global.console.warn,
    error: global.console.error,
}; 