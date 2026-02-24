import * as z from "zod";

export const feedbackFormSchema = z.object({
  taName: z.string().min(2, "Name must be at least 2 characters"),
  courseCode: z.enum(["CMSC131", "CMSC132"]),
  professorName: z.enum(["Elias Gonzalez", "Pedram Sadeghian"]),
  semester: z.enum(["Fall", "Spring", "Summer"]),
  year: z.number().min(2020).max(2100),
  attendanceType: z.enum(["exact", "estimate"]),
  attendanceCount: z.number().min(0, "Attendance must be 0 or greater").optional(),
  attendanceEstimate: z.enum(["low", "medium", "high"]).optional(),
  topicsCovered: z.string().min(2, "Topics covered are required"),
  studentEngagement: z.number().min(1).max(5),
  overview: z.string().min(2, "Please describe challenging concepts"),
  suggestions: z.string(),
  needsAttention: z.boolean(),
}).refine((data) => {
  if (data.attendanceType === "exact") {
    return data.attendanceCount !== undefined;
  }
  return data.attendanceEstimate !== undefined;
}, {
  message: "Please provide either an exact count or an estimate",
});

export type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

export const estimateToNumber = {
  low: 10,
  medium: 20,
  high: 35,
} as const;