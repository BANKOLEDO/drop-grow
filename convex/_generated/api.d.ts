/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents_engine from "../agents/engine.js";
import type * as agents_llm from "../agents/llm.js";
import type * as auth from "../auth.js";
import type * as comments from "../comments.js";
import type * as connections from "../connections.js";
import type * as health from "../health.js";
import type * as helpers from "../helpers.js";
import type * as ideas from "../ideas.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agents/engine": typeof agents_engine;
  "agents/llm": typeof agents_llm;
  auth: typeof auth;
  comments: typeof comments;
  connections: typeof connections;
  health: typeof health;
  helpers: typeof helpers;
  ideas: typeof ideas;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
