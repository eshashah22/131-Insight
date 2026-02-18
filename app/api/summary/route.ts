import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { AWSBedrock } from '@/services/AWSBedrock';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;

// summarize ta feedback using bedrock and send it back to db
export async function POST(req: Request) {
    try {
      if (!FIREWORKS_API_KEY) {
        console.error('FIREWORKS_API_KEY is not set');
        return NextResponse.json(
          { error: 'Fireworks AI API key is not configured. Please add FIREWORKS_API_KEY to your .env file.' },
          { status: 500 }
        );
      }

      await dbConnect(); // is there a way to not reconnect to db every time?
      const { feedbackText } = await req.json();
  
      if (!feedbackText || feedbackText.trim().length === 0) {
        return NextResponse.json(
          { error: 'No feedback text provided' },
          { status: 400 }
        );
      }

      // Call the AWS Bedrock service to summarize the feedback
      // const summary = await AWSBedrock.summarizeFeedback(feedbackText);

      // Use a commonly available model that works without deployment
      // If you want to use gpt-oss-120b, you may need to deploy it first in your Fireworks dashboard
      const modelName = "accounts/fireworks/models/kimi-k2p5";
      console.log('Using model:', modelName);

      const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${FIREWORKS_API_KEY}`
        },
        body: JSON.stringify({
          model: modelName,
          "max_tokens": 4096,
          "top_p": 1,
          "top_k": 40,
          "presence_penalty": 0,
          "frequency_penalty": 0,
          "temperature": 0.6,
          messages: [
            { role: "user", content: "Concisely summarize these TA observations into a single line focused on student comprehension and engagement, without any commentary:" },
            { role: "assistant", content: "I will provide a single-line summary focused on student comprehension and engagement." },
            { role: "user", content: feedbackText }
          ]
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Fireworks AI API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
          }
        } catch (e) {
          // If parsing fails, use the text as-is
          errorMessage = errorText;
        }
        console.error('Fireworks AI API error:', response.status, errorText);
        return NextResponse.json(
          { error: errorMessage },
          { status: response.status }
        );
      }

      const responseBody = await response.json();
      
      if (!responseBody.choices?.[0]?.message?.content) {
        console.error('Unexpected response format:', responseBody);
        return NextResponse.json(
          { error: 'Invalid response from Fireworks AI' },
          { status: 500 }
        );
      }

      const summary = responseBody.choices[0].message.content; 
      return NextResponse.json({ summary }, { status: 201 });
    } catch (error) {
      console.error('Error summarizing feedback:', error);
      return NextResponse.json(
        { error: 'Failed to summarize feedback' },
        { status: 500 }
      );
    }
  }
