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
        layout?: string;
        integrated?: string;
      };
      "fleet-footer-extension": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "data-fleet-footer-project"?: string;
        "product-name"?: string;
        "signature-font"?: "newsreader" | "ui" | "inherit";
        "font-base"?: string;
        "art-src"?: string;
        "art-alt"?: string;
        "art-width"?: string;
        "art-height"?: string;
        "art-position"?: string;
        "art-credit"?: string;
        theme?: "dark" | "light";
        surface?: "web" | "app";
      };
    }
  }
}
