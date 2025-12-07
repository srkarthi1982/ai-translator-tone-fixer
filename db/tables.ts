/**
 * AI Translator & Tone Fixer - translate text with tone and style control.
 *
 * Design goals:
 * - Support translation sessions: one "job" with many variants (tones / styles).
 * - Track source & target language codes for future analytics.
 * - Keep original text, improved/translated text, and parameters used.
 */

import { defineTable, column, NOW } from "astro:db";

export const TranslationSessions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    sourceLanguage: column.text({ optional: true }),  // e.g. "en", "ta", "ar"
    targetLanguage: column.text({ optional: true }),
    context: column.text({ optional: true }),         // "email", "essay", "social post"
    originalText: column.text(),                      // text provided by user
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const TranslationVariants = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sessionId: column.text({
      references: () => TranslationSessions.columns.id,
    }),
    tone: column.text({ optional: true }),            // "formal", "friendly", "apologetic", etc.
    politenessLevel: column.text({ optional: true }), // custom label if needed
    styleHint: column.text({ optional: true }),       // e.g. "corporate", "casual"
    translatedText: column.text(),                    // final translated + tone-adjusted text
    isFavorite: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  TranslationSessions,
  TranslationVariants,
} as const;
