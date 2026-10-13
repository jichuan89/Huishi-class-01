export type UserActivityEvent =
  | {
      type: 'model.switch';
      payload: { fromModel?: string; toModel: string; source?: 'manual' | 'local' | 'resource' | 'ai' | 'fallback' };
    }
  | {
      type: 'xiaozhi.conversation';
      payload: { userText: string; assistantText: string };
    }
  | {
      type: 'gesture.part.move';
      payload: { modelName: string; partName: string };
    }
  | {
      type: 'gesture.mode.switch';
      payload: { mode: 'single' | 'dual' };
    }
  | {
      type: 'model.reset-disassembly';
      payload: { modelName: string };
    };

type ActivityResponse = {
  ok?: boolean;
  message?: string;
};

export async function logUserActivity(event: UserActivityEvent): Promise<void> {
  try {
    const response = await fetch('/api/activity-events', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const data = await response.json() as ActivityResponse;
        if (data.message) message = data.message;
      } catch {
        // Activity logging must never affect the classroom UI.
      }
      console.warn('[Activity log] Semantic event was not recorded:', message);
    }
  } catch (error) {
    console.warn('[Activity log] Semantic event request failed:', error);
  }
}
