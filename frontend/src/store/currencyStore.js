import { create } from 'zustand';
import { settingsAPI } from '../services/api';

export const useCurrencyStore = create((set, get) => ({
    currencyCode: 'USD',
    currencySymbol: '$',
    isLoaded: false,

    fetchCurrencySettings: async () => {
        try {
            const settings = await settingsAPI.getSettings();
            set({
                currencyCode: settings.currency_code || 'USD',
                currencySymbol: settings.currency_symbol || '$',
                isLoaded: true
            });
        } catch (error) {
            console.error('Failed to load currency settings:', error);
            // Fallback
            set({ currencyCode: 'USD', currencySymbol: '$', isLoaded: true });
        }
    },

    setCurrency: (code, symbol) => {
        set({
            currencyCode: code || 'USD',
            currencySymbol: symbol || '$',
            isLoaded: true
        });
    },

    formatCurrency: (amount) => {
        const { currencySymbol } = get();
        // Only add a space if the symbol is a word/code (e.g. "INR ", "USD "), 
        // but typically symbols like "$" don't need spaces. 
        // We'll just slap the symbol right next to the formatted number for simplicity.
        const num = parseFloat(amount) || 0;

        // Formatting number with commas 
        const formattedNum = num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        // If the symbol is more than 1 character (like 'Rs' or 'AED'), add a space
        const needsSpace = currencySymbol.length > 1 && !currencySymbol.match(/[^\w\s]/);

        return `${currencySymbol}${needsSpace ? ' ' : ''}${formattedNum}`;
    }
}));
