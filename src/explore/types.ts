export interface SavedBoardItem {
  projectId: string;
  /** null means an existing save migrated without inventing a timestamp. */
  savedAt: string | null;
}
export interface Board {
  id: string;
  name: string;
  items: SavedBoardItem[];
}
export interface ProjectLibrary {
  version: 2;
  liked: string[];
  saved: string[];
  boards: Board[];
}

/** Image-relative coordinates, independent of the displayed viewport size. */
export interface VisualSearchSelection { x: number; y: number; width: number; height: number; }

export interface OnboardingPreferences {
  version: 1;
  aesthetics: string[];
  skill: "" | "Beginner" | "Intermediate" | "Advanced";
  tools: string[];
  world: "cultivation" | "fairy" | "fantasy" | "runway" | "cyberpunk";
  status: "draft" | "completed" | "skipped";
}
