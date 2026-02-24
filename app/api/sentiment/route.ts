import { NextResponse } from 'next/server';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;

// Analyze sentiment of feedback text
export async function POST(req: Request) {
  try {
    if (!FIREWORKS_API_KEY) {
      console.error('FIREWORKS_API_KEY is not set');
      return NextResponse.json(
        { error: 'Fireworks AI API key is not configured' },
        { status: 500 }
      );
    }

    const { text } = await req.json();
  
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    const modelName = "accounts/fireworks/models/kimi-k2p5";
    
    const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
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
            content: `Analyze the sentiment of this TA feedback text. Respond with ONLY a JSON object in this exact format: {"score": -1.0 to 1.0, "label": "positive" or "neutral" or "negative"}. Score: -1.0 is very negative, 0.0 is neutral, 1.0 is very positive. Label: "positive" if score > 0.2, "negative" if score < -0.2, otherwise "neutral".\n\nText: ${text}` 
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fireworks AI API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Fireworks AI API error: ${response.status}` },
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

    // Parse the JSON response from the AI
    const content = responseBody.choices[0].message.content.trim();
    let sentimentData;
    
    try {
      // Try to extract JSON from the response (might have extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        sentimentData = JSON.parse(jsonMatch[0]);
      } else {
        sentimentData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse sentiment response:', content);
      // Fallback: simple keyword-based sentiment
      const lowerText = text.toLowerCase();
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
      
      sentimentData = { score, label };
    }

    // Validate and normalize the sentiment data
    const score = typeof sentimentData.score === 'number' 
      ? Math.max(-1, Math.min(1, sentimentData.score)) 
      : 0;
    const label = ['positive', 'neutral', 'negative'].includes(sentimentData.label)
      ? sentimentData.label
      : (score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral');

    return NextResponse.json({ 
      score,
      label 
    }, { status: 200 });
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
      { status: 500 }
    );
  }
}

