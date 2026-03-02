export interface SparkDoc {
    id: string;
    title: string;
    type: string;
    size: number;
    createdAt: Date;
}

export type SparkTab = "qa" | "mindmap" | "flashcards" | "assessments" | "charts" | "audio";
