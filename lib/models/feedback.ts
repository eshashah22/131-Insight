import mongoose from 'mongoose';

// use to create valid schemas. update this as we think of new fields
const FeedbackSchema = new mongoose.Schema({
  taName: {
    type: String,
    required: true,
  },
  courseCode: {
    type: String,
    required: true,
    enum: ['CMSC131', 'CMSC132'],
  },
  professorName: {
    type: String,
    required: true,
    enum: ['Elias Gonzalez', 'Pedram Sadeghian'],
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  attendanceCount: {
    type: Number,
    required: true,
  },
  attendanceType: {
    type: String,
    enum: ['exact', 'estimate'],
    required: true,
  },
  topicsCovered: {
    type: [String],
    required: true,
  },
  studentEngagement: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  overview: {
    type: String,
    required: true,
  },
  suggestions: {
    type: String,
    required: false,
  },
  needsAttention: {
    type: Boolean,
    required: true,
  },
  sentimentScore: {
    type: Number,
    required: false,
    min: -1,
    max: 1,
  },
  sentimentLabel: {
    type: String,
    required: false,
    enum: ['positive', 'neutral', 'negative'],
  },
  semester: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
});

export default mongoose.models.Feedback || mongoose.model('Feedback', FeedbackSchema);