import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  TranslationSessions,
  TranslationVariants,
  and,
  db,
  eq,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedSession(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(TranslationSessions)
    .where(and(eq(TranslationSessions.id, sessionId), eq(TranslationSessions.userId, userId)));

  if (!session) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Translation session not found.",
    });
  }

  return session;
}

export const server = {
  createTranslationSession: defineAction({
    input: z.object({
      sourceLanguage: z.string().optional(),
      targetLanguage: z.string().optional(),
      context: z.string().optional(),
      originalText: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [session] = await db
        .insert(TranslationSessions)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          sourceLanguage: input.sourceLanguage,
          targetLanguage: input.targetLanguage,
          context: input.context,
          originalText: input.originalText,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { session } };
    },
  }),

  updateTranslationSession: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        sourceLanguage: z.string().optional(),
        targetLanguage: z.string().optional(),
        context: z.string().optional(),
        originalText: z.string().optional(),
      })
      .refine(
        (input) =>
          input.sourceLanguage !== undefined ||
          input.targetLanguage !== undefined ||
          input.context !== undefined ||
          input.originalText !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.id, user.id);

      const [session] = await db
        .update(TranslationSessions)
        .set({
          ...(input.sourceLanguage !== undefined ? { sourceLanguage: input.sourceLanguage } : {}),
          ...(input.targetLanguage !== undefined ? { targetLanguage: input.targetLanguage } : {}),
          ...(input.context !== undefined ? { context: input.context } : {}),
          ...(input.originalText !== undefined ? { originalText: input.originalText } : {}),
          updatedAt: new Date(),
        })
        .where(eq(TranslationSessions.id, input.id))
        .returning();

      return { success: true, data: { session } };
    },
  }),

  listTranslationSessions: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const sessions = await db
        .select()
        .from(TranslationSessions)
        .where(eq(TranslationSessions.userId, user.id));

      return { success: true, data: { items: sessions, total: sessions.length } };
    },
  }),

  createTranslationVariant: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
      tone: z.string().optional(),
      politenessLevel: z.string().optional(),
      styleHint: z.string().optional(),
      translatedText: z.string().min(1),
      isFavorite: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const [variant] = await db
        .insert(TranslationVariants)
        .values({
          id: crypto.randomUUID(),
          sessionId: input.sessionId,
          tone: input.tone,
          politenessLevel: input.politenessLevel,
          styleHint: input.styleHint,
          translatedText: input.translatedText,
          isFavorite: input.isFavorite ?? false,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { variant } };
    },
  }),

  updateTranslationVariant: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        sessionId: z.string().min(1),
        tone: z.string().optional(),
        politenessLevel: z.string().optional(),
        styleHint: z.string().optional(),
        translatedText: z.string().optional(),
        isFavorite: z.boolean().optional(),
      })
      .refine(
        (input) =>
          input.tone !== undefined ||
          input.politenessLevel !== undefined ||
          input.styleHint !== undefined ||
          input.translatedText !== undefined ||
          input.isFavorite !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const [existing] = await db
        .select()
        .from(TranslationVariants)
        .where(and(eq(TranslationVariants.id, input.id), eq(TranslationVariants.sessionId, input.sessionId)));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Translation variant not found.",
        });
      }

      const [variant] = await db
        .update(TranslationVariants)
        .set({
          ...(input.tone !== undefined ? { tone: input.tone } : {}),
          ...(input.politenessLevel !== undefined ? { politenessLevel: input.politenessLevel } : {}),
          ...(input.styleHint !== undefined ? { styleHint: input.styleHint } : {}),
          ...(input.translatedText !== undefined ? { translatedText: input.translatedText } : {}),
          ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        })
        .where(eq(TranslationVariants.id, input.id))
        .returning();

      return { success: true, data: { variant } };
    },
  }),

  deleteTranslationVariant: defineAction({
    input: z.object({
      id: z.string().min(1),
      sessionId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const result = await db
        .delete(TranslationVariants)
        .where(and(eq(TranslationVariants.id, input.id), eq(TranslationVariants.sessionId, input.sessionId)));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Translation variant not found.",
        });
      }

      return { success: true };
    },
  }),

  listTranslationVariants: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
      favoritesOnly: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const filters = [eq(TranslationVariants.sessionId, input.sessionId)];
      if (input.favoritesOnly) {
        filters.push(eq(TranslationVariants.isFavorite, true));
      }

      const variants = await db.select().from(TranslationVariants).where(and(...filters));

      return { success: true, data: { items: variants, total: variants.length } };
    },
  }),
};
