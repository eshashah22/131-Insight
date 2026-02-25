import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/feedback';
import { getSemesterFromDate } from '@/lib/semester';

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
    
    // Ensure semester and year are set (use date if not provided)
    if (!data.semester || !data.year) {
      const feedbackDate = data.date ? new Date(data.date) : new Date();
      const semesterCode = getSemesterFromDate(feedbackDate);
      const [semester, yearStr] = semesterCode.split(' ');
      data.semester = data.semester || semester;
      data.year = data.year || parseInt(yearStr);
    }
    
    console.log('Saving feedback with semester/year:', {
      semester: data.semester,
      year: data.year,
      professorName: data.professorName,
      courseCode: data.courseCode
    });
    
    // Analyze sentiment from overview and suggestions
    const feedbackText = `${data.overview || ''} ${data.suggestions || ''}`.trim();
    
    if (feedbackText.length > 0) {
      try {
        const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
        
        if (!FIREWORKS_API_KEY) {
          console.log('FIREWORKS_API_KEY not set, skipping sentiment analysis');
        } else {
          const modelName = "accounts/fireworks/models/kimi-k2p5";
          console.log('Analyzing sentiment for feedback text length:', feedbackText.length);
          
          const sentimentResponse = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "Authorization": `Bearer ${FIREWORKS_API_KEY}`
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: 100,
              temperature: 0.3,
              messages: [
                { 
                  role: "user", 
                  content: `Analyze the sentiment of this TA feedback text. Respond with ONLY a JSON object in this exact format: {"score": -1.0 to 1.0, "label": "positive" or "neutral" or "negative"}. Score: -1.0 is very negative, 0.0 is neutral, 1.0 is very positive. Label: "positive" if score > 0.2, "negative" if score < -0.2, otherwise "neutral".\n\nText: ${feedbackText}` 
                }
              ]
            })
          });

          if (!sentimentResponse.ok) {
            const errorText = await sentimentResponse.text();
            console.error('Sentiment API error:', sentimentResponse.status, errorText);
          } else {
            const responseBody = await sentimentResponse.json();
            const content = responseBody.choices?.[0]?.message?.content?.trim();
            
            console.log('Sentiment API response:', content);
            
            if (content) {
              try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                const sentimentData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
                
                console.log('Parsed sentiment data:', sentimentData);
                
                data.sentimentScore = Math.max(-1, Math.min(1, sentimentData.score || 0));
                data.sentimentLabel = ['positive', 'neutral', 'negative'].includes(sentimentData.label)
                  ? sentimentData.label
                  : (data.sentimentScore > 0.2 ? 'positive' : data.sentimentScore < -0.2 ? 'negative' : 'neutral');
                
                console.log('Final sentiment:', { score: data.sentimentScore, label: data.sentimentLabel });
              } catch (parseError) {
                console.error('Failed to parse sentiment response:', content, parseError);
                // Fallback: simple keyword-based sentiment
                const lowerText = feedbackText.toLowerCase();
                let score = 0;
                let label = 'neutral';
                
                const positiveWords = ['good', 'great', 'excellent', 'well', 'easy', 'understood', 'engaged', 'helpful', 'clear', 'positive'];
                const negativeWords = ['difficult', 'struggled', 'confused', 'hard', 'challenging', 'problem', 'issue', 'concern', 'negative', 'poor'];
                
                const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
                const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
                
                if (positiveCount > negativeCount) {
                  score = Math.min(0.5 + (positiveCount * 0.1), 1.0);
                  label = 'positive';
                } else if (negativeCount > positiveCount) {
                  score = Math.max(-0.5 - (negativeCount * 0.1), -1.0);
                  label = 'negative';
                }
                
                data.sentimentScore = score;
                data.sentimentLabel = label;
                console.log('Using fallback sentiment:', { score, label });
              }
            } else {
              console.error('No content in sentiment response:', responseBody);
            }
          }
        }
      } catch (sentimentError) {
        console.error('Error analyzing sentiment (continuing without it):', sentimentError);
        // Continue without sentiment if analysis fails
      }
    } else {
      console.log('No feedback text to analyze for sentiment');
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

// get ta feedback based on professor name, class, and semester
export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const professorName = searchParams.get('professorName');
    const courseCode = searchParams.get('courseCode');
    const semester = searchParams.get('semester');
    const year = searchParams.get('year');

    const query: any = {};
    if (professorName) {
      query.professorName = professorName;
    }
    if (courseCode) {
      query.courseCode = courseCode;
    }
    if (semester) {
      query.semester = semester;
    }
    if (year) {
      query.year = parseInt(year);
    }

    console.log('Feedback query:', JSON.stringify(query));
    let feedbacks = await Feedback.find(query)
      .sort({
        needsAttention: -1, // needsAttention=true items first
        date: -1, // most recent first
      });
    
    // If filtering by semester/year, also include feedbacks that don't have semester/year set
    // but match based on date calculation (for backwards compatibility with old feedbacks)
    if (semester && year) {
      const yearNum = parseInt(year);
      // Get all feedbacks without semester filter first
      const allQuery: any = {};
      if (professorName) allQuery.professorName = professorName;
      if (courseCode) allQuery.courseCode = courseCode;
      // Find feedbacks that don't have semester/year set
      allQuery.$or = [
        { semester: { $exists: false } },
        { semester: null },
        { year: { $exists: false } },
        { year: null }
      ];
      
      const oldFeedbacks = await Feedback.find(allQuery);
      
      // Filter old feedbacks by calculating semester from date
      const matchingOldFeedbacks = oldFeedbacks.filter((fb: any) => {
        if (!fb.date) return false;
        const feedbackDate = new Date(fb.date);
        const calculatedSemester = getSemesterFromDate(feedbackDate);
        const [calcSemester, calcYearStr] = calculatedSemester.split(' ');
        const calcYear = parseInt(calcYearStr);
        return calcSemester === semester && calcYear === yearNum;
      });
      
      // Combine results and remove duplicates
      const allFeedbacks = [...feedbacks, ...matchingOldFeedbacks];
      const uniqueFeedbacks = allFeedbacks.filter((fb, index, self) => 
        index === self.findIndex((f) => f._id.toString() === fb._id.toString())
      );
      feedbacks = uniqueFeedbacks.sort((a, b) => {
        // Sort by needsAttention first, then date
        if (a.needsAttention !== b.needsAttention) {
          return a.needsAttention ? -1 : 1;
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }
    
    // Populate missing semester/year for old feedbacks (backwards compatibility)
    const feedbacksWithSemester = await Promise.all(
      feedbacks.map(async (fb: any) => {
        if (!fb.semester || !fb.year) {
          const feedbackDate = fb.date ? new Date(fb.date) : new Date();
          const semesterCode = getSemesterFromDate(feedbackDate);
          const [sem, yearStr] = semesterCode.split(' ');
          
          // Update the document in database for future queries
          try {
            await Feedback.findByIdAndUpdate(fb._id, {
              semester: sem,
              year: parseInt(yearStr)
            });
          } catch (updateError) {
            console.error('Error updating feedback semester/year:', updateError);
          }
          
          // Return with populated values
          return {
            ...fb.toObject(),
            semester: sem,
            year: parseInt(yearStr)
          };
        }
        return fb.toObject();
      })
    );
    
    console.log(`Found ${feedbacksWithSemester.length} feedbacks matching query`);
    if (feedbacksWithSemester.length > 0) {
      console.log('Sample feedback:', {
        semester: feedbacksWithSemester[0].semester,
        year: feedbacksWithSemester[0].year,
        date: feedbacksWithSemester[0].date,
        professorName: feedbacksWithSemester[0].professorName,
        courseCode: feedbacksWithSemester[0].courseCode
      });
    }
    
    
    return NextResponse.json(feedbacksWithSemester);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}

// delete a specific feedback entry by id
export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Feedback id is required' },
        { status: 400 }
      );
    }

    const deleted = await Feedback.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to delete feedback' },
      { status: 500 }
    );
  }
}