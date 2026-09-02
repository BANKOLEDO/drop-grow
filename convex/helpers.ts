import {
  contentKindValidator,
  visibilityValidator,
  ideaStageValidator,
  agentRoleValidator,
  contributorTypeValidator,
} from "./schema";
import type { Doc } from "./_generated/dataModel";

/* Re-export schema validators so mutations/queries can import from one place. */
export {
  contentKindValidator,
  visibilityValidator,
  ideaStageValidator,
  agentRoleValidator,
  contributorTypeValidator,
};

export type { Doc };
