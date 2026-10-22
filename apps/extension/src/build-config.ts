declare const __WIKIRACE_API_ORIGIN__: string;
declare const __WIKIRACE_BETA__: boolean;
export const BETA_BUILD = typeof __WIKIRACE_BETA__ !== "undefined" && __WIKIRACE_BETA__;
export const DEFAULT_API_ORIGIN = typeof __WIKIRACE_API_ORIGIN__ === "undefined" ? "http://localhost:4000" : __WIKIRACE_API_ORIGIN__;
