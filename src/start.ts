import type { AnyRequestMiddleware } from "@tanstack/start-client-core";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = {
  "~types": undefined,
  options: {
    type: "request",
    server: async ({ next }: { next: () => Promise<unknown> }) => {
      try {
        return await next();
      } catch (error) {
        if (error != null && typeof error === "object" && "statusCode" in error) {
          throw error;
        }
        console.error(error);
        return new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    },
  },
} as unknown as AnyRequestMiddleware;

export const startInstance = {
  getOptions: async () => ({
    requestMiddleware: [errorMiddleware],
    functionMiddleware: [attachSupabaseAuth],
  }),
};
