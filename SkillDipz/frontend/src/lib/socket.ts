/**
 * WebSocket event type constants.
 * These must match the event_type strings sent by the backend ws_manager.
 */

export const WS_EVENTS = {
  /** Sent to the specific student whose employability score changed. */
  SCORE_UPDATE: "score_update",

  /** Sent to a specific student for bell-icon notifications. */
  NOTIFICATION: "notification",

  /** Broadcast to ALL online users when a student creates a project group. */
  NEW_PROJECT_GROUP: "new_project_group",

  /** Sent to existing project members when someone new joins their group. */
  MEMBER_JOINED_PROJECT: "member_joined_project",
} as const;

export type WsEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
