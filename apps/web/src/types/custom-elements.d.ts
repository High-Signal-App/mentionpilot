import type React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "saas-maker-newsletter-capture": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "product-name"?: string;
        "catalog-id"?: string;
        kind?: "newsletter" | "waitlist";
        source?: string;
        "privacy-url"?: string;
        theme?: string;
      };
    }
  }
}
