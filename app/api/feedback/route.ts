import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/feedback';

// send ta feedback to db
export async function POST(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();
    
    // Convert topicsCovered from string to array if it's a string
    if (typeof data.topicsCovered === 'string') {
      data.topicsCovered = data.topicsCovered
        .split(',')
        .map((topic: string) => topic.trim())
        .filter((topic: string) => topic.length > 0);
    }
    
    const feedback = await Feedback.create(data); // enforce feedback schema
    return NextResponse.json(feedback, { status: 201 });

  } catch (error) {
    console.error('Error creating feedback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create feedback';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// get ta feedback based on professor name and class
export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const professorName = searchParams.get('professorName');
    const courseCode = searchParams.get('courseCode');

    const query: any = {};
    if (professorName) {
      query.professorName = professorName;
    }
    if (courseCode) {
      query.courseCode = courseCode;
    }

    const feedbacks = await Feedback.find(query)
      .sort({
        needsAttention: -1, // needsAttention=true items first
        date: -1, // most recent first
      }); 
    
    
    return NextResponse.json(feedbacks);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}