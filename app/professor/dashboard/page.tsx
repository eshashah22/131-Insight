"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { DateRange } from 'react-day-picker';
import { addDays, format, isWithinInterval, startOfDay } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Feedback {
  _id: string;
  taName: string;
  courseCode: string;
  date: string;
  attendanceCount: number;
  studentEngagement: number;
  topicsCovered: string[];
  challengingConcepts: string;
  suggestions?: string;
  needsAttention: boolean;
}

export default function ProfessorDashboard() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const response = await fetch('/api/feedback?professorId=prof123');
        if (!response.ok) throw new Error('Failed to fetch feedback');
        const data = await response.json();
        setFeedbacks(data);
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, []);

  const filteredFeedbacks = feedbacks.filter(feedback => {
    if (!dateRange?.from || !dateRange?.to) return true;
    const feedbackDate = startOfDay(new Date(feedback.date));
    return isWithinInterval(feedbackDate, {
      start: startOfDay(dateRange.from),
      end: startOfDay(dateRange.to),
    });
  });

  const engagementData = filteredFeedbacks
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(feedback => ({
      date: format(new Date(feedback.date), 'MMM d'),
      engagement: feedback.studentEngagement,
      attendance: feedback.attendanceCount
    }));

  const urgentFeedbacks = filteredFeedbacks.filter(f => f.needsAttention);
  const averageEngagement = filteredFeedbacks.length 
    ? filteredFeedbacks.reduce((acc, curr) => acc + curr.studentEngagement, 0) / filteredFeedbacks.length 
    : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center text-primary hover:text-primary/90 mb-6">
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Link>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Professor Dashboard</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Urgent Matters</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{urgentFeedbacks.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg. Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{averageEngagement.toFixed(1)}/5</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Engagement & Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{ 
                    value: 'Engagement (1-5)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 12 }
                  }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  label={{ 
                    value: 'Attendance',
                    angle: 90,
                    position: 'insideRight',
                    style: { fontSize: 12 }
                  }}
                />
                <Tooltip 
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number) => [value.toFixed(1)]}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="engagement"
                  stroke="hsl(var(--primary))"
                  name="Engagement"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="attendance"
                  stroke="hsl(var(--secondary))"
                  name="Attendance"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {filteredFeedbacks.slice(0, 5).map((feedback) => (
                <div
                  key={feedback._id}
                  className="border-b pb-4 last:border-0"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{feedback.courseCode}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feedback.taName} - {format(new Date(feedback.date), 'PPP')}
                      </p>
                    </div>
                    {feedback.needsAttention && (
                      <span className="bg-primary/10 text-primary text-sm px-2 py-1 rounded">
                        Needs Attention
                      </span>
                    )}
                  </div>
                  <p className="text-sm mb-2">
                    <strong>Topics:</strong> {feedback.topicsCovered.join(', ')}
                  </p>
                  <p className="text-sm">
                    <strong>Challenging Concepts:</strong> {feedback.challengingConcepts}
                  </p>
                  {feedback.suggestions && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      <strong>Suggestions:</strong> {feedback.suggestions}
                    </p>
                  )}
                </div>
              ))}
              {filteredFeedbacks.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No feedback data available for the selected date range
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}